export interface GlobalOptions {
  cwd: string;
  project?: string;
  json: boolean;
  streamJson: boolean;
  yes: boolean;
  noInput: boolean;
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  noColor: boolean;
  packageManager?: string;
  timeout?: number;
  help: boolean;
  version: boolean;
}

export interface ParsedArgs {
  global: GlobalOptions;
  /** All non-flag tokens before `--` */
  tokens: string[];
  flags: Record<string, string | boolean | string[]>;
  passthrough: string[];
  /** @deprecated use tokens — kept for compatibility during resolve */
  command: string[];
  positionals: string[];
}

const GLOBAL_FLAGS_WITH_VALUE = new Set(['cwd', 'project', 'package-manager', 'timeout']);
const GLOBAL_FLAGS_BOOL = new Set([
  'json',
  'stream-json',
  'yes',
  'y',
  'no-input',
  'dry-run',
  'verbose',
  'v',
  'quiet',
  'q',
  'no-color',
  'help',
  'h',
  'version',
]);

function envFlag(name: string): boolean {
  const v = process.env[name];
  return v === '1' || v === 'true';
}

export function createDefaultGlobalOptions(): GlobalOptions {
  return {
    cwd: process.cwd(),
    project: process.env.WN_PROJECT,
    json: envFlag('WN_JSON'),
    streamJson: false,
    yes: false,
    noInput: envFlag('WN_NO_INPUT'),
    dryRun: false,
    verbose: false,
    quiet: false,
    noColor: !!process.env.NO_COLOR,
    packageManager: process.env.WN_PACKAGE_MANAGER,
    timeout: undefined,
    help: false,
    version: false,
  };
}

function takeValue(argv: string[], i: number): { value: string; next: number } {
  const current = argv[i];
  const eq = current.indexOf('=');
  if (eq !== -1) {
    return { value: current.slice(eq + 1), next: i };
  }
  const next = argv[i + 1];
  if (next == null || next.startsWith('-')) {
    throw new Error(`Missing value for ${current.split('=')[0]}`);
  }
  return { value: next, next: i + 1 };
}

function flagName(raw: string): string {
  const withoutEq = raw.includes('=') ? raw.slice(0, raw.indexOf('=')) : raw;
  if (withoutEq.startsWith('--')) return withoutEq.slice(2);
  if (withoutEq.startsWith('-')) return withoutEq.slice(1);
  return withoutEq;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const global = createDefaultGlobalOptions();
  const flags: Record<string, string | boolean | string[]> = {};
  const tokens: string[] = [];
  const passthrough: string[] = [];

  let i = 0;
  let inPassthrough = false;

  while (i < argv.length) {
    const arg = argv[i];

    if (inPassthrough) {
      passthrough.push(arg);
      i++;
      continue;
    }

    if (arg === '--') {
      inPassthrough = true;
      i++;
      continue;
    }

    if (arg.startsWith('-')) {
      const name = flagName(arg);

      if (GLOBAL_FLAGS_BOOL.has(name)) {
        applyGlobal(global, name, true);
        i++;
        continue;
      }

      if (GLOBAL_FLAGS_WITH_VALUE.has(name)) {
        const { value, next } = takeValue(argv, i);
        applyGlobal(global, name, value);
        i = next + 1;
        continue;
      }

      // Command-specific flag
      if (arg.includes('=') || (argv[i + 1] && !argv[i + 1].startsWith('-'))) {
        const { value, next } = takeValue(argv, i);
        const existing = flags[name];
        if (existing === undefined) flags[name] = value;
        else if (Array.isArray(existing)) existing.push(value);
        else flags[name] = [String(existing), value];
        i = next + 1;
      } else {
        flags[name] = true;
        i++;
      }
      continue;
    }

    tokens.push(arg);
    i++;
  }

  if (global.json) {
    global.noInput = true;
    global.noColor = true;
  }

  return {
    global,
    tokens,
    flags,
    passthrough,
    command: tokens.slice(0, 1),
    positionals: tokens.slice(1),
  };
}

function applyGlobal(global: GlobalOptions, name: string, value: string | boolean): void {
  switch (name) {
    case 'cwd':
      global.cwd = String(value);
      break;
    case 'project':
      global.project = String(value);
      break;
    case 'json':
      global.json = true;
      break;
    case 'stream-json':
      global.streamJson = true;
      break;
    case 'yes':
    case 'y':
      global.yes = true;
      break;
    case 'no-input':
      global.noInput = true;
      break;
    case 'dry-run':
      global.dryRun = true;
      break;
    case 'verbose':
    case 'v':
      global.verbose = true;
      break;
    case 'quiet':
    case 'q':
      global.quiet = true;
      break;
    case 'no-color':
      global.noColor = true;
      break;
    case 'package-manager':
      global.packageManager = String(value);
      break;
    case 'timeout':
      global.timeout = Number(value);
      break;
    case 'help':
    case 'h':
      global.help = true;
      break;
    case 'version':
      global.version = true;
      break;
  }
}

export function flagBool(flags: Record<string, string | boolean | string[]>, name: string): boolean {
  const v = flags[name];
  return v === true || v === 'true';
}

export function flagString(flags: Record<string, string | boolean | string[]>, name: string): string | undefined {
  const v = flags[name];
  if (v === undefined || typeof v === 'boolean') return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function flagStringArray(flags: Record<string, string | boolean | string[]>, name: string): string[] {
  const v = flags[name];
  if (v === undefined || typeof v === 'boolean') return [];
  return Array.isArray(v) ? v : [v];
}
