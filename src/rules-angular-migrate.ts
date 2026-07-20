import { exists, getAllPackageNames, getPackageVersion, isGreaterOrEqual, isLess } from './analyzer';
import { QueueFunction, Tip, TipType } from './tip';
import { coerce } from 'semver';
import { npmInstall, npmInstallAll, npx } from './node-commands';
import { removeNodeModules, runCommands } from './advanced-actions';
import { Project, inspectProject } from './project';
import { commands, window } from 'vscode';
import { openUri, getRunOutput } from './utilities';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { write, writeError } from './logging';
import { join } from 'path';
import { updateBrowserslist } from './browserslist';
import { fixDeprecatedTsconfigOptions } from './rules-typescript-config';
import { CommandName, InternalCommand } from './command-name';
import { exState } from './tree-provider';
import { MonoRepoType } from './monorepo';

// Maximum supported Angular version that we'll suggest migrating to
export const maxAngularVersion = '22';

export function addAngularMigrationRecommendation(project: Project): void {
  if (!isGreaterOrEqual('@angular/core', '12.0.0')) {
    return;
  }
  if (!isLess('@angular/core', `${maxAngularVersion}.0.0`)) {
    return;
  }
  const tip = angularMigrate(project, maxAngularVersion);
  if (tip) {
    project.add(tip);
  }
}

export function angularMigrate(project: Project, latestVersion?: string): Tip | undefined {
  const current = getPackageVersion('@angular/core');
  const max = coerce(latestVersion || maxAngularVersion);
  if (!current || !max) {
    return;
  }
  // Do not offer migrations beyond the highest version we support
  if (current.major > max.major) {
    return;
  }

  // Prefer the next major when available; otherwise stay on the current major so
  // the light bulb can still offer "Update to latest v{current}".
  const next = current.major < max.major ? current.major + 1 : current.major;
  const title = next > current.major ? `Migrate to Angular ${next}` : `Update Angular ${current.major}`;
  return new Tip(title, '', TipType.Angular).setQueuedAction(migrate, project, next, current.major, current.version);
}

async function migrate(queueFunction: QueueFunction, project: Project, next: number, current: number, now: string) {
  const canMigrateToNext = next > current;
  const nextButton = `Update to v${next}`;
  const currentButton = `Update to latest v${current}`;
  const infoButton = 'Info';
  const message = canMigrateToNext
    ? `Would you like to migrate from Angular ${now} to ${next}? This will use 'ng update': Make sure you have committed your code before you begin.`
    : `Would you like to update to the latest Angular ${current}? This will use 'ng update': Make sure you have committed your code before you begin.`;

  const result = canMigrateToNext
    ? await window.showInformationMessage(message, infoButton, currentButton, nextButton)
    : await window.showInformationMessage(message, infoButton, currentButton);
  if (!result) return;
  switch (result) {
    case infoButton:
      openUri('https://angular.io/cli/update');
      break;
    case currentButton:
      await migrateTo(queueFunction, current, project);
      break;
    case nextButton:
      await migrateTo(queueFunction, next, project);
      break;
  }

  async function migrateTo(queueFunction: QueueFunction, version: number, project: Project) {
    exState.isAngularMigrating = true;
    try {
      queueFunction();

      if (!(await confirmMonoRepoAngularProjects(project))) {
        return;
      }
      if (!(await confirmGitClean(project))) {
        return;
      }
      if (!(await ensureValidDependencies(project))) {
        return;
      }

      const commands = [
        `${npx(project)} ng update @angular/cli@${version} @angular/core@${version} --allow-dirty --force`,
      ];
      if (exists('@angular/cdk')) {
        commands.push(npmInstall(`@angular/cdk@${version}`, '--force'));
      }
      if (exists('@angular/pwa')) {
        commands.push(npmInstall(`@angular/pwa@${version}`, '--force'));
      }
      const dependencies = getAllPackageNames();
      const list = [];
      for (const dependency of dependencies) {
        if (dependency.startsWith('@angular-eslint/')) {
          list.push(`${dependency}@${version}`);
        }
      }
      if (list.length > 0) {
        commands.push(npmInstall(list.join(' '), '--force'));
      }
      const success = await runCommands(commands, `Migrating to Angular ${version}`, project);
      postFixes(project, version);
      if (!success) {
        return;
      }
      await refreshProject(project);
      logOptionalMigrations(version);
      await suggestOtherAngularMigrations(project, version);
      window.showInformationMessage(
        `Angular ${version} migration is complete. Review the changes and run a build to verify.`,
        'OK',
      );
    } finally {
      exState.isAngularMigrating = false;
    }
  }

  function postFixes(project: Project, version: number) {
    fixDeprecatedTsconfigOptions(project);
    if (version == 17) {
      // Fix polyfills.ts
      replaceInFile(join(project.projectFolder(), 'src', 'polyfills.ts'), {
        replacements: [
          {
            search: `import 'zone.js/dist/zone';`,
            replace: `import 'zone.js';`,
          },
        ],
      });
    }
    if (version >= 21) {
      updateBrowserslist(project, ['Chrome >=107', 'Firefox >=106', 'Edge >=107', 'Safari >=16.1', 'iOS >=16.1']);
    } else if (version >= 16) {
      updateBrowserslist(project, ['Chrome >=61', 'ChromeAndroid >=60']);
    }
  }
}

async function refreshProject(project: Project): Promise<void> {
  if (exState.context) {
    await inspectProject(exState.rootFolder, exState.context, project.monoRepo?.name);
    await commands.executeCommand(CommandName.Refresh);
  }
}

function logOptionalMigrations(version: number): void {
  if (version < 22) {
    return;
  }
  write('');
  write('Optional Angular migrations (run manually if you use Karma or the legacy Webpack builder):');
  write('  ng update @angular/cli --name migrate-karma-to-vitest');
  write('  ng update @angular/cli --name use-application-builder');
}

async function suggestOtherAngularMigrations(project: Project, version: number): Promise<void> {
  const others = getOtherAngularProjects(project);
  if (others.length == 0) {
    return;
  }
  await window.showInformationMessage(
    `Other Angular projects in this repo still need migrating to v${version}: ${others.join(', ')}. Switch to each project in the Projects view and run the migration again.`,
    'OK',
  );
}

async function confirmMonoRepoAngularProjects(project: Project): Promise<boolean> {
  const others = getOtherAngularProjects(project);
  if (others.length == 0) {
    return true;
  }
  const result = await window.showWarningMessage(
    `This monorepo has other Angular projects (${others.join(', ')}) that will not be migrated. Switch to each project and run the migration separately.`,
    'Continue',
    'Cancel',
  );
  return result == 'Continue';
}

async function confirmGitClean(project: Project): Promise<boolean> {
  if (!(await isGitDirty(project.folder))) {
    return true;
  }
  const result = await window.showWarningMessage(
    'Your git repository has uncommitted changes. Commit or stash them before migrating.',
    'Continue Anyway',
    'Cancel',
  );
  return result == 'Continue Anyway';
}

async function ensureValidDependencies(project: Project): Promise<boolean> {
  const projectFolder = project.projectFolder();
  if (!existsSync(join(projectFolder, 'node_modules'))) {
    return true;
  }
  if (!(await hasInvalidDependencies(projectFolder))) {
    return true;
  }
  const result = await window.showWarningMessage(
    'node_modules is out of sync with package.json, which prevents ng update from running. Reinstall dependencies first?',
    'Reinstall',
    'Cancel',
  );
  if (result != 'Reinstall') {
    return false;
  }
  const repaired = await runCommands(
    [`${InternalCommand.cwd}${removeNodeModules()}`, `${InternalCommand.cwd}${npmInstallAll()}`],
    'Repairing node_modules',
    project,
  );
  if (!repaired) {
    return false;
  }
  if (await hasInvalidDependencies(projectFolder)) {
    writeError('Dependencies are still invalid after reinstall. Fix package.json and try again.');
    return false;
  }
  return true;
}

function getOtherAngularProjects(project: Project): string[] {
  if (project.repoType == MonoRepoType.none || !project.monoRepo) {
    return [];
  }
  const current = project.projectFolder();
  return (exState.projects ?? [])
    .filter((p) => p.folder && p.folder != current && hasAngularPackageJson(p.folder))
    .map((p) => p.name);
}

function hasAngularPackageJson(folder: string): boolean {
  const filename = join(folder, 'package.json');
  if (!existsSync(filename)) {
    return false;
  }
  try {
    const packageJson = JSON.parse(readFileSync(filename, 'utf8'));
    return !!(packageJson.dependencies?.['@angular/core'] || packageJson.devDependencies?.['@angular/core']);
  } catch {
    return false;
  }
}

async function isGitDirty(folder: string): Promise<boolean> {
  try {
    const status = await getRunOutput('git status --porcelain', folder, undefined, true);
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

async function hasInvalidDependencies(folder: string): Promise<boolean> {
  try {
    await getRunOutput('npm ls --depth=0', folder, undefined, true);
    return false;
  } catch {
    return true;
  }
}

interface Replace {
  search: string;
  replace: string;
}

interface ReplaceOptions {
  replacements: Replace[];
}

function replaceInFile(filename: string, options: ReplaceOptions): boolean {
  if (!existsSync(filename)) {
    return false;
  }
  const before = readFileSync(filename, 'utf8');
  let after = before;
  for (const replacement of options.replacements) {
    after = after.replace(replacement.search, replacement.replace);
  }
  if (before == after) {
    return false;
  }
  writeFileSync(filename, after);
  write(`Updated ${filename}.`);
}
