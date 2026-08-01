import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Project } from '../project/project';
import { FindingCollector } from './finding';

export function checkMigrationAngularToolkit(project: Project, collector: FindingCollector): void {
  const filename = join(project.projectFolder(), 'angular.json');
  if (!existsSync(filename)) return;

  const txt = readFileSync(filename, 'utf8');
  if (txt && txt.includes('ionic-cordova-build')) {
    collector.add({
      id: 'angular-toolkit-cordova-config',
      severity: 'error',
      category: 'angular',
      title: 'Migrate angular.json',
      detail:
        'When using @ionic/angular-toolkit v6+ the ionic-cordova-build and ionic-cordova-serve sections in angular.json can be removed.',
      fixable: false,
    });
  }
}
