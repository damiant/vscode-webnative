import { InternalCommand } from '../build/command-name';
import { PackageManager } from '../build/node-commands';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { Project } from '../project/project';

export type TargetPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface PackageManagerMigrationPlan {
  target: TargetPackageManager;
  commands: string[];
}

export function planPackageManagerMigration(
  project: Project,
  target: TargetPackageManager,
): PackageManagerMigrationPlan {
  const current = project.packageManager;
  if (current === PackageManager[target]) {
    throw new WnError('NOT_APPLICABLE', `Project already uses ${target}.`, { exitCode: ExitCode.CommandFailed });
  }

  switch (target) {
    case 'pnpm':
      if (current !== PackageManager.npm && current !== PackageManager.bun) {
        throw new WnError('NOT_APPLICABLE', 'pnpm migration is supported from npm projects.', {
          exitCode: ExitCode.CommandFailed,
        });
      }
      return {
        target,
        commands: cwd(['pnpm -v', removeNodeModules(), 'pnpm import', 'pnpm install', 'rm package-lock.json']),
      };
    case 'bun':
      if (current !== PackageManager.npm) {
        throw new WnError('NOT_APPLICABLE', 'bun migration is supported from npm projects.', {
          exitCode: ExitCode.CommandFailed,
        });
      }
      return {
        target,
        commands: cwd(['bun -v', removeNodeModules(), 'bun install', 'rm package-lock.json']),
      };
    case 'npm':
      return {
        target,
        commands: cwd([removeNodeModules(), 'npm install', 'rm pnpm-lock.yaml', 'rm bun.lockb', 'rm yarn.lock']),
      };
    case 'yarn':
      return {
        target,
        commands: cwd([removeNodeModules(), 'yarn install', 'rm package-lock.json']),
      };
    default:
      throw new WnError('USAGE_ERROR', `Unsupported package manager: ${target}`, { exitCode: ExitCode.UsageError });
  }
}

function removeNodeModules(): string {
  return process.platform === 'win32' ? 'del node_modules /S /Q' : 'rm -rf node_modules';
}

function cwd(commands: string[]): string[] {
  return commands.map((command) => `${InternalCommand.cwd}${command}`);
}
