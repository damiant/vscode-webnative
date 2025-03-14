import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { window } from 'vscode';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * For Capacitor project if @ionic/angular-toolkit >= v6 then
 * "ionic-cordova-build" / "ionic-cordova-serve" sections in angular.json are not needed
 * Note: In Cordova projects require @ionic/cordova-builders
 * @param  {Project} project
 */
export function checkMigrationAngularToolkit(project: Project) {
  // v6 removed the "ionic-cordova-build" / "ionic-cordova-serve" sections in Angular.json
  const filename = join(project.folder, 'angular.json');
  if (existsSync(filename)) {
    const txt = readFileSync(filename, 'utf8');
    if (txt && txt.includes('ionic-cordova-build')) {
      project.add(
        new Tip('Migrate angular.json', 'Remove Cordova configurations', TipType.Error).setQueuedAction(
          fixAngularJson,
          filename,
        ),
      );
    }
  }
}

async function fixAngularJson(queueFunction: QueueFunction, filename: string) {
  if (
    !(await window.showErrorMessage(
      'When using @ionic/angular-toolkit v6+ the ionic-cordova-build and ionic-cordova-serve sections in angular.json can be removed.',
      'Fix angular.json',
    ))
  )
    return;
  queueFunction();
  const txt = readFileSync(filename, 'utf8');
  const angular = JSON.parse(txt);
  try {
    for (const project of Object.keys(angular.projects)) {
      delete angular.projects[project].architect['ionic-cordova-build'];
      delete angular.projects[project].architect['ionic-cordova-serve'];
    }
    writeFileSync(filename, JSON.stringify(angular, undefined, 2));
    window.showInformationMessage('angular.json has been migrated');
  } catch (err) {
    window.showErrorMessage('Failed to fix angular.json: ' + err);
  }
}
