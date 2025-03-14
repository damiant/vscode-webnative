import { exists, getAllPackageNames, getPackageVersion } from './analyzer';
import { QueueFunction, Tip, TipType } from './tip';
import { coerce } from 'semver';
import { npmInstall, npx } from './node-commands';
import { ionicState } from './wn-tree-provider';
import { runCommands } from './advanced-actions';
import { Project } from './project';
import { window } from 'vscode';
import { delay, openUri, showProgress } from './utilities';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { write } from './logging';
import { join } from 'path';
import { peerDependencyCleanup } from './peer-dependency-cleanup';

// Maximum supported Angular version that we'll suggest migrating to
export const maxAngularVersion = '19';

export function angularMigrate(project: Project, latestVersion: string): Tip | undefined {
  const current = getPackageVersion('@angular/core');
  let latest = coerce(latestVersion);
  const next = current.major + 1;
  if (!latest) latest = current;
  if (!current) return;
  return new Tip(`Migrate to Angular ${next}`, '', TipType.Angular).setQueuedAction(
    migrate,
    project,
    next,
    current.major,
    current,
  );
}

async function migrate(queueFunction: QueueFunction, project: Project, next: number, current: number, now: string) {
  const nextButton = `Update to v${next}`;
  const currentButton = `Update to latest v${current}`;
  const infoButton = 'Info';
  const result = await window.showInformationMessage(
    `Would you like to migrate from Angular ${now} to ${next}? This will use 'ng update': Make sure you have committed your code before you begin.`,
    infoButton,
    currentButton,
    nextButton,
  );
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
    queueFunction();
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
    await runCommands(commands, `Migrating to Angular ${version}`, project);
    postFixes(project, next);

    await peerDependencyCleanup(project);
  }

  function postFixes(project: Project, version: number) {
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
    if (version >= 16) {
      replaceInFile(join(project.projectFolder(), '.browserslistrc'), {
        replacements: [
          { search: `Chrome >=60`, replace: `Chrome >=61` },
          { search: `ChromeAndroid >=60`, replace: `ChromeAndroid >=61` },
        ],
      });
    }
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
