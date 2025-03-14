import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { writeError, writeWN } from './logging';
import { ionicState } from './wn-tree-provider';
import { isGreaterOrEqual } from './analyzer';
import { getCapacitorConfigWebDir, getCapacitorConfigureFilename, writeCapacitorConfig } from './capacitor-config-file';
import { join, sep } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { window } from 'vscode';
import { openUri, replaceAll, replaceAllStringIn, replaceStringIn } from './utilities';
import { MonoRepoType } from './monorepo';

/**
 * For Capacitor project if @angular/core >= v13 then
 * Check if aot is false in angular.json and remove it
 * Note: When Angular defaulted to AOT only the Ionic starter was not updated
 * and it misses syntax errors checked by AOT that are not in JIT
 * @param  {Project} project
 */
export function checkAngularJson(project: Project) {
  let defaultConfiguration = undefined;
  try {
    const filename = join(project.projectFolder(), 'angular.json');
    if (existsSync(filename)) {
      const angular = parseAngularJSON(filename);
      for (const projectName of Object.keys(angular.projects)) {
        defaultConfiguration = angular.projects[projectName].architect?.build?.defaultConfiguration;
        if (!ionicState.configuration && defaultConfiguration) {
          ionicState.configuration = defaultConfiguration;
        }
        if (!ionicState.project) {
          ionicState.project = projectName;
        }
        checkWebpackToESBuild(angular, project, projectName, filename);
        if (fixAOT(angular, project, projectName, filename)) break;
      }
      checkPackageManager(angular, project, filename);
    }
    if (ionicState.project == 'app') {
      ionicState.project = undefined;
    }
  } catch (e) {
    writeError(e);
  }
}

function checkWebpackToESBuild(angular: any, project: Project, projectName: string, filename: string): boolean {
  try {
    const builder = angular.projects[projectName].architect?.build?.builder;
    if (
      builder == '@angular-devkit/build-angular:browser' ||
      builder == '@angular-devkit/build-angular:browser-esbuild'
    ) {
      // Stable in Angular 17+
      if (isGreaterOrEqual('@angular/core', '17.0.0')) {
        project.add(new Tip('Switch to ESBuild', '', TipType.Idea).setQueuedAction(switchESBuild, project, filename));
      }
    }
  } finally {
    // angular.json may change over time. Dont fail
  }
  return true;
}

function checkPackageManager(angular: any, project: Project, filename: string): boolean {
  try {
    // Angular CLI supports yarn and pnpm
    if (project.repoType == MonoRepoType.pnpm) {
      if (!angular.cli?.packageManager || angular.cli?.packageManager !== 'pnpm') {
        project.add(
          new Tip('Set Angular CLI to pnpm', '', TipType.Idea).setQueuedAction(
            setAngularPackageManager,
            project,
            filename,
            'pnpm',
          ),
        );
      }
    } else if (project.repoType == MonoRepoType.yarn) {
      if (!angular.cli?.packageManager || angular.cli?.packageManager !== 'pnpm') {
        project.add(
          new Tip('Set Angular CLI to yarn', '', TipType.Idea).setQueuedAction(
            setAngularPackageManager,
            project,
            filename,
            'yarn',
          ),
        );
      }
    }
  } finally {
    // Dont fail
  }
  return true;
}

function fixAOT(angular: any, project: Project, projectName: string, filename: string): boolean {
  if (angular.projects[projectName].architect?.build?.options?.aot === false) {
    project.add(
      new Tip(
        'Use Default Angular Compilation',
        `Use Angular's recommended AOT (Ahead of Time) compilation`,
        TipType.Error,
      ).setQueuedAction(fixAngularJson, filename),
    );
    return true;
  }
  return false;
}

export function readAngularJson(project: Project): any {
  try {
    const filename = join(project.folder, 'angular.json');
    if (existsSync(filename)) {
      return parseAngularJSON(filename);
    }
    return undefined;
  } catch (error) {
    return undefined;
  }
}

export function writeAngularJson(project: Project, angular: any): void {
  const filename = join(project.folder, 'angular.json');
  if (existsSync(filename)) {
    writeFileSync(filename, JSON.stringify(angular, null, 2));
  }
}

function parseAngularJSON(filename: string): any {
  try {
    return JSON.parse(readFileSync(filename, 'utf8'));
  } catch (err) {
    // Angular json may have comments
    try {
      const txt = readFileSync(filename, 'utf8');
      const lines = txt.split('\n');
      let tmp = '';
      for (const line of lines) {
        if (line && line.trim().startsWith('//')) {
          // Ignore comments
        } else {
          tmp += line;
        }
      }
      return JSON.parse(tmp);
    } catch (err) {
      writeError(`Unable to parse angular.json: ${err}`);
    }
  }
}

async function fixAngularJson(queueFunction: QueueFunction, filename: string) {
  if (
    !(await window.showErrorMessage(
      `Use Angular's recommended AOT (Ahead of Time) compilation? (this will find additional errors in your templates by switching from JIT to AOT compilation during development)`,
      'Yes, Apply Changes',
    ))
  ) {
    return;
  }
  queueFunction();
  const txt = readFileSync(filename, 'utf8');
  const angular = JSON.parse(txt);
  try {
    for (const project of Object.keys(angular.projects)) {
      delete angular.projects[project].architect?.build?.options?.aot;
    }
    writeFileSync(filename, JSON.stringify(angular, undefined, 2));
  } catch (err) {
    window.showErrorMessage('Failed to fix angular.json: ' + err);
  }
}

async function setAngularPackageManager(
  queueFunction: QueueFunction,
  project: Project,
  filename: string,
  packageMangerName: string,
) {
  if (
    !(await window.showErrorMessage(
      `It appears you are using ${packageMangerName} but your Angular CLI is set to the default of npm. Would you like to update angular.json to use ${packageMangerName}?`,
      'Yes, Apply Changes',
    ))
  ) {
    return;
  }
  queueFunction();
  const txt = readFileSync(filename, 'utf8');
  const angular = JSON.parse(txt);
  try {
    if (!angular.cli) {
      angular.cli = { packageManager: packageMangerName };
    } else {
      angular.cli.packageManager = packageMangerName;
    }
    writeFileSync(filename, JSON.stringify(angular, undefined, 2));
  } catch (err) {
    window.showErrorMessage('Failed to fix angular.json: ' + err);
  }
}

async function switchESBuild(queueFunction: QueueFunction, project: Project, filename: string) {
  const response = await window.showInformationMessage(
    `Angular 17 projects use ESBuild by default but your project is still using WebPack. Would you like to switch to ESBuild?`,
    'Yes, Apply Changes',
    'More Information',
  );
  if (!response) {
    return;
  }
  if (response == 'More Information') {
    openUri('https://angular.io/guide/esbuild');
    return;
  }
  queueFunction();
  const txt = readFileSync(filename, 'utf8');
  const angular = JSON.parse(txt);
  let success = false;
  try {
    for (const projectName of Object.keys(angular.projects)) {
      const builder = angular.projects[projectName].architect?.build?.builder;
      if (
        builder == '@angular-devkit/build-angular:browser' ||
        builder == '@angular-devkit/build-angular:browser-esbuild'
      ) {
        angular.projects[projectName].architect.build.builder = '@angular-devkit/build-angular:application';

        // Neen to replace "main" with "browser"
        const main = angular.projects[projectName].architect.build.options.main;
        if (main) {
          angular.projects[projectName].architect.build.options.browser = main;
          delete angular.projects[projectName].architect.build.options.main;
        }

        if (angular.projects[projectName].architect.serve?.configurations?.ci?.progress) {
          delete angular.projects[projectName].architect.serve.configurations.ci.progress;
        }

        if (angular.projects[projectName].architect.build.options.vendorChunk !== undefined) {
          delete angular.projects[projectName].architect.build.options.vendorChunk;
        }
        if (angular.projects[projectName].architect.build.options.buildOptimizer !== undefined) {
          delete angular.projects[projectName].architect.build.options.buildOptimizer;
        }
        if (angular.projects[projectName].architect.build.configurations) {
          for (const projectConfig of Object.keys(angular.projects[projectName].architect.build.configurations)) {
            if (angular.projects[projectName].architect.build.configurations[projectConfig].vendorChunk !== undefined) {
              delete angular.projects[projectName].architect.build.configurations[projectConfig].vendorChunk;
            }
            if (
              angular.projects[projectName].architect.build.configurations[projectConfig].buildOptimizer !== undefined
            ) {
              delete angular.projects[projectName].architect.build.configurations[projectConfig].buildOptimizer;
            }
            // Migrate service worker path
            if (
              angular.projects[projectName].architect.build.configurations[projectConfig].ngswConfigPath !== undefined
            ) {
              const ngswPath =
                angular.projects[projectName].architect.build.configurations[projectConfig].ngswConfigPath;
              angular.projects[projectName].architect.build.configurations[projectConfig].serviceWorker = ngswPath;
              delete angular.projects[projectName].architect.build.configurations[projectConfig].ngswConfigPath;
            }
          }
        }

        // Need to make polyfills an array:
        const polyfills = angular.projects[projectName].architect.build.options.polyfills;
        if (polyfills && !Array.isArray(polyfills)) {
          angular.projects[projectName].architect.build.options.polyfills = [polyfills];
        }
        success = true;

        // Need to fix the output path as it adds browser as a sub folder
        const outputPath = angular.projects[projectName].architect.build.options.outputPath;
        if (outputPath) {
          const webDir = getCapacitorConfigWebDir(project.projectFolder());
          if (!webDir) {
            const f = getCapacitorConfigureFilename(project.projectFolder());
            writeError(`Unable to update ${f} to append "browser" to the webDir property.`);
          } else {
            let value = webDir;
            if (!value.endsWith(sep)) {
              value = join(value, 'browser'); // Angular now writes to a browser folder
              value = value.replace(/\\/g, '/'); // On windows backslash is escape
            }
            writeCapacitorConfig(project, [{ key: 'webDir', value }]);
            writeWN(`Your Capacitor config webDir was changed from "${webDir}" to "${value}"`);
          }
        }
      }
    }
    fixGlobalScss(project);
    writeFileSync(filename, JSON.stringify(angular, undefined, 2));
    writeWN(`Your angular.json was modified to use ESBuild.`);
    if (success) {
      window.showInformationMessage(`Your project is now using ESBuild. Enjoy faster builds!`, 'OK');
    }
  } catch (err) {
    window.showErrorMessage('Failed to fix angular.json: ' + err);
  }
}

export function fixGlobalScss(project: Project) {
  try {
    const filename = join(project.projectFolder(), 'src', 'global.scss');
    if (existsSync(filename)) {
      let txt = readFileSync(filename, 'utf8');
      txt = replaceAll(txt, `@import "~@ionic/`, `@import "@ionic/`);
      txt = replaceAll(txt, `@import '~@ionic/`, `@import '@ionic/`);
      txt = replaceAll(txt, `@import "~`, `@import "`);
      txt = replaceAll(txt, `@import '~`, `@import '`);
      writeFileSync(filename, txt);
      writeWN(`Modified global.scss to use ESBuild compatible imports.`);
    }
  } catch (error) {
    writeError(`Unable to write global.scss ${error}`);
  }
}
