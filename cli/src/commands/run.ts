import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { registerCommand } from '../cli/registry';
import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { serve } from '../build/web-run';
import { capacitorRun } from '../build/capacitor-run';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { scrapeDevServerUrl } from '../core/exec';
import { CliContext } from '../core/context';
import { ensureProject, runCommandResult, usageError } from './helpers';
import { resolveDeviceId } from './devices';
import { getExternalAddresses } from '../build/web-run';

function pidDir(): string {
  return path.join(os.tmpdir(), 'wn');
}

function pidFile(projectName: string, kind: string): string {
  return path.join(pidDir(), `${projectName}-${kind}.json`);
}

function logFile(projectName: string, kind: string): string {
  return path.join(pidDir(), `${projectName}-${kind}.log`);
}

function saveManagedProcess(info: Record<string, unknown>): void {
  fs.mkdirSync(pidDir(), { recursive: true });
  const file = pidFile(String(info.name), String(info.kind));
  fs.writeFileSync(file, JSON.stringify(info, null, 2));
}

async function runWeb(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const port = Number(flagString(ctx.args.flags, 'port') || ctx.config.defaultPort || 8100);
  const background = flagBool(ctx.args.flags, 'background');
  const open = flagBool(ctx.args.flags, 'open');
  const https = flagBool(ctx.args.flags, 'https');
  const host = flagString(ctx.args.flags, 'host');
  const config = flagString(ctx.args.flags, 'config');
  const strictPort = flagBool(ctx.args.flags, 'strict-port');

  const result = await serve(project, {
    dontOpenBrowser: !open,
    httpsForWeb: https,
    externalIP: host === 'external' || !!host,
    host: host && host !== 'external' ? host : undefined,
    defaultPort: port,
    runConfiguration: config,
    createCerts: https,
  });

  const cmd = typeof result.command === 'string' ? result.command : result.command.command;
  const cwd = typeof result.command === 'string' ? project.projectFolder() : result.command.cwd;
  const usedPort = result.port || port;

  if (ctx.opts.dryRun) {
    await runCommandResult(ctx, result.command);
    return { dryRun: true, command: cmd, port: usedPort };
  }

  if (strictPort && result.port && result.port !== port) {
    throw new WnError('PORT_IN_USE', `Port ${port} is in use`, { exitCode: ExitCode.CommandFailed });
  }

  const name = path.basename(project.projectFolder());
  const log = logFile(name, 'web');
  fs.mkdirSync(pidDir(), { recursive: true });

  if (background) {
    const out = fs.openSync(log, 'w');
    const child = spawn(cmd, [], {
      cwd,
      shell: true,
      detached: true,
      stdio: ['ignore', out, out],
    });
    child.unref();
    const url = `http://localhost:${usedPort}`;
    const addresses = getExternalAddresses();
    const externalUrl = addresses[0] ? `http://${addresses[0]}:${usedPort}` : undefined;
    saveManagedProcess({
      name,
      kind: 'web',
      pid: child.pid,
      url,
      externalUrl,
      logFile: log,
      cwd,
      projectRoot: project.folder,
    });
    return { url, externalUrl, pid: child.pid, background: true, logFile: log };
  }

  // Foreground: stream until ready then keep running (or return url for agents who shouldn't do this)
  let combined = '';
  const runResult = await ctx.exec.run(
    { command: cmd, cwd },
    {
      onLog: (line) => {
        combined += line + '\n';
      },
    },
  );
  const url = scrapeDevServerUrl(combined) || `http://localhost:${usedPort}`;
  return { url, exitCode: runResult.exitCode };
}

async function runNative(ctx: CliContext, platform: CapacitorPlatform): Promise<unknown> {
  const project = await ensureProject(ctx);
  if (!project.hasCapacitorProject(platform)) {
    throw new WnError('PLATFORM_NOT_ADDED', `Platform ${platform} is not added`, {
      exitCode: ExitCode.CommandFailed,
      hint: `Run wn native add ${platform}`,
    });
  }

  const deviceFlag = flagString(ctx.args.flags, 'device');
  const deviceName = flagString(ctx.args.flags, 'device-name');
  const liveReload = flagBool(ctx.args.flags, 'live-reload');
  const noSync = flagBool(ctx.args.flags, 'no-sync');
  const flavor = flagString(ctx.args.flags, 'flavor');
  const prod = flagBool(ctx.args.flags, 'prod');
  const ssl = flagBool(ctx.args.flags, 'ssl');
  const config = flagString(ctx.args.flags, 'config');

  const deviceId = await resolveDeviceId(ctx, platform, deviceFlag, deviceName);

  const result = await capacitorRun(project, platform, {
    liveReload,
    flavor,
    buildForProduction: prod,
    target: deviceId,
    httpsForWeb: ssl,
    syncDone: noSync ? [platform] : [],
    internalAddress: ctx.config.internalAddress,
    createCerts: ssl,
  });

  if (!result) {
    throw new WnError('MISSING_INPUT', 'Unable to build run command (flavor may be required)', {
      exitCode: ExitCode.MissingInput,
      input: 'flavor',
      hint: 'Re-run with --flavor <name>',
    });
  }

  // Substitute target placeholder if present
  let command = typeof result === 'string' ? result : result.command;
  const cwd = typeof result === 'string' ? project.projectFolder() : result.cwd;
  command = command.replace(/\[@target\]/g, deviceId);

  await runCommandResult(ctx, { command, cwd });
  return { platform, device: deviceId, liveReload, config };
}

async function runRun(ctx: CliContext): Promise<unknown> {
  const platform = ctx.args.positionals[0] || ctx.args.command[1];
  if (!platform || !['web', 'ios', 'android'].includes(platform)) {
    // When registered as "run web" etc, positional may be empty
    const name = ctx.commandName;
    if (name === 'run web' || platform === 'web') return runWeb(ctx);
    if (name === 'run ios' || platform === 'ios') return runNative(ctx, CapacitorPlatform.ios);
    if (name === 'run android' || platform === 'android') return runNative(ctx, CapacitorPlatform.android);
    throw usageError('Usage: wn run <web|ios|android>');
  }
  if (platform === 'web') return runWeb(ctx);
  if (platform === 'ios') return runNative(ctx, CapacitorPlatform.ios);
  return runNative(ctx, CapacitorPlatform.android);
}

registerCommand({ name: 'run', description: 'Serve web or launch on a device', run: runRun });
registerCommand({ name: 'run web', description: 'Serve the web app', run: async (ctx) => runWeb(ctx) });
registerCommand({
  name: 'run ios',
  description: 'Run on an iOS device or simulator',
  run: async (ctx) => runNative(ctx, CapacitorPlatform.ios),
});
registerCommand({
  name: 'run android',
  description: 'Run on an Android device or emulator',
  run: async (ctx) => runNative(ctx, CapacitorPlatform.android),
});

export { pidDir, pidFile, logFile };
