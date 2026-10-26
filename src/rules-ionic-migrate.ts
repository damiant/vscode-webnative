import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { coerce, lt } from 'semver';
import { window } from 'vscode';
import { installForceArgument, npmInstall, npmUninstall } from './node-commands';
import { getPackageVersion } from './analyzer';
import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { runCommands } from './advanced-actions';
import { confirmGitClean, ensureValidDependencies, refreshProject } from './migration-guards';
import { write, writeError } from './logging';
import { openUri, replaceAll } from './utilities';
import { updateBrowserslist } from './browserslist';
import { MonoRepoType } from './monorepo';

export type IonicFramework = 'angular' | 'react' | 'vue';

export interface IonicPackageUpdate {
  dep: string;
  version: string;
}

export interface FrameworkRequirement {
  dep: string;
  version: string;
  name: string;
}

/** A manual change from an Ionic update guide. framework limits the change to one framework. */
export interface IonicChange {
  text: string;
  framework?: IonicFramework;
}

/** A safe, mechanical source change that the migration applies after the packages are installed. */
export interface IonicCodeFix {
  apply(projectFolder: string): string[];
  describe(files: string[]): string;
}

export interface IonicMigration {
  /** Major version that the project must be on for this migration. */
  from: number;
  /** Major version that this migration installs. */
  to: string;
  guide: string;
  breakingChanges: string;
  summary: string;
  details: string;
  browsers: string[];
  /** Packages that do not follow the Ionic Framework version number. */
  companionPackages: IonicPackageUpdate[];
  requirements: FrameworkRequirement[];
  ionicons: {
    minimum: string;
    install: string;
  };
  /** Router packages that Ionic requires at a specific major version. */
  routerPackages: IonicPackageUpdate[];
  /** Type packages that the updated router packages replace. */
  removeTypes: string[];
  requiredChanges: IonicChange[];
  recommendedChanges: IonicChange[];
  fixes: IonicCodeFix[];
}

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

/**
 * The @ionic/angular-toolkit releases follow the Angular version, not the Ionic version.
 * Ionic 9 supports Angular 18 through 22.
 */
const ionic9ToolkitVersions: Array<{ angular: number; version: string }> = [
  { angular: 18, version: '12.1.1' },
  { angular: 19, version: '12.2.0' },
  { angular: 20, version: '12.3.0' },
  { angular: 21, version: '13' },
];

// Browsers supported by Ionic 8 (https://ionicframework.com/docs/updating/8-0#browser-support)
export const ionic8Browsers = [
  'Chrome >=89',
  'ChromeAndroid >=89',
  'Firefox >=75',
  'Edge >=89',
  'Safari >=15',
  'iOS >=15',
];

// Browsers supported by Ionic 9 (https://ionicframework.com/docs/updating/9-0#browser-support)
export const ionic9Browsers = [
  'Chrome >=89',
  'ChromeAndroid >=89',
  'Firefox >=75',
  'Edge >=89',
  'Safari >=16',
  'iOS >=16',
];

const ionic8Migration: IonicMigration = {
  from: 7,
  to: '8',
  guide: 'https://ionicframework.com/docs/updating/8-0',
  breakingChanges: 'https://github.com/ionic-team/ionic-framework/blob/main/BREAKING.md#version-8x',
  summary: 'Migrate the Ionic packages to version 8.',
  details:
    'Ionic 8 requires Angular 16+, React 17+ or Vue 3.0.6+ and removes the legacy form control syntax. Make sure you have committed your code before you begin.',
  browsers: ionic8Browsers,
  // @ionic/angular-toolkit 11 requires Angular 17, so Angular 16 projects stay on version 10
  companionPackages: [{ dep: '@ionic/angular-toolkit', version: '11' }],
  requirements: [
    { dep: '@angular/core', version: '16.0.0', name: 'Angular 16' },
    { dep: 'react', version: '17.0.0', name: 'React 17' },
    { dep: 'vue', version: '3.0.6', name: 'Vue 3.0.6' },
  ],
  ionicons: { minimum: '7.0.0', install: 'ionicons@7' },
  routerPackages: [],
  removeTypes: [],
  requiredChanges: [
    {
      text: 'Migrate the legacy form control syntax to the modern syntax and remove the legacy property (ion-checkbox, ion-input, ion-radio, ion-select, ion-textarea, ion-toggle)',
    },
    { text: 'ion-input: remove the size and accept properties' },
    {
      text: 'ion-item: move the counter, counterFormatter, helper, error and fill features to ion-input or ion-textarea and remove size and shape',
    },
    { text: 'ion-nav: getLength() returns a Promise, so await the call' },
    { text: 'ion-picker: rename the legacy picker to ion-picker-legacy' },
    { text: 'ion-toast: remove the cssClass property from buttons and use the button CSS shadow parts instead' },
    {
      text: '@ionic/angular: import IonBackButton instead of IonBackButtonDelegate',
      framework: 'angular',
    },
  ],
  recommendedChanges: [
    {
      text: 'Remove the default light palette color variables from src/theme/variables.scss, because Ionic 8 provides them',
    },
    {
      text: 'Import the Ionic 8 dark palette in src/global.scss and move the global variables from the body selector to :root',
    },
    { text: 'Rename the --ion-color-step-[number] background tokens to --ion-background-color-step-[number]' },
    { text: 'Set --ion-dynamic-font: initial in the global stylesheet to keep the previous font scaling' },
    { text: 'Import src/global.scss before src/theme/variables.scss in the styles array of angular.json' },
  ],
  fixes: [
    {
      apply: migrateIonBackButtonImports,
      describe: (files) => `Renamed IonBackButtonDelegate to IonBackButton in: ${files.join(', ')}`,
    },
  ],
};

const ionic9Migration: IonicMigration = {
  from: 8,
  to: '9',
  guide: 'https://ionicframework.com/docs/updating/9-0',
  breakingChanges: 'https://github.com/ionic-team/ionic-framework/blob/main/BREAKING.md#version-9x',
  summary: 'Migrate the Ionic packages to version 9.',
  details:
    'Ionic 9 requires Angular 18+, React 18+ or Vue 3.5+, and React Router 6 or Vue Router 5. It removes the legacy picker and changes the default behavior of several components. Make sure you have committed your code before you begin.',
  browsers: ionic9Browsers,
  // The toolkit version follows Angular, so companionVersion picks the release for the installed Angular
  companionPackages: [{ dep: '@ionic/angular-toolkit', version: '13' }],
  requirements: [
    { dep: '@angular/core', version: '18.0.0', name: 'Angular 18' },
    { dep: 'react', version: '18.0.0', name: 'React 18' },
    { dep: 'vue', version: '3.5.0', name: 'Vue 3.5' },
    { dep: 'typescript', version: '5.4.0', name: 'TypeScript 5.4' },
  ],
  ionicons: { minimum: '8.0.0', install: 'ionicons@8' },
  // Ionic React 9 requires React Router 6 and Ionic Vue 9 requires Vue Router 5
  routerPackages: [
    { dep: 'react-router', version: '6' },
    { dep: 'react-router-dom', version: '6' },
    { dep: 'vue-router', version: '5' },
  ],
  removeTypes: ['@types/react-router', '@types/react-router-dom'],
  requiredChanges: [
    {
      text: 'Browser Support: Safari 16+ and iOS 16+ are now the minimum, and browserslist is updated for you',
    },
    {
      text: 'Capacitor: Ionic 9 officially supports Capacitor 7 and later, and platform detection no longer falls back to the Capacitor 2 isNative flag. Upgrade older Capacitor projects first',
    },
    {
      text: 'ion-img: replace it with a native <img loading="lazy" decoding="async">, listen for load and error instead of ionImgDidLoad and ionError, and style the image instead of ::part(image)',
    },
    {
      text: 'ion-input and ion-searchbar: autocorrect is now a boolean, so autocorrect="off" enables it. Remove the attribute to keep autocorrect disabled',
    },
    {
      text: 'ion-input: update custom CSS selectors for the new .input-start, .input-control and .input-end wrapper elements',
    },
    {
      text: 'ion-picker-legacy: replace it with ion-picker and present it inside an ion-modal, and replace ion-picker-legacy-column with ion-picker-column',
    },
    {
      text: 'Legacy picker: remove pickerController, useIonPicker and the PickerOptions, PickerButton, PickerColumn and PickerColumnOption type exports',
    },
    {
      text: 'ion-modal: handleBehavior now defaults to "cycle", so set handle-behavior="none" to keep an inert sheet handle',
    },
    {
      text: 'ion-nav: it no longer integrates with ion-router, so setRouteId(), getRouteId() and the updateURL option are removed. Use ion-router-outlet for URL-based routing',
    },
    {
      text: 'ion-router-outlet: use the swipeGesture property instead of changing the swipeBackEnabled config at runtime',
    },
    {
      text: 'ion-select: ionChange only fires when the value changes, the action sheet no longer assigns the selected role, part="inner" is removed and there are new start, control and end parts',
    },
    {
      text: 'ion-textarea: update custom CSS selectors (.textarea-control, .textarea-start and .textarea-end), and the Material Design minimum height is now 72px',
    },
    {
      text: 'Floating labels no longer float when the input, select or textarea only contains slotted content',
    },
    {
      text: '@ionic/core: the new exports field limits imports to the documented entry points (@ionic/core, /components, /loader, /hydrate and /css)',
    },
    {
      text: '@ionic/angular: import standalone components from @ionic/angular and lazy components from @ionic/angular/lazy',
      framework: 'angular',
    },
    {
      text: 'React Router 6: use element instead of component and render, remove exact and nested route children, use Navigate instead of Redirect, and use useParams, useNavigate and useLocation instead of RouteComponentProps',
      framework: 'react',
    },
    {
      text: 'React Router 6: add /* to the path of routes that contain nested routes or child IonRouterOutlet components',
      framework: 'react',
    },
    {
      text: '@ionic/vue-router: Vue Router 5 is required and Vue Router 4 is no longer supported, so update vue-router',
      framework: 'vue',
    },
    {
      text: '@ionic/react: IonRedirect is removed, the history prop is removed from IonReactRouter and useIonModal and useIonPopover now type componentProps against the component',
      framework: 'react',
    },
  ],
  recommendedChanges: [
    {
      text: '@ionic/angular: IonicModule is deprecated, so migrate to provideIonicAngular() when convenient',
      framework: 'angular',
    },
    {
      text: '@ionic/angular: set moduleResolution to "bundler" in tsconfig.json when it uses the classic "node" value',
      framework: 'angular',
    },
    {
      text: '@ionic/angular: on Angular 21+, zoneless is the default. Add provideZoneChangeDetection() and a zone.js polyfill to keep Zone.js',
      framework: 'angular',
    },
    {
      text: '@ionic/angular: on Angular 22, ng update migrates components to eager change detection to keep the previous behavior',
      framework: 'angular',
    },
    {
      text: 'ion-textarea: override the 72px Material Design minimum height with a custom class when rows must control the height',
    },
    {
      text: 'Vue Router 5: replace next() in beforeRouteLeave, beforeRouteEnter, beforeRouteUpdate and router.beforeEach with a returned value to remove the deprecation warning',
      framework: 'vue',
    },
  ],
  fixes: [
    {
      apply: migrateLegacyPickerElements,
      describe: (files) => `Renamed the legacy picker elements in: ${files.join(', ')}`,
    },
    {
      apply: migrateAutocorrectAttributes,
      describe: (files) => `Removed autocorrect="off" from ion-input and ion-searchbar in: ${files.join(', ')}`,
    },
    {
      apply: removeIonicCssTildePrefix,
      describe: (files) => `Removed the ~ prefix from the @ionic/angular CSS imports in: ${files.join(', ')}`,
    },
  ],
};

/** Migrations in upgrade order. Each entry assumes that the project is on the `from` major version. */
export const ionicMigrations: IonicMigration[] = [ionic8Migration, ionic9Migration];

const latestIonicMigration = ionicMigrations[ionicMigrations.length - 1];

// Maximum supported Ionic Framework version that we'll suggest migrating to
export const maxIonicVersion = latestIonicMigration.to;

export function ionicMigrationFor(version: number): IonicMigration | undefined {
  return ionicMigrations.find((migration) => migration.from == version);
}

export function addIonicMigrationRecommendation(project: Project): void {
  const tip = ionicMigrate(project);
  if (tip) {
    project.add(tip);
  }
}

/**
 * Offers the next Ionic migration for the installed Ionic version. Earlier versions must be
 * updated one major version at a time, so a project only receives the migration from its own major.
 */
function ionicMigrate(project: Project): Tip | undefined {
  const versions = installedVersions(latestIonicMigration);
  const current = ionicFrameworkVersion(versions);
  if (!current) {
    return;
  }
  const migration = ionicMigrationFor(current.major);
  if (!migration) {
    return;
  }
  return new Tip(`Migrate to Ionic ${migration.to}`, migration.summary, TipType.Ionic, migration.details)
    .setTooltip(
      `Runs the Ionic ${migration.to} packages install, updates browserslist, applies the safe code changes and lists the changes that Ionic ${migration.to} requires. See ${migration.guide}`,
    )
    .setQueuedAction(migrateIonic, project, current.version, migration)
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

/** The Ionic framework that the installed packages use. */
export function ionicFramework(versions: Record<string, string>): IonicFramework | undefined {
  if (versions['@ionic/angular']) {
    return 'angular';
  }
  if (versions['@ionic/react']) {
    return 'react';
  }
  if (versions['@ionic/vue']) {
    return 'vue';
  }
  return undefined;
}

/**
 * The packages to install, limited to the Ionic packages in the installed list.
 * @param installed package names in the project
 * @param angularMajor major version of @angular/core, used to pick @ionic/angular-toolkit
 * @param migration the migration that supplies the target versions
 */
export function ionicPackagesToUpdate(
  installed: string[],
  angularMajor: number,
  migration: IonicMigration = latestIonicMigration,
): IonicPackageUpdate[] {
  const updates: IonicPackageUpdate[] = [];
  for (const dep of ionicFrameworkPackages) {
    if (installed.includes(dep)) {
      updates.push({ dep, version: migration.to });
    }
  }
  for (const companion of migration.companionPackages) {
    if (installed.includes(companion.dep)) {
      updates.push({ dep: companion.dep, version: companionVersion(companion, angularMajor, migration.to) });
    }
  }
  return updates;
}

/**
 * @ionic/angular-toolkit 11 requires Angular 17, so Ionic 8 keeps Angular 16 projects on version 10
 * (see https://ionicframework.com/docs/updating/8-0#angular step 3). Ionic 9 supports Angular 18
 * through 22, and each toolkit release targets one Angular version.
 */
function companionVersion(companion: IonicPackageUpdate, angularMajor: number, ionicMajor: string): string {
  if (companion.dep != '@ionic/angular-toolkit') {
    return companion.version;
  }
  if (ionicMajor == '8') {
    return angularMajor > 0 && angularMajor < 17 ? '10' : '11';
  }
  let version = companion.version;
  for (const release of ionic9ToolkitVersions) {
    if (angularMajor >= release.angular) {
      version = release.version;
    }
  }
  return version;
}

/**
 * The framework requirement that the project does not meet, if any.
 */
export function unmetIonicRequirement(
  versions: Record<string, string>,
  migration: IonicMigration = latestIonicMigration,
): FrameworkRequirement | undefined {
  for (const requirement of migration.requirements) {
    const version = coerce(versions[requirement.dep]);
    if (version && lt(version, requirement.version)) {
      return requirement;
    }
  }
  return undefined;
}

/**
 * IonIcons must match the version that the Ionic Framework package depends on.
 */
export function ioniconsUpdate(version?: string, migration: IonicMigration = latestIonicMigration): string | undefined {
  const current = coerce(version);
  if (current && lt(current, migration.ionicons.minimum)) {
    return migration.ionicons.install;
  }
}

/**
 * Ionic 8 removed the IonBackButtonDelegate class, so it is now IonBackButton
 * (see https://ionicframework.com/docs/updating/8-0#angular step 3).
 * @returns the paths, relative to the project folder, of the updated files
 */
export function migrateIonBackButtonImports(projectFolder: string): string[] {
  return rewriteFiles(projectFolder, scriptExtensions, 'IonBackButtonDelegate', (text) =>
    replaceAll(text, 'IonBackButtonDelegate', 'IonBackButton'),
  );
}

/**
 * Ionic 9 removed ion-picker-legacy and ion-picker-legacy-column in favour of ion-picker and
 * ion-picker-column (see https://ionicframework.com/docs/updating/9-0#legacy-picker).
 * @returns the paths, relative to the project folder, of the updated files
 */
export function migrateLegacyPickerElements(projectFolder: string): string[] {
  return rewriteFiles(projectFolder, markupExtensions, 'ion-picker-legacy', (text) =>
    replaceAll(replaceAll(text, 'ion-picker-legacy-column', 'ion-picker-column'), 'ion-picker-legacy', 'ion-picker'),
  );
}

/**
 * Ionic 9 changed the autocorrect property of ion-input and ion-searchbar to a boolean, so the
 * string value "off" now enables autocorrect (see https://ionicframework.com/docs/updating/9-0#input).
 * @returns the paths, relative to the project folder, of the updated files
 */
export function migrateAutocorrectAttributes(projectFolder: string): string[] {
  return rewriteFiles(projectFolder, markupExtensions, 'autocorrect', (text) =>
    text.replace(autocorrectTag, (tag) => {
      // Ionic React takes a boolean property, so the JSX form uses braces
      const jsx = /^<Ion/.test(tag);
      return tag
        .replace(autocorrectOff, jsx ? ' autocorrect={false}' : '')
        .replace(autocorrectOn, jsx ? ' autocorrect={true}' : ' autocorrect="true"');
    }),
  );
}

const autocorrectTag = /<(ion-input|ion-searchbar|IonInput|IonSearchbar)\b[^>]*>/g;
const autocorrectOff = /\sautocorrect\s*=\s*("off"|'off'|off)(?=[\s/>])/g;
const autocorrectOn = /\sautocorrect\s*=\s*("on"|'on'|on)(?=[\s/>])/g;

/**
 * Angular no longer supports the webpack loader ~ prefix in CSS imports
 * (see https://ionicframework.com/docs/updating/9-0#css-imports).
 * @returns the paths, relative to the project folder, of the updated files
 */
export function removeIonicCssTildePrefix(projectFolder: string): string[] {
  return rewriteFiles(projectFolder, styleExtensions, '~@ionic/', (text) => replaceAll(text, '~@ionic/', '@ionic/'));
}

const scriptExtensions = ['.ts'];
const markupExtensions = ['.html', '.ts', '.tsx', '.js', '.jsx', '.vue'];
const styleExtensions = ['.css', '.scss', '.sass', '.less'];

/**
 * Rewrites the source files that contain the marker text.
 * @returns the paths, relative to the project folder, of the updated files
 */
function rewriteFiles(
  projectFolder: string,
  extensions: string[],
  marker: string,
  transform: (text: string) => string,
): string[] {
  const updated: string[] = [];
  for (const file of collectFiles(join(projectFolder, 'src'), extensions)) {
    const before = readFileSync(file, 'utf8');
    if (!before.includes(marker)) {
      continue;
    }
    const after = transform(before);
    if (after != before) {
      writeFileSync(file, after);
      updated.push(relative(projectFolder, file));
    }
  }
  return updated;
}

function collectFiles(folder: string, extensions: string[], files: string[] = []): string[] {
  if (!existsSync(folder)) {
    return files;
  }
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name == 'node_modules' || entry.name == '.git') {
      continue;
    }
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      collectFiles(path, extensions, files);
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(path);
    }
  }
  return files;
}

async function migrateIonic(
  queueFunction: QueueFunction,
  project: Project,
  currentVersion: string,
  migration: IonicMigration,
): Promise<void> {
  const versions = installedVersions(migration);
  const unmet = unmetIonicRequirement(versions, migration);
  if (unmet) {
    await window.showErrorMessage(
      `Ionic ${migration.to} requires ${unmet.name} or higher but this project uses ${unmet.dep} ${versions[unmet.dep]}. Update ${unmet.name} before you migrate to Ionic ${migration.to}.`,
      'OK',
    );
    return;
  }

  const angular = coerce(versions['@angular/core']);
  const updates = ionicPackagesToUpdate(Object.keys(versions), angular ? angular.major : 0, migration);
  if (updates.length == 0) {
    return;
  }

  const packages = updates.map((update) => `${update.dep}@${update.version}`);
  const ionicons = ioniconsUpdate(versions['ionicons'], migration);
  if (ionicons) {
    packages.push(ionicons);
  }
  for (const router of migration.routerPackages) {
    if (versions[router.dep]) {
      packages.push(`${router.dep}@${router.version}`);
    }
  }

  const removeTypes = migration.removeTypes.filter((dep) => versions[dep]);
  const removal = removeTypes.length > 0 ? ` It also removes ${removeTypes.join(', ')}.` : '';

  const guideButton = 'Review the Update Guide';
  const migrateButton = `Migrate to v${migration.to}`;
  const result = await window.showInformationMessage(
    `Would you like to migrate from Ionic ${currentVersion} to Ionic ${migration.to}? This installs ${packages.join(', ')}.${removal}`,
    guideButton,
    migrateButton,
  );
  if (result == guideButton) {
    await openUri(migration.guide);
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

  const commands = [npmInstall(packages.join(' '), installForceArgument(project))];
  if (removeTypes.length > 0) {
    commands.push(npmUninstall(removeTypes.join(' ')));
  }

  const success = await runCommands(commands, `Migrating to Ionic ${migration.to}`, project);
  if (!success) {
    writeError(`The Ionic ${migration.to} migration failed. Review the output and try again.`);
    return;
  }

  for (const fix of migration.fixes) {
    logFixedFiles(fix, fix.apply(project.projectFolder()));
  }
  updateBrowserslist(project, migration.browsers);
  logRequiredChanges(migration, ionicFramework(versions));
  if (project.repoType != MonoRepoType.none) {
    write(`This is a monorepo: run the Ionic ${migration.to} migration for every Ionic project in the workspace.`);
  }
  await refreshProject(project);
  await window.showInformationMessage(
    `Ionic ${migration.to} migration is complete. Review the changes and run a build to verify the manual updates that are listed in the output.`,
    'OK',
  );
}

/**
 * The versions of the Ionic packages, the required frameworks, the router packages and IonIcons
 * that are installed.
 */
function installedVersions(migration: IonicMigration): Record<string, string> {
  const deps = [
    ...ionicFrameworkPackages,
    ...migration.companionPackages.map((companion) => companion.dep),
    ...migration.requirements.map((requirement) => requirement.dep),
    ...migration.routerPackages.map((router) => router.dep),
    ...migration.removeTypes,
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

function logFixedFiles(fix: IonicCodeFix, files: string[]): void {
  if (files.length == 0) {
    return;
  }
  write('');
  write(fix.describe(files));
}

function logRequiredChanges(migration: IonicMigration, framework: IonicFramework | undefined): void {
  write('');
  write(`Ionic ${migration.to} required changes (${migration.guide}#required-changes):`);
  for (const change of migration.requiredChanges) {
    if (change.framework && change.framework != framework) {
      continue;
    }
    write(`  - ${change.text}`);
  }
  write(`  - Review the complete list of breaking changes: ${migration.breakingChanges}`);
  write('');
  write(`Ionic ${migration.to} recommended changes:`);
  for (const change of migration.recommendedChanges) {
    if (change.framework && change.framework != framework) {
      continue;
    }
    write(`  - ${change.text}`);
  }
}
