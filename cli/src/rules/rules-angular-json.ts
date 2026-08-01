import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Project } from '../project/project';
import { FindingCollector } from './finding';
import { MonoRepoType } from '../project/monorepo';

function parseAngularJSON(filename: string): any {
  try {
    return JSON.parse(readFileSync(filename, 'utf8'));
  } catch {
    try {
      const txt = readFileSync(filename, 'utf8');
      const lines = txt.split('\n');
      let tmp = '';
      for (const line of lines) {
        if (line && line.trim().startsWith('//')) {
          continue;
        }
        tmp += line;
      }
      return JSON.parse(tmp);
    } catch {
      return undefined;
    }
  }
}

export function checkAngularJson(project: Project, collector: FindingCollector): void {
  try {
    const filename = join(project.projectFolder(), 'angular.json');
    if (!existsSync(filename)) return;

    const angular = parseAngularJSON(filename);
    if (!angular?.projects) return;

    for (const projectName of Object.keys(angular.projects)) {
      checkWebpackToESBuild(angular, project, projectName, collector);
      if (fixAOT(angular, project, projectName, collector)) break;
    }
    checkPackageManager(angular, project, collector);
  } catch {
    // angular.json may change over time — do not fail checks
  }
}

function checkWebpackToESBuild(angular: any, project: Project, projectName: string, collector: FindingCollector): void {
  try {
    const builder = angular.projects[projectName].architect?.build?.builder;
    if (
      builder === '@angular-devkit/build-angular:browser' ||
      builder === '@angular-devkit/build-angular:browser-esbuild'
    ) {
      if (project.analyzer.isGreaterOrEqual('@angular/core', '17.0.0')) {
        collector.add({
          id: 'angular-switch-esbuild',
          severity: 'info',
          category: 'angular',
          title: 'Switch to ESBuild',
          detail:
            'Angular 17 projects use ESBuild by default but your project is still using WebPack. Consider migrating to the application builder.',
          url: 'https://angular.io/guide/esbuild',
          fixable: false,
        });
      }
    }
  } catch {
    // ignore
  }
}

function checkPackageManager(angular: any, project: Project, collector: FindingCollector): void {
  try {
    if (project.repoType === MonoRepoType.pnpm) {
      if (!angular.cli?.packageManager || angular.cli?.packageManager !== 'pnpm') {
        collector.add({
          id: 'angular-cli-package-manager-pnpm',
          severity: 'info',
          category: 'angular',
          title: 'Set Angular CLI to pnpm',
          detail: 'It appears you are using pnpm but your Angular CLI is set to the default of npm.',
          fixable: false,
        });
      }
    } else if (project.repoType === MonoRepoType.yarn) {
      if (!angular.cli?.packageManager || angular.cli?.packageManager !== 'yarn') {
        collector.add({
          id: 'angular-cli-package-manager-yarn',
          severity: 'info',
          category: 'angular',
          title: 'Set Angular CLI to yarn',
          detail: 'It appears you are using yarn but your Angular CLI is set to the default of npm.',
          fixable: false,
        });
      }
    }
  } catch {
    // ignore
  }
}

function fixAOT(angular: any, project: Project, projectName: string, collector: FindingCollector): boolean {
  if (angular.projects[projectName].architect?.build?.options?.aot === false) {
    collector.add({
      id: 'angular-aot-disabled',
      severity: 'error',
      category: 'angular',
      title: "Use Angular's recommended AOT compilation",
      detail:
        "The project disables AOT during development. Remove aot: false from angular.json to use Angular's recommended Ahead-of-Time compilation.",
      fixable: false,
    });
    return true;
  }
  return false;
}

export function readAngularJson(project: Project): any {
  try {
    const filename = join(project.projectFolder(), 'angular.json');
    if (existsSync(filename)) {
      return parseAngularJSON(filename);
    }
    return undefined;
  } catch {
    return undefined;
  }
}
