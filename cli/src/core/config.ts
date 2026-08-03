import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GlobalOptions } from '../cli/args';

export interface WnConfig {
  defaultPort: number;
  buildForProduction: boolean;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  javaHome?: string;
  androidSdk?: string;
  adbPath?: string;
  shellPath?: string;
  internalAddress: boolean;
  debugBrowser: 'chrome' | 'edge';
  androidDebugWebRoot: 'workspace' | 'www';
  telemetry: boolean;
  run?: {
    ios?: { device?: string };
    android?: { flavor?: string; device?: string };
  };
  check?: {
    ignore?: string[];
    errorOn?: 'error' | 'warning' | 'info';
  };
  [key: string]: unknown;
}

const DEFAULTS: WnConfig = {
  defaultPort: 8100,
  buildForProduction: false,
  internalAddress: false,
  debugBrowser: 'chrome',
  androidDebugWebRoot: 'www',
  telemetry: true,
};

export function globalConfigPath(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'wn', 'config.json');
}

export function projectConfigPath(cwd: string): string {
  return path.join(cwd, 'wn.json');
}

function readJsonFile(file: string): Partial<WnConfig> {
  try {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

export function loadConfig(cwd: string, globalOpts: GlobalOptions): WnConfig {
  const globalCfg = readJsonFile(globalConfigPath());
  const projectCfg = readJsonFile(projectConfigPath(cwd));
  const merged: WnConfig = {
    ...DEFAULTS,
    ...globalCfg,
    ...projectCfg,
  };

  if (globalOpts.packageManager) {
    merged.packageManager = globalOpts.packageManager as WnConfig['packageManager'];
  }
  if (process.env.JAVA_HOME && !merged.javaHome) merged.javaHome = process.env.JAVA_HOME;
  if (process.env.ANDROID_HOME && !merged.androidSdk) merged.androidSdk = process.env.ANDROID_HOME;
  if (process.env.WN_TELEMETRY === '0') merged.telemetry = false;

  return merged;
}

export function saveConfig(file: string, config: Partial<WnConfig>): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const existing = readJsonFile(file);
  const next = { ...existing, ...config };
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
}

export function unsetConfigKey(file: string, key: string): void {
  const existing = readJsonFile(file) as Record<string, unknown>;
  delete existing[key];
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(existing, null, 2) + '\n');
}

export function getConfigDefaults(): WnConfig {
  return { ...DEFAULTS };
}
