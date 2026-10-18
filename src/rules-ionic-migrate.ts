import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { coerce, lt } from 'semver';
import { window } from 'vscode';
import { installForceArgument, npmInstall } from './node-commands';
import { getPackageVersion } from './analyzer';
import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { runCommands } from './advanced-actions';
import { confirmGitClean, ensureValidDependencies, refreshProject } from './migration-guards';
import { write, writeError } from './logging';
import { openUri, replaceAll } from './utilities';
import { updateBrowserslist } from './browserslist';
import { MonoRepoType } from './monorepo';

// Maximum supported Ionic Framework version that we'll suggest migrating to
export const maxIonicVersion = '8';

// The Ionic 8 update guide and the list of breaking changes it refers to
const ionicUpdateGuide = 'https://ionicframework.com/docs/updating/8-0';
const ionicBreakingChanges = 'https://github.com/ionic-team/ionic-framework/blob/main/BREAKING.md#version-8x';

// Browsers supported by Ionic 8 (https://ionicframework.com/docs/updating/8-0#browser-support)
export const ionic8Browsers = [
  'Chrome >=89',
  'ChromeAndroid >=89',
  'Firefox >=75',
  'Edge >=89',
  'Safari >=15',
  'iOS >=15',
];

// Packages that are released with the version number of the Ionic Framework
const ionicFrameworkPackages = [
  '@ionic/angular',
  '@ionic/angular-server',
  '@ionic/core',
  '@ionic/react',
  '@ionic/react-router',
  '@ionic/vue',
  '@ionic/vue-router',
];

export interface IonicPackageUpdate {
  dep: string;
  version: string;
}

// Ionic 8 packages that do not use the framework version number
const ionicCompanionPackages: IonicPackageUpdate[] = [{ dep: '@ionic/angular-toolkit', version: '11' }];

export interface FrameworkRequirement {
  dep: string;
  version: string;
  name: string;
}

// Ionic 8 requires Angular 16+, React 17+ and Vue 3.0.6+
const ionicFrameworkRequirements: FrameworkRequirement[] = [
  { dep: '@angular/core', version: '16.0.0', name: 'Angular 16' },
  { dep: 'react', version: '17.0.0', name: 'React 17' },
  { dep: 'vue', version: '3.0.6', name: 'Vue 3.0.6' },
];

export function addIonicMigrationRecommendation(project: Project): void {
  const tip = ionicMigrate(project);
  if (tip) {
    project.add(tip);
  }
}

/**
 * Offers the Ionic 8 migration for Ionic 7 projects. Earlier versions must be updated
 * one major version at a time, so the guide assumes the project is already on Ionic 7.
 */
function ionicMigrate(project: Project): Tip | undefined {
  const versions = installedVersions();
  const current = ionicFrameworkVersion(versions);
  if (!current) {
    return;
  }
  if (current.major != 7) {
    return;
  }
  return new Tip(
    `Migrate to Ionic ${maxIonicVersion}`,
    `Migrate the Ionic packages to version ${maxIonicVersion}.`,
    TipType.Ionic,
    `Ionic ${maxIonicVersion} requires Angular 16+, React 17+ or Vue 3.0.6+ and removes the legacy form control syntax. Make sure you have committed your code before you begin.`,
  )
    .setTooltip(
      `Runs the Ionic ${maxIonicVersion} packages install, updates browserslist and lists the changes that Ionic ${maxIonicVersion} requires. See ${ionicUpdateGuide}`,
    )
    .setQueuedAction(migrateIonic, project, current.version)
    .canIgnore();
}

/**
 * The version of the Ionic Framework package that the project uses. The order of
 * ionicFrameworkPackages decides the result when more than one package is installed.
 */
export function ionicFrameworkVersion(versions: Record<string, string>): ReturnType<typeof coerce> {
  for (const dep of ionicFrameworkPackages) {
    const version = coerce(versions[dep]);
    if (version) {
      return version;
    }
  }
  return undefined;
}

/**
 * The packages to install, limited to the Ionic packages in the installed list.
 * @param installed package names in the project
 * @param angularMajor major version of @angular/core, used to pick @ionic/angular-toolkit
 */
export function ionicPackagesToUpdate(installed: string[], angularMajor: number): IonicPackageUpdate[] {
  const updates: IonicPackageUpdate[] = [];
  for (const dep of ionicFrameworkPackages) {
    if (installed.includes(dep)) {
      updates.push({ dep, version: maxIonicVersion });
    }
  }
  for (const companion of ionicCompanionPackages) {
    if (installed.includes(companion.dep)) {
      updates.push({ dep: companion.dep, version: companionVersion(companion, angularMajor) });
    }
  }
  return updates;
}

/**
 * @ionic/angular-toolkit 11 requires Angular 17, so Angular 16 projects stay on version 10
 * (see https://ionicframework.com/docs/updating/8-0#angular step 3).
 */
function companionVersion(companion: IonicPackageUpdate, angularMajor: number): string {
  if (companion.dep == '@ionic/angular-toolkit' && angularMajor > 0 && angularMajor < 17) {
    return '10';
  }
  return companion.version;
}

/**
 * The framework requirement that the project does not meet, if any.
 */
export function unmetIonicRequirement(versions: Record<string, string>): FrameworkRequirement | undefined {
  for (const requirement of ionicFrameworkRequirements) {
    const version = coerce(versions[requirement.dep]);
    if (version && lt(version, requirement.version)) {
      return requirement;
    }
  }
  return undefined;
}

/**
 * IonIcons 7 is required by Ionic 7 and higher.
 */
export function ioniconsUpdate(version?: string): string | undefined {
  const current = coerce(version);
  if (current && lt(current, '7.0.0')) {
    return 'ionicons@7';
  }
}

/**
 * Ionic 8 removed the IonBackButtonDelegate class, so it is now IonBackButton
 * (see https://ionicframework.com/docs/updating/8-0#angular step 3).
 * @returns the paths, relative to the project folder, of the updated files
 */
export function migrateIonBackButtonImports(projectFolder: string): string[] {
  const renamed: string[] = [];
  for (const file of collectSourceFiles(join(projectFolder, 'src'))) {
    const before = readFileSync(file, 'utf8');
    if (!before.includes('IonBackButtonDelegate')) {
      continue;
    }
    writeFileSync(file, replaceAll(before, 'IonBackButtonDelegate', 'IonBackButton'));
    renamed.push(relative(projectFolder, file));
  }
  return renamed;
}

function collectSourceFiles(folder: string, files: string[] = []): string[] {
  if (!existsSync(folder)) {
    return files;
  }
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name == 'node_modules') {
      continue;
    }
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(path, files);
    } else if (entry.name.endsWith('.ts')) {
      files.push(path);
    }
  }
  return files;
}

async function migrateIonic(queueFunction: QueueFunction, project: Project, currentVersion: string): Promise<void> {
  const versions = installedVersions();
  const unmet = unmetIonicRequirement(versions);
  if (unmet) {
    await window.showErrorMessage(
      `Ionic ${maxIonicVersion} requires ${unmet.name} or higher but this project uses ${unmet.dep} ${versions[unmet.dep]}. Update ${unmet.name} before you migrate to Ionic ${maxIonicVersion}.`,
      'OK',
    );
    return;
  }

  const angular = coerce(versions['@angular/core']);
  const updates = ionicPackagesToUpdate(Object.keys(versions), angular ? angular.major : 0);
  if (updates.length == 0) {
    return;
  }

  const packages = updates.map((update) => `${update.dep}@${update.version}`);
  const ionicons = ioniconsUpdate(versions['ionicons']);
  if (ionicons) {
    packages.push(ionicons);
  }

  const guideButton = 'Review the Update Guide';
  const migrateButton = `Migrate to v${maxIonicVersion}`;
  const result = await window.showInformationMessage(
    `Would you like to migrate from Ionic ${currentVersion} to Ionic ${maxIonicVersion}? This installs ${packages.join(', ')}.`,
    guideButton,
    migrateButton,
  );
  if (result == guideButton) {
    await openUri(ionicUpdateGuide);
    return;
  }
  if (result != migrateButton) {
    return;
  }

  queueFunction();
  if (!(await confirmGitClean(project))) {
    return;
  }
  if (!(await ensureValidDependencies(project))) {
    return;
  }

  const success = await runCommands(
    [npmInstall(packages.join(' '), installForceArgument(project))],
    `Migrating to Ionic ${maxIonicVersion}`,
    project,
  );
  if (!success) {
    writeError(`The Ionic ${maxIonicVersion} migration failed. Review the output and try again.`);
    return;
  }

  if (angular) {
    logRenamedBackButtonImports(migrateIonBackButtonImports(project.projectFolder()));
  }
  updateBrowserslist(project, ionic8Browsers);
  logRequiredChanges(!!angular);
  if (project.repoType != MonoRepoType.none) {
    write(`This is a monorepo: run the Ionic ${maxIonicVersion} migration for every Ionic project in the workspace.`);
  }
  await refreshProject(project);
  await window.showInformationMessage(
    `Ionic ${maxIonicVersion} migration is complete. Review the changes and run a build to verify the manual updates that are listed in the output.`,
    'OK',
  );
}

/**
 * The versions of the Ionic packages, the required frameworks and IonIcons that are installed.
 */
function installedVersions(): Record<string, string> {
  const deps = [
    ...ionicFrameworkPackages,
    ...ionicCompanionPackages.map((companion) => companion.dep),
    ...ionicFrameworkRequirements.map((requirement) => requirement.dep),
    'ionicons',
  ];
  const versions: Record<string, string> = {};
  for (const dep of deps) {
    const version = getPackageVersion(dep);
    if (version) {
      versions[dep] = version.version;
    }
  }
  return versions;
}

function logRenamedBackButtonImports(renamed: string[]): void {
  if (renamed.length == 0) {
    return;
  }
  write('');
  write(`Renamed IonBackButtonDelegate to IonBackButton in: ${renamed.join(', ')}`);
}

function logRequiredChanges(isAngular: boolean): void {
  write('');
  write(`Ionic ${maxIonicVersion} required changes (${ionicUpdateGuide}#required-changes):`);
  write(
    '  - Migrate the legacy form control syntax to the modern syntax and remove the legacy property (ion-checkbox, ion-input, ion-radio, ion-select, ion-textarea, ion-toggle)',
  );
  write('  - ion-input: remove the size and accept properties');
  write(
    '  - ion-item: move the counter, counterFormatter, helper, error and fill features to ion-input or ion-textarea and remove size and shape',
  );
  write('  - ion-nav: getLength() returns a Promise, so await the call');
  write('  - ion-picker: rename the legacy picker to ion-picker-legacy');
  write('  - ion-toast: remove the cssClass property from buttons and use the button CSS shadow parts instead');
  if (isAngular) {
    write('  - @ionic/angular: import IonBackButton instead of IonBackButtonDelegate');
  }
  write(`  - Review the complete list of breaking changes: ${ionicBreakingChanges}`);
  write('');
  write(`Ionic ${maxIonicVersion} recommended changes:`);
  write(
    '  - Remove the default light palette color variables from src/theme/variables.scss, because Ionic 8 provides them',
  );
  write(
    '  - Import the Ionic 8 dark palette in src/global.scss and move the global variables from the body selector to :root',
  );
  write('  - Rename the --ion-color-step-[number] background tokens to --ion-background-color-step-[number]');
  write('  - Set --ion-dynamic-font: initial in the global stylesheet to keep the previous font scaling');
  write('  - Import src/global.scss before src/theme/variables.scss in the styles array of angular.json');
}
