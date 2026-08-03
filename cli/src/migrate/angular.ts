import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { coerce } from 'semver';
import { npx, npmInstall, commandContext } from '../build/node-commands';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { Project } from '../project/project';

export const maxAngularVersion = '22';

export interface AngularMigrationPlan {
  version: number;
  commands: string[];
}

export function nextAngularVersion(project: Project): number | undefined {
  const current = project.analyzer.getPackageVersion('@angular/core');
  const max = coerce(maxAngularVersion);
  if (!current || !max || current.major >= max.major) return undefined;
  return current.major + 1;
}

export function resolveAngularTarget(project: Project, target?: string, all?: boolean): number {
  const current = project.analyzer.getPackageVersion('@angular/core');
  if (!current) {
    throw new WnError('NOT_APPLICABLE', 'This project does not use Angular.', { exitCode: ExitCode.CommandFailed });
  }
  if (all) {
    const max = coerce(maxAngularVersion);
    if (!max)
      throw new WnError('NOT_APPLICABLE', 'Unable to determine target Angular version.', {
        exitCode: ExitCode.CommandFailed,
      });
    return max.major;
  }
  if (target) {
    const v = Number(target);
    if (!Number.isFinite(v) || v <= current.major) {
      throw new WnError('MISSING_INPUT', `Angular ${target} is not a valid upgrade target from v${current.major}.`, {
        exitCode: ExitCode.MissingInput,
        hint: 'Re-run with --to <major>',
      });
    }
    return v;
  }
  const next = nextAngularVersion(project);
  if (!next) {
    throw new WnError('NOT_APPLICABLE', 'No Angular migration is available for this project.', {
      exitCode: ExitCode.CommandFailed,
    });
  }
  return next;
}

export function planAngularMigration(project: Project, version: number): AngularMigrationPlan {
  const ctx = commandContext(project);
  const commands = [`${npx(project)} ng update @angular/cli@${version} @angular/core@${version} --allow-dirty --force`];
  if (project.analyzer.exists('@angular/cdk')) {
    commands.push(npmInstall(`@angular/cdk@${version}`, ctx, '--force'));
  }
  if (project.analyzer.exists('@angular/pwa')) {
    commands.push(npmInstall(`@angular/pwa@${version}`, ctx, '--force'));
  }
  const eslintPackages = project.analyzer
    .getAllPackageNames()
    .filter((d) => d.startsWith('@angular-eslint/'))
    .map((d) => `${d}@${version}`);
  if (eslintPackages.length > 0) {
    commands.push(npmInstall(eslintPackages.join(' '), ctx, '--force'));
  }
  return { version, commands };
}

export async function ensureValidDependencies(
  project: Project,
  run: (command: string, folder: string) => Promise<string>,
  reinstall: () => Promise<void>,
): Promise<void> {
  const folder = project.projectFolder();
  if (!existsSync(join(folder, 'node_modules'))) return;
  try {
    await run('npm ls --depth=0', folder);
  } catch {
    await reinstall();
    try {
      await run('npm ls --depth=0', folder);
    } catch {
      throw new WnError(
        'PRECONDITION_FAILED',
        'Dependencies are invalid after reinstall. Fix package.json and try again.',
        {
          exitCode: ExitCode.CheckFailed,
        },
      );
    }
  }
}

export function applyAngularPostFixes(project: Project, version: number): string[] {
  const changed: string[] = [];
  if (version === 17) {
    const polyfills = join(project.projectFolder(), 'src', 'polyfills.ts');
    if (replaceInFile(polyfills, `import 'zone.js/dist/zone';`, `import 'zone.js';`)) changed.push(polyfills);
  }
  return changed;
}

function replaceInFile(filename: string, search: string, replace: string): boolean {
  if (!existsSync(filename)) return false;
  const before = readFileSync(filename, 'utf8');
  const after = before.replace(search, replace);
  if (before === after) return false;
  writeFileSync(filename, after);
  return true;
}
