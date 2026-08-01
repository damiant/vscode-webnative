import { flagBool } from '../cli/args';
import { CommandResult } from '../build/command-result';
import { capacitorSync } from '../build/capacitor-sync';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { CliContext } from '../core/context';
import { CommandSpec } from '../core/exec';
import { inspectProject } from '../project/inspect';
import { Project } from '../project/project';

export async function ensureProject(ctx: CliContext): Promise<Project> {
  if (ctx.project) return ctx.project;
  const project = await inspectProject(ctx.cwd, ctx.opts.project);
  if (!project.analyzer.hasPackageJson) {
    throw new WnError('NO_PROJECT', 'No supported project found at this location', {
      exitCode: ExitCode.NoProject,
      hint: 'Run from a project root or pass --cwd',
    });
  }
  ctx.project = project;
  return project;
}

/** Alias used by packages/plugins commands. */
export const requireProject = ensureProject;

export function projectFolder(ctx: CliContext): string {
  return ctx.project?.projectFolder() ?? ctx.cwd;
}

export function positional(ctx: CliContext, index = 0): string | undefined {
  return ctx.args.positionals[index];
}

export async function runShell(ctx: CliContext, spec: CommandSpec): Promise<void> {
  await ctx.exec.run(spec);
}

export async function runCommandResult(ctx: CliContext, result: CommandResult, redact?: string[]): Promise<void> {
  if (typeof result === 'string') {
    await runShell(ctx, {
      command: result,
      cwd: ctx.project?.projectFolder() ?? ctx.cwd,
      redact,
    });
    return;
  }
  await runShell(ctx, { command: result.command, cwd: result.cwd, redact });
}

export async function runProjectCommand(
  ctx: CliContext,
  command: CommandResult | string,
  redact?: string[],
): Promise<void> {
  await runCommandResult(ctx, command, redact);
}

export async function runCommandSequence(ctx: CliContext, commands: string[], cwd?: string): Promise<void> {
  let folder = cwd ?? ctx.cwd;
  for (const cmd of commands) {
    if (cmd.startsWith('#')) {
      folder = cmd.slice(1);
      ctx.logger.writeWN(`Folder changed to ${folder}`);
      continue;
    }
    ctx.logger.writeWN(cmd);
    await runShell(ctx, { command: cmd, cwd: folder });
  }
}

export async function maybeCapSync(ctx: CliContext, project: Project): Promise<void> {
  if (!project.isCapacitor || flagBool(ctx.args.flags, 'no-sync')) return;
  if (ctx.opts.dryRun) {
    ctx.logger.write('[dry-run] cap sync');
    return;
  }
  await runCommandResult(ctx, capacitorSync(project));
}

export function stripJsonPrefix(data: string, startChar: string): string {
  const idx = data.indexOf(startChar);
  return idx >= 0 ? data.slice(idx) : data;
}

export async function getProjectOutput(ctx: CliContext, command: string): Promise<string> {
  const project = await ensureProject(ctx);
  return ctx.exec.getOutput({ command, cwd: project.projectFolder() });
}

export function usageError(message: string): WnError {
  return new WnError('USAGE_ERROR', message, { exitCode: ExitCode.UsageError });
}

export async function isGitDirty(folder: string, ctx: CliContext): Promise<boolean> {
  try {
    const out = await ctx.exec.getOutput({ command: 'git status --porcelain', cwd: folder }, { ignoreExitCode: true });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export function requireCleanGit(_folder: string, dirty: boolean): void {
  if (dirty) {
    throw new WnError('DIRTY_GIT', 'Git repository has uncommitted changes. Commit or stash before migrating.', {
      exitCode: ExitCode.CheckFailed,
      hint: 'Commit or stash your changes, then re-run the migration.',
    });
  }
}
