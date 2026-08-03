import {
  AdbOptions,
  Device,
  DeviceState,
  ForwardedSocket,
  ForwardOptions,
  Package,
  Process,
  ShellOptions,
  UnforwardOptions,
  WebView,
  WebViewType,
} from './models';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

export interface AdbConfig {
  adbPath?: string;
  adbArgs?: string[];
  /** Used to resolve relative adb paths (e.g. `./tools/adb`) */
  workspacePath?: string;
}

const forwardedSockets: ForwardedSocket[] = [];
let defaultAdbConfig: AdbConfig = {};

export function setAdbConfig(config: AdbConfig): void {
  defaultAdbConfig = config;
}

export function getAdbConfig(): AdbConfig {
  return defaultAdbConfig;
}

function mergeConfig(config?: AdbConfig): AdbConfig {
  return { ...defaultAdbConfig, ...config };
}

export async function androidDebugUnforward(config?: AdbConfig): Promise<void> {
  const merged = mergeConfig(config);
  const promises: Promise<any>[] = [];

  for (const socket of forwardedSockets) {
    const promise = unforward(
      {
        executable: getAdbExecutable(merged),
        arguments: getAdbArguments(merged),
        local: socket.local,
      },
      merged,
    );
    promises.push(
      promise.catch(() => {
        /* Ignore */
      }),
    );
  }

  await Promise.all(promises);

  forwardedSockets.splice(0);
}

export async function forwardDebugger(application: WebView, port?: number, config?: AdbConfig): Promise<number> {
  const merged = mergeConfig(config);

  if (port) {
    const idx = forwardedSockets.findIndex((el) => el.local === `tcp:${port}`);
    if (idx >= 0) {
      forwardedSockets.splice(idx, 1);

      try {
        await unforward(
          {
            executable: getAdbExecutable(merged),
            arguments: getAdbArguments(merged),
            local: `tcp:${port}`,
          },
          merged,
        );
      } catch {
        // Ignore
      }
    }
  }

  const socket = await forward(
    {
      executable: getAdbExecutable(merged),
      arguments: getAdbArguments(merged),
      serial: application.device.serial,
      local: `tcp:${port || 0}`,
      remote: `localabstract:${application.socket}`,
    },
    merged,
  );

  forwardedSockets.push(socket);

  return parseInt(socket.local.substr(4), 10);
}

export async function findDevices(config?: AdbConfig): Promise<Device[]> {
  const merged = mergeConfig(config);
  return await devices(
    {
      executable: getAdbExecutable(merged),
      arguments: getAdbArguments(merged),
    },
    merged,
  );
}

export async function verifyAndroidDebugBridge(config?: AdbConfig): Promise<void> {
  const merged = mergeConfig(config);
  try {
    await version(
      {
        executable: getAdbExecutable(merged),
        arguments: getAdbArguments(merged),
      },
      merged,
    );
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      throw new Error('Cant find ADB executable.');
    }

    throw err;
  }
}

function adb(options: AdbOptions, config: AdbConfig, ...args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let outBuff = Buffer.alloc(0);
    let errBuff = Buffer.alloc(0);

    const proc = spawn(options.executable, [...options.arguments, ...args]);

    proc.stdout.on('data', (data) => {
      outBuff = Buffer.concat([outBuff, Buffer.from(data)]);
    });
    proc.stderr.on('data', (data) => {
      errBuff = Buffer.concat([errBuff, Buffer.from(data)]);
    });

    proc.on('error', (err) => {
      reject(err);
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(errBuff.toString('utf8')));
      }

      resolvePromise(outBuff.toString('utf8'));
    });
  });
}

async function version(options: AdbOptions, config: AdbConfig): Promise<string> {
  return await adb(options, config, 'version');
}

async function devices(options: AdbOptions, config: AdbConfig): Promise<Device[]> {
  const output = await adb(options, config, 'devices', '-l');

  const result: Device[] = [];

  const regex =
    /^([a-zA-Z0-9_-]+(?:\s?[.a-zA-Z0-9_-]+)?(?::\d{1,})?)\s+(device|connecting|offline|unknown|bootloader|recovery|download|unauthorized|host|no permissions)(?:\s+usb:([^:]+))?(?:\s+product:([^:]+))?(?:\s+model:([\S]+))?(?:\s+device:([\S]+))?(?:\s+features:([^:]+))?(?:\s+transport_id:([^:]+))?$/gim;
  let match: any[];
  while ((match = regex.exec(output)) !== null) {
    result.push({
      serial: match[1],
      state: match[2] as DeviceState,
      usb: match[3],
      product: match[4],
      model: match[5],
      device: match[6],
      features: match[7],
      transportId: match[8],
    });
  }

  return result;
}

export async function findWebViews(device: Device, config?: AdbConfig): Promise<WebView[]> {
  const merged = mergeConfig(config);
  const [sockets, processes, packages] = await Promise.all([
    getSockets(device.serial, merged),
    getProcesses(device.serial, merged),
    getPackages(device.serial, merged),
  ]);

  const result: WebView[] = [];

  for (const socket of sockets) {
    let type: WebViewType;
    let packageName: string | undefined;
    let versionName: string | undefined;

    if (socket === 'chrome_devtools_remote') {
      type = WebViewType.chrome;
      packageName = 'com.android.chrome';
    } else if (socket.startsWith('webview_devtools_remote_')) {
      type = WebViewType.webview;

      const pid = parseInt(socket.substr(24), 10);
      if (!isNaN(pid)) {
        const proc = processes.find((el) => el.pid === pid);
        if (proc) {
          packageName = proc.name;
        }
      }
    } else if (socket.endsWith('_devtools_remote')) {
      type = WebViewType.crosswalk;
      packageName = socket.substring(0, socket.length - 16) || undefined;
    } else {
      type = WebViewType.unknown;
    }

    if (packageName) {
      const aPackage = packages.find((el) => el.packageName === packageName);
      if (aPackage) {
        versionName = aPackage.versionName;
      }
    }

    result.push({
      device: device,
      socket: socket,
      type: type,
      packageName: packageName,
      versionName: versionName,
    });
  }

  return result;
}

async function shell(options: ShellOptions, config: AdbConfig): Promise<string> {
  return await adb(options, config, '-s', options.serial, 'shell', options.command);
}

async function forward(options: ForwardOptions, config: AdbConfig): Promise<ForwardedSocket> {
  const output = await adb(options, config, '-s', options.serial, 'forward', options.local, options.remote);

  if (options.local === 'tcp:0') {
    return {
      local: `tcp:${parseInt(output.trim(), 10)}`,
      remote: options.remote,
    };
  } else {
    return {
      local: options.local,
      remote: options.remote,
    };
  }
}

async function unforward(options: UnforwardOptions, config: AdbConfig): Promise<void> {
  await adb(options, config, 'forward', '--remove', options.local);
}

function getAdbArguments(config: AdbConfig): string[] {
  return config.adbArgs ?? [];
}

function getAdbExecutable(config: AdbConfig): string {
  if (config.adbPath) {
    return resolvePath(config.adbPath, config.workspacePath);
  }

  if (process.platform !== 'win32') {
    const adbDefault = '~/Library/Android/sdk/platform-tools/adb';
    if (existsSync(resolvePath(adbDefault, config.workspacePath))) {
      return resolvePath(adbDefault, config.workspacePath);
    }
  } else {
    const winAdb = join(process.env['LOCALAPPDATA'], 'Android', 'SDK', 'platform-tools', 'adb.exe');
    if (existsSync(resolvePath(winAdb, config.workspacePath))) {
      return resolvePath(winAdb, config.workspacePath);
    }
  }

  return 'adb';
}

function resolvePath(from: string, workspacePath?: string): string {
  const substituted = from.replace(/(?:^(~|\.{1,2}))(?=\/)|\$(\w+)/g, (_, tilde?: string, env?: string) => {
    if (env) return process.env[env] ?? '';

    if (tilde === '~') return homedir();

    const fsPath = workspacePath;
    if (!fsPath) return '';

    if (tilde === '.') return fsPath;

    if (tilde === '..') return fsPath + '/..';

    return '';
  });

  if (substituted.includes('/')) {
    return resolve(substituted);
  } else {
    return substituted;
  }
}

async function getSockets(serial: string, config: AdbConfig): Promise<string[]> {
  const output = await shell(
    {
      executable: getAdbExecutable(config),
      arguments: getAdbArguments(config),
      serial: serial,
      command: 'cat /proc/net/unix',
    },
    config,
  );

  const result: string[] = [];

  for (const line of output.split(/[\r\n]+/g)) {
    const columns = line.split(/\s+/g);
    if (columns.length < 8) {
      continue;
    }

    if (columns[3] !== '00010000' || columns[5] !== '01') {
      continue;
    }

    const colPath = columns[7];
    if (!colPath.startsWith('@') || !colPath.includes('_devtools_remote')) {
      continue;
    }

    result.push(colPath.substr(1));
  }

  return result;
}

async function getProcesses(serial: string, config: AdbConfig): Promise<Process[]> {
  const output = await shell(
    {
      executable: getAdbExecutable(config),
      arguments: getAdbArguments(config),
      serial: serial,
      command: 'ps',
    },
    config,
  );

  const result: Process[] = [];

  for (const line of output.split(/[\r\n]+/g)) {
    const columns = line.split(/\s+/g);
    if (columns.length < 9) {
      continue;
    }

    const pid = parseInt(columns[1], 10);
    if (isNaN(pid)) {
      continue;
    }

    result.push({
      pid: pid,
      name: columns[8],
    });
  }

  return result;
}

async function getPackages(serial: string, config: AdbConfig): Promise<Package[]> {
  const output = await shell(
    {
      executable: getAdbExecutable(config),
      arguments: getAdbArguments(config),
      serial: serial,
      command: 'dumpsys package packages',
    },
    config,
  );

  const result: Package[] = [];

  let packageName: string | undefined;

  for (const line of output.split(/[\r\n]+/g)) {
    const columns = line.trim().split(/\s+/g);

    if (!packageName) {
      if (columns[0] === 'Package') {
        packageName = columns[1].substring(1, columns[1].length - 1);
      }
    } else {
      if (columns[0].startsWith('versionName=')) {
        result.push({
          packageName: packageName,
          versionName: columns[0].substr(12),
        });

        packageName = undefined;
      }
    }
  }

  return result;
}
