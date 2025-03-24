import { Project } from './project';
import { PackageManager, npmInstall, npmInstallAll } from './node-commands';
import { confirm, getRunOutput, isWindows, replaceAll } from './utilities';
import { write, writeError, writeWN } from './logging';
import { exists, isGreaterOrEqual, isLess } from './analyzer';
import { fixGlobalScss, readAngularJson, writeAngularJson } from './rules-angular-json';
import { exState } from './wn-tree-provider';
import { clearIgnored } from './ignore';
import { CommandName, InternalCommand } from './command-name';
import { ProgressLocation, QuickPickItem, QuickPickItemKind, commands, window } from 'vscode';
import { sep } from 'path';
import { integratePrettier } from './prettier';

enum Features {
  migrateToPNPM = '$(find-replace) Migrate to PNPM',
  migrateToBun = '$(find-replace) Migrate to Bun',
  migrateToNX = '$(outline-view-icon) Migrate to NX',
  reinstallNodeModules = '$(extensions-sync-enabled) Reinstall Node Modules',
  angularESBuild = '$(test-view-icon) Switch from WebPack to ESBuild (experimental)',
  showIgnoredRecommendations = '$(light-bulb) Show Ignored Recommendations',
  lintAndFormat = '$(test-view-icon) Lint and format on commit',
  newProject = '$(plus) New Project',
}

interface AngularSchematic {
  name: string;
  minimumVersion: string;
  command: string;
  description: string;
  commandFn?: (selection: string, project: Project) => Promise<void>;
}

const angularSchematics: AngularSchematic[] = [
  {
    name: '$(test-view-icon) Migrate to Ionic standalone components',
    minimumVersion: '14.0.0',
    description:
      'This will replace IonicModule with individual Ionic components and icons in your project. Are you sure?',
    command: '',
    commandFn: migrateToAngularStandalone,
  },
  {
    name: '$(test-view-icon) Migrate to signal inputs',
    minimumVersion: '19.0.0',
    command: `npx ng generate @angular/core:signal-input-migration --interactive=false --defaults=true --path=".${sep}"`,
    description: 'This will change your @Input decorators to Signal Inputs. Are you sure?',
  },
  {
    name: '$(test-view-icon) Migrate to the built-in control flow syntax',
    minimumVersion: '17.0.0',
    description: 'This will change your Angular templates to use the new built-in control flow syntax. Are you sure?',
    command: `npx ng generate @angular/core:control-flow --interactive=false --defaults=true --path=".${sep}"`,
  },
  {
    name: '$(test-view-icon) Migrate to replace @Output with Output functions',
    minimumVersion: '19.0.0',
    description: 'This will replace your @Output decorators with Output functions. Are you sure?',
    command: `ng generate @angular/core:output-migration --interactive=false --defaults=true --path=".${sep}"`,
  },
  {
    name: '$(test-view-icon) Migrate to use inject for dependency injection',
    minimumVersion: '19.0.0',
    description: 'This will replace dependency injection to use the inject function. Are you sure?',
    command: `ng generate @angular/core:inject --interactive=false --defaults=true --path=".${sep}"`,
  },
  {
    name: '$(test-view-icon) Migrate ViewChild and ContentChild to use signals',
    minimumVersion: '19.0.0',
    description:
      'This will replace @ViewChild and @ContentChild decorators with the equivalent signal query. Are you sure?',
    command: `ng generate @angular/core:signal-queries --interactive=false --defaults=true --path=".${sep}"`,
  },
];

export async function advancedActions(project: Project) {
  const picks: Array<QuickPickItem> = [];
  picks.push({ label: 'Project', kind: QuickPickItemKind.Separator });
  picks.push({ label: Features.newProject });
  picks.push({ label: Features.showIgnoredRecommendations });
  if (project.packageManager == PackageManager.npm || project.packageManager == PackageManager.bun) {
    picks.push({ label: Features.reinstallNodeModules });
  }
  picks.push({ label: 'Migrations', kind: QuickPickItemKind.Separator });
  if (project.packageManager == PackageManager.npm) {
    picks.push({ label: Features.migrateToPNPM });
    picks.push({ label: Features.migrateToBun });

    if (isGreaterOrEqual('@angular/core', '14.0.0')) {
      picks.push({ label: Features.migrateToNX });
    }
  }

  let hasAngularSchematic = false;
  for (const migration of angularSchematics) {
    if (isGreaterOrEqual('@angular/core', migration.minimumVersion)) {
      if (!hasAngularSchematic) {
        picks.push({ label: 'Angular Migrations', kind: QuickPickItemKind.Separator });
      }
      picks.push({ label: migration.name });
      hasAngularSchematic = true;
    }
  }
  if (hasAngularSchematic) {
    picks.push({ label: '', kind: QuickPickItemKind.Separator });
  }
  if (!exists('husky') && project.isCapacitor && isGreaterOrEqual('typescript', '4.0.0')) {
    picks.push({ label: Features.lintAndFormat });
  }

  if (isGreaterOrEqual('@angular-devkit/build-angular', '14.0.0')) {
    if (!isGreaterOrEqual('@angular/core', '17.0.0')) {
      if (!angularUsingESBuild(project)) {
        picks.push({ label: Features.angularESBuild });
      }
    }
  }
  const selection = await window.showQuickPick(picks, {});
  if (!selection) return;
  switch (selection.label) {
    case Features.newProject:
      commands.executeCommand(CommandName.NewProject);
      break;
    case Features.migrateToPNPM:
      await runCommands(migrateToPNPM(), selection.label, project);
      break;
    case Features.migrateToBun:
      await runCommands(migrateToBun(), selection.label, project);
      break;
    case Features.migrateToNX:
      await window.showInformationMessage('Run the following command: npx nx init', 'OK');
      break;
    case Features.reinstallNodeModules:
      await runCommands(reinstallNodeModules(), selection.label, project);
      break;
    case Features.angularESBuild:
      switchAngularToESBuild(project);
      break;
    case Features.showIgnoredRecommendations:
      showIgnoredRecommendations();
      break;
    case Features.lintAndFormat:
      integratePrettier(project);
      break;
    default:
      angularSchematic(selection.label, project);
      break;
  }
}

async function angularSchematic(selection: string, project: Project) {
  const migration = angularSchematics.find((migration) => selection == migration.name);
  if (!migration) {
    return;
  }
  if (!(await confirm(migration.description, 'Continue'))) return;
  if (migration.commandFn) {
    await migration.commandFn(selection, project);
    return;
  } else {
    const commands = [migration.command];
    await runCommands(commands, selection, project);
  }
}

function migrateToPNPM(): Array<string> {
  return ['pnpm -v', removeNodeModules(), 'pnpm import', 'pnpm install', 'rm package-lock.json'];
}

function migrateToBun(): Array<string> {
  return cwd(['bun -v', removeNodeModules(), 'bun install', 'rm package-lock.json']);
}

function cwd(commands: string[]): string[] {
  return commands.map((command) => `${InternalCommand.cwd}${command}`);
}

async function migrateToAngularStandalone(selection: string, project: Project) {
  const commands = ['npx @ionic/angular-standalone-codemods --non-interactive'];
  if (isGreaterOrEqual('@ionic/angular', '7.0.0')) {
    if (isLess('@ionic/angular', '7.5.1')) {
      commands.unshift(npmInstall('@ionic/angular@7.5.1'));
    }
  } else {
    writeError('You must be using @ionic/angular version 7 or higher.');
    return;
  }
  if (isLess('ionicons', '7.2.1')) {
    commands.unshift(npmInstall('ionicons@latest'));
  }
  await runCommands(commands, selection, project);
}

export function removeNodeModules(): string {
  return isWindows() ? 'del node_modules /S /Q' : 'rm -rf node_modules';
}
function reinstallNodeModules(): Array<string> {
  return cwd([removeNodeModules(), npmInstallAll()]);
}

function showIgnoredRecommendations(): void {
  clearIgnored(exState.context);
  commands.executeCommand(CommandName.Refresh);
}

export async function runCommands(commands: Array<string>, title: string, project: Project): Promise<void> {
  try {
    if (title.includes(')')) {
      title = title.substring(title.indexOf(')') + 1);
    }
    await window.withProgress({ location: ProgressLocation.Notification, title, cancellable: false }, async () => {
      await run(commands, project.folder);
    });

    writeWN(`Completed ${title}`);
  } catch (err) {
    writeError(`Failed ${title}: ${err}`);
  }
}

async function run(commands: Array<string>, folder: string): Promise<void> {
  for (const command of commands) {
    writeWN(replaceAll(command, InternalCommand.cwd, ''));
    try {
      write(await getRunOutput(command, folder));
    } catch (err) {
      //writeError(err);
      break;
    }
  }
}

function angularUsingESBuild(project: Project): boolean {
  try {
    const angular = readAngularJson(project);
    for (const prj of Object.keys(angular?.projects)) {
      if (angular.projects[prj]?.architect?.build?.builder == '@angular-devkit/build-angular:browser-esbuild') {
        return true;
      }
    }
    return false;
  } catch (err) {
    return false;
  }
}

function switchAngularToESBuild(project: Project): void {
  const angular = readAngularJson(project);
  let changes = false;
  if (!angular) return;
  for (const prj of Object.keys(angular?.projects)) {
    if (angular.projects[prj]?.architect?.build?.builder == '@angular-devkit/build-angular:browser') {
      angular.projects[prj].architect.build.builder = '@angular-devkit/build-angular:browser-esbuild';
      changes = true;
    }
  }
  if (changes) {
    fixGlobalScss(project);
    writeAngularJson(project, angular);
    window.showInformationMessage(`The Angular project has been changed to esbuild. Enjoy faster builds!`, 'OK');
  }
}
