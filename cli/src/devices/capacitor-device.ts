import { replaceAll } from '../core/text';

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'device' | 'simulator' | 'emulator';
  os?: string;
  api?: number;
}

export type RunCommandCallback = (command: string, rootPath: string) => Promise<string>;

/**
 * Runs a command callback and parses stdout for connected devices/simulators.
 */
export async function listDevices(
  command: string,
  rootPath: string,
  runCommand: RunCommandCallback,
): Promise<DeviceInfo[]> {
  return getDevices(command, rootPath, runCommand);
}

/**
 * Runs the command and obtains the stdout, parses it for the list of device names and target ids
 * @param  {string} command Node command which gathers device list
 * @param  {string} rootPath Path where the node command runs
 */
export async function getDevices(
  command: string,
  rootPath: string,
  runCommand: RunCommandCallback,
): Promise<DeviceInfo[]> {
  const result = await runCommand(command, rootPath);

  const lines = result.split('\n');
  lines.shift(); // Remove the header
  const devices: DeviceInfo[] = [];
  for (const line of lines) {
    const data = line.split('|');
    if (data.length == 3) {
      const target = data[2].trim();
      if (target != '?') {
        const rawName = data[0].trim() + ' ' + data[1].trim();
        devices.push(toDeviceInfo(friendlyName(rawName), target));
      }
    } else {
      const device = parseDevice(line);
      if (device) {
        devices.push(device);
      }
    }
  }
  return devices;
}

export function parseDevice(line: string): DeviceInfo | undefined {
  try {
    const name = line.substring(0, line.indexOf('  ')).trim();
    line = line.substring(line.indexOf('  ')).trim();
    const args = line.replace('  ', '|').split('|');
    const target = args[1].trim();
    if (target == '?') {
      return undefined;
    }
    const osLabel = replaceSDKLevel(args[0].trim());
    return toDeviceInfo(name + ' ' + osLabel, target);
  } catch {
    return undefined;
  }
}

export function friendlyName(name: string): string {
  function fix(api: string, v: string) {
    if (name.includes(`API ${api}`)) {
      name = replaceAll(name, `API ${api}`, '').trim() + ` (Android ${v})`;
    }
  }
  fix('35', '15');
  fix('34', '14');
  fix('33', '13');
  fix('32', '12');
  fix('31', '12');
  fix('30', '11');
  fix('29', '10');
  fix('28', '9');
  fix('27', '8');
  fix('26', '8');
  fix('25', '7');
  fix('24', '7');
  fix('23', '6');
  fix('22', '5');
  fix('21', '5');
  name = name.replace(' (emulator)', 'Emulator');
  return name;
}

function toDeviceInfo(name: string, id: string): DeviceInfo {
  const lower = name.toLowerCase();
  let type: DeviceInfo['type'] = 'device';
  if (lower.includes('simulator')) {
    type = 'simulator';
  } else if (lower.includes('emulator')) {
    type = 'emulator';
  }

  let os: string | undefined;
  let api: number | undefined;

  const androidMatch = name.match(/Android\s+([\d.]+)/i);
  if (androidMatch) {
    os = 'android';
    const apiMatch = name.match(/API\s+(\d+)/i);
    if (apiMatch) api = parseInt(apiMatch[1], 10);
  } else if (lower.includes('simulator') || lower.includes('iphone') || lower.includes('ipad')) {
    os = 'ios';
  }

  const cleanName = name
    .replace(/\(simulator\)/gi, '')
    .replace(/\(emulator\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { id, name: cleanName, type, os, api };
}

function replaceSDKLevel(sdk: string): string {
  switch (sdk) {
    case 'API 34':
      return 'Android 14';
    case 'API 33':
      return 'Android 13';
    case 'API 32':
    case 'API 31':
      return 'Android 12';
    case 'API 30':
      return 'Android 11';
    case 'API 29':
      return 'Android 10';
    case 'API 28':
      return 'Android 9';
    case 'API 27':
      return 'Android 8.1';
    case 'API 26':
      return 'Android 8.0';
    default:
      return sdk;
  }
}
