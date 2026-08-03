import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { InternalCommand } from './command-name';

export type CommandResult = string | { command: string; cwd: string };

export function needsMonorepoCwd(project: Project): boolean {
  switch (project.repoType) {
    case MonoRepoType.npm:
    case MonoRepoType.bun:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
    case MonoRepoType.folder:
      return true;
    default:
      return false;
  }
}

/** Strip [@cwd] tokens and return a CommandResult with cwd when appropriate. */
export function finalizeCommand(project: Project, command: string): CommandResult {
  const hadCwd = command.includes(InternalCommand.cwd);
  const cleaned = command.split(InternalCommand.cwd).join('');
  if (hadCwd || needsMonorepoCwd(project)) {
    return { command: cleaned, cwd: project.projectFolder() };
  }
  return cleaned;
}

export function commandString(result: CommandResult): string {
  return typeof result === 'string' ? result : result.command;
}
