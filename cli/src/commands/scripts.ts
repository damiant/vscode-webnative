import { registerCommand } from '../cli/registry';
import { listScripts } from '../build/scripts';
import { commandContext, npmRun } from '../build/node-commands';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { CliContext } from '../core/context';
import { ensureProject, runShell, usageError } from './helpers';

async function runScriptsList(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const scripts = listScripts(project, true);
  return {
    scripts: scripts.map((s) => ({ name: s.name, command: s.command, description: s.description })),
  };
}

async function runScriptsRun(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const name = ctx.args.positionals[0];
  if (!name) throw usageError('Usage: wn scripts run <name>');

  const pkgScripts = project.analyzer.getPackageFile()?.scripts || {};
  // listScripts nice-names scripts; accept either nice name or raw script key
  const rawKey =
    Object.keys(pkgScripts).find((k) => k === name) ||
    Object.keys(pkgScripts).find((k) => k.replace(/-/g, ' ').toLowerCase() === name.toLowerCase());

  if (!rawKey) {
    throw new WnError('UNKNOWN_SCRIPT', `Unknown script: ${name}`, {
      exitCode: ExitCode.UsageError,
      input: 'script',
      choices: Object.keys(pkgScripts).map((id) => ({ id, name: id })),
      hint: 'Re-run with a script from wn scripts list',
    });
  }

  const cmd = npmRun(rawKey, commandContext(project));
  const extra = ctx.args.passthrough.length ? ' -- ' + ctx.args.passthrough.join(' ') : '';
  await runShell(ctx, { command: cmd + extra, cwd: project.projectFolder() });
  return { script: rawKey };
}

registerCommand({
  name: 'scripts',
  description: 'List package.json scripts',
  run: runScriptsList,
});

registerCommand({
  name: 'scripts list',
  description: 'List package.json scripts',
  run: runScriptsList,
});

registerCommand({
  name: 'scripts run',
  description: 'Run a package.json script',
  run: runScriptsRun,
});
