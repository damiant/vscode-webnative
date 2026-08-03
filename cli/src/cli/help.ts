import { listCommands } from './registry';

export function printRootHelp(): void {
  const cmds = listCommands();
  const lines = [
    'WebNative CLI (wn)',
    '',
    'Usage: wn <command> [options]',
    '',
    'Global options:',
    '  --cwd <path>              Workspace root',
    '  --project <name>          Monorepo sub-project',
    '  --json                    Machine-readable JSON on stdout',
    '  --stream-json             NDJSON progress events + final envelope',
    '  --yes, -y                 Accept confirmations',
    '  --no-input                Never prompt',
    '  --dry-run                 Print commands without running',
    '  --verbose, -v             Show underlying shell commands',
    '  --quiet, -q               Suppress progress',
    '  --no-color                Disable ANSI color',
    '  --package-manager <pm>    npm | pnpm | yarn | bun',
    '  --timeout <seconds>       Abort after N seconds',
    '  --help, -h                Show help',
    '  --version                 Show version',
    '',
    'Commands:',
  ];
  for (const c of cmds) {
    lines.push(`  ${c.name.padEnd(28)} ${c.description}`);
  }
  lines.push('');
  lines.push('See cli/docs.md for the full specification.');
  process.stdout.write(lines.join('\n') + '\n');
}

export function printCommandHelp(name: string, description: string): void {
  process.stdout.write(`wn ${name}\n\n${description}\n\nRun with --json for machine-readable output.\n`);
}
