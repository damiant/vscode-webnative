import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerCommand } from '../cli/registry';
import { flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { capacitorDevicesCommand } from '../build/capacitor-run';
import { listDevices, DeviceInfo } from '../devices/capacitor-device';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { CliContext } from '../core/context';
import { ensureProject } from './helpers';

function defaultsPath(): string {
  return path.join(os.homedir(), '.config', 'wn', 'devices.json');
}

function readDefaults(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(defaultsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeDefaults(data: Record<string, string>): void {
  fs.mkdirSync(path.dirname(defaultsPath()), { recursive: true });
  fs.writeFileSync(defaultsPath(), JSON.stringify(data, null, 2) + '\n');
}

async function listAll(ctx: CliContext): Promise<{ ios: DeviceInfo[]; android: DeviceInfo[] }> {
  const project = await ensureProject(ctx);
  const platform = flagString(ctx.args.flags, 'platform');
  const run = async (cmd: string, cwd: string) => ctx.exec.getOutput({ command: cmd, cwd }, { ignoreExitCode: true });

  const ios: DeviceInfo[] = [];
  const android: DeviceInfo[] = [];

  if ((!platform || platform === 'ios') && project.hasCapacitorProject(CapacitorPlatform.ios)) {
    try {
      const cmd = capacitorDevicesCommand(CapacitorPlatform.ios, project);
      ios.push(...(await listDevices(cmd, project.projectFolder(), run)));
    } catch {
      /* tool missing */
    }
  }
  if ((!platform || platform === 'android') && project.hasCapacitorProject(CapacitorPlatform.android)) {
    try {
      const cmd = capacitorDevicesCommand(CapacitorPlatform.android, project);
      android.push(...(await listDevices(cmd, project.projectFolder(), run)));
    } catch {
      /* tool missing */
    }
  }

  return { ios, android };
}

registerCommand({
  name: 'devices',
  description: 'List iOS/Android run targets',
  run: async (ctx) => listAll(ctx),
});

registerCommand({
  name: 'devices list',
  description: 'List iOS/Android run targets',
  run: async (ctx) => listAll(ctx),
});

registerCommand({
  name: 'devices default',
  description: 'Get or set the default device for run',
  run: async (ctx) => {
    const platform = flagString(ctx.args.flags, 'platform') || 'ios';
    const setId = flagString(ctx.args.flags, 'set');
    const clear = ctx.args.flags['clear'] === true;

    const defaults = readDefaults();
    if (clear) {
      delete defaults[platform];
      writeDefaults(defaults);
      return { cleared: platform };
    }
    if (setId) {
      defaults[platform] = setId;
      writeDefaults(defaults);
      return { platform, device: setId };
    }
    return { platform, device: defaults[platform] || null };
  },
});

export async function resolveDeviceId(
  ctx: CliContext,
  platform: CapacitorPlatform,
  deviceFlag?: string,
  deviceName?: string,
): Promise<string> {
  const { ios, android } = await listAll(ctx);
  const devices = platform === CapacitorPlatform.ios ? ios : android;

  if (deviceFlag) {
    const match = devices.find((d) => d.id === deviceFlag || d.name === deviceFlag);
    if (!match) {
      throw new WnError('MISSING_INPUT', `Device not found: ${deviceFlag}`, {
        exitCode: ExitCode.MissingInput,
        input: 'device',
        choices: devices.map((d) => ({ id: d.id, name: d.name, type: d.type })),
        hint: 'Re-run with --device <id>',
      });
    }
    return match.id;
  }

  if (deviceName) {
    const matches = devices.filter((d) => d.name === deviceName || d.name.includes(deviceName));
    if (matches.length === 1) return matches[0].id;
    throw new WnError('MISSING_INPUT', `Ambiguous device name: ${deviceName}`, {
      exitCode: ExitCode.MissingInput,
      input: 'device',
      choices: (matches.length ? matches : devices).map((d) => ({ id: d.id, name: d.name, type: d.type })),
      hint: 'Re-run with --device <id>',
    });
  }

  const defaults = readDefaults();
  if (defaults[platform]) return defaults[platform];

  if (devices.length === 0) {
    throw new WnError('NO_DEVICES', `No ${platform} devices found`, {
      exitCode: ExitCode.CommandFailed,
      hint: 'Connect a device or start a simulator/emulator',
    });
  }

  if (devices.length === 1) return devices[0].id;

  const { requireChoice } = await import('../cli/prompt');
  const chosen = await requireChoice(
    'device',
    devices.map((d) => ({ id: d.id, name: d.name, type: d.type })),
    ctx.opts,
    'Re-run with --device <id>',
  );
  return chosen.id;
}
