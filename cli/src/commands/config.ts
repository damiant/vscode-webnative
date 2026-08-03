import { flagBool } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { registerCommand } from '../cli/registry';
import { getRootCACertPath, liveReloadSSL } from '../build/live-reload';
import {
  getConfigDefaults,
  globalConfigPath,
  loadConfig,
  projectConfigPath,
  saveConfig,
  unsetConfigKey,
  WnConfig,
} from '../core/config';
import { CliContext } from '../core/context';
import { Project } from '../project/project';
import { ensureProject, positional, usageError } from './helpers';

const CONFIG_KEYS: (keyof WnConfig)[] = [
  'defaultPort',
  'buildForProduction',
  'packageManager',
  'javaHome',
  'androidSdk',
  'adbPath',
  'shellPath',
  'internalAddress',
  'debugBrowser',
  'androidDebugWebRoot',
  'telemetry',
];

function configFile(ctx: CliContext, global: boolean): string {
  return global ? globalConfigPath() : projectConfigPath(ctx.cwd);
}

function parseConfigValue(key: string, raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  const num = Number(raw);
  if (!Number.isNaN(num) && ['defaultPort'].includes(key)) return num;
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function getNestedValue(config: WnConfig, key: string): unknown {
  if (key.includes('.')) {
    const parts = key.split('.');
    let cur: any = config;
    for (const part of parts) {
      cur = cur?.[part];
    }
    return cur;
  }
  return config[key];
}

async function runConfigList(ctx: CliContext): Promise<unknown> {
  const globalCfg = loadConfig(ctx.cwd, ctx.opts);
  const defaults = getConfigDefaults();
  return {
    project: projectConfigPath(ctx.cwd),
    global: globalConfigPath(),
    values: globalCfg,
    defaults,
    keys: CONFIG_KEYS,
  };
}

async function runConfigGet(ctx: CliContext): Promise<unknown> {
  const key = positional(ctx, 0);
  if (!key) throw usageError('Usage: wn config get <key>');
  const config = loadConfig(ctx.cwd, ctx.opts);
  const value = getNestedValue(config, key);
  if (value === undefined) {
    throw new WnError('UNKNOWN_KEY', `Unknown config key: ${key}`, { exitCode: ExitCode.UsageError });
  }
  return { key, value };
}

async function runConfigSet(ctx: CliContext): Promise<unknown> {
  const key = positional(ctx, 0);
  const valueRaw = positional(ctx, 1);
  if (!key || valueRaw === undefined) throw usageError('Usage: wn config set <key> <value> [--global]');
  const global = flagBool(ctx.args.flags, 'global');
  const file = configFile(ctx, global);
  const value = parseConfigValue(key, valueRaw);
  if (!ctx.opts.dryRun) {
    saveConfig(file, { [key]: value } as Partial<WnConfig>);
  }
  return { key, value, file, global };
}

async function runConfigUnset(ctx: CliContext): Promise<unknown> {
  const key = positional(ctx, 0);
  if (!key) throw usageError('Usage: wn config unset <key> [--global]');
  const global = flagBool(ctx.args.flags, 'global');
  const file = configFile(ctx, global);
  if (!ctx.opts.dryRun) {
    unsetConfigKey(file, key);
  }
  return { key, file, global };
}

async function runConfigSslCreate(ctx: CliContext): Promise<unknown> {
  let folder = ctx.cwd;
  try {
    const project = await ensureProject(ctx);
    folder = project.projectFolder();
  } catch {
    /* ssl can be created without a project */
  }
  const stub = { folder } as Project;
  if (!ctx.opts.dryRun) {
    await liveReloadSSL(stub);
  } else {
    ctx.logger.write('[dry-run] create SSL certificates for live reload');
  }
  return {
    caCertPath: getRootCACertPath(),
    certDir: getRootCACertPath().replace(/ca\.crt$/, ''),
    hint: 'Trust the root CA certificate on devices for HTTPS live reload',
  };
}

async function runConfig(ctx: CliContext): Promise<unknown> {
  const sub = positional(ctx, 0);
  switch (sub) {
    case 'list':
      return runConfigList(ctx);
    case 'get':
      return runConfigGet(ctx);
    case 'set':
      return runConfigSet(ctx);
    case 'unset':
      return runConfigUnset(ctx);
    case 'ssl':
      if (positional(ctx, 1) === 'create') {
        return runConfigSslCreate(ctx);
      }
      throw usageError('Usage: wn config ssl create');
    default:
      throw usageError('Usage: wn config <list|get|set|unset|ssl create>');
  }
}

export function registerConfigCommand(): void {
  registerCommand({
    name: 'config',
    description: 'Read and write CLI settings',
    noProject: true,
    run: runConfig,
  });
  registerCommand({
    name: 'config ssl create',
    description: 'Generate SSL certificates for HTTPS live reload',
    noProject: true,
    run: runConfigSslCreate,
  });
}
