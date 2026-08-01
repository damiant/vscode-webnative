import { join } from 'path';
import { existsSync } from 'fs';
import { Project } from '../project/project';
import { FindingCollector } from './finding';
import { readAngularJson } from './rules-angular-json';
import { checkCapacitorPluginMigration } from './rules-capacitor-plugins';

export function checkWebProject(project: Project, collector: FindingCollector): void {
  if (project.isCapacitorPlugin) {
    checkCapacitorPluginMigration(project, collector);
  }

  if (!project.isCapacitorPlugin) {
    collector.add({
      id: 'integrate-capacitor',
      severity: 'info',
      category: 'capacitor',
      title: 'Integrate Capacitor',
      detail: 'Integrate Capacitor with this project to make it native mobile?',
      url: 'https://capacitorjs.com',
      fixable: false,
    });
  }
}

export function guessOutputFolder(project: Project): string {
  try {
    const angular = readAngularJson(project);
    for (const projectName of Object.keys(angular.projects)) {
      const outputPath = angular.projects[projectName].architect.build.options.outputPath;
      if (outputPath) {
        const browser = join(project.projectFolder(), outputPath, 'browser');
        return existsSync(browser) ? browser : outputPath;
      }
    }
  } catch {
    return 'dist';
  }
  return 'dist';
}
