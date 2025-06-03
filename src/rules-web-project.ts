import { exists } from './analyzer';
import { InternalCommand } from './command-name';
import { MonoRepoType } from './monorepo';

import { npmInstall, npx } from './node-commands';
import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { asAppId, openUri } from './utilities';
import { checkCapacitorPluginMigration } from './rules-capacitor-plugins';
import { existsSync } from 'fs';
import { join } from 'path';
import { readAngularJson } from './rules-angular-json';
import { runCommands } from './advanced-actions';
import { window } from 'vscode';
import { ignore } from './ignore';
import { exState } from './wn-tree-provider';

/**
 * Web projects are not using Capacitor or Cordova
 * @param  {Project} project
 */
export function webProject(project: Project) {
  if (project.isCapacitorPlugin) {
    checkCapacitorPluginMigration(project);
  }

  if (!project.isCapacitorPlugin) {
    project.tip(
      new Tip(
        'Integrate Capacitor',
        '',
        TipType.Capacitor2,
        'Integrate Capacitor with this project to make it native mobile?',
        undefined,
        'Add Capacitor',
        'Capacitor added to this project',
      )
        .showProgressDialog()
        .setQueuedAction(async (queueFunction: QueueFunction) => {
          queueFunction();
          await integrateCapacitor(project);
        }),
    );
  }
}

async function integrateCapacitor(project: Project) {
  const task = `Integrate Capacitor`;
  const result = await window.showInformationMessage(
    `Integrate Capacitor with this project to make it native mobile?`,
    task,
    'About',
    'Ignore',
  );
  if (result === 'About') {
    openUri('https://capacitorjs.com');
    return;
  }
  if (result === 'Ignore') {
    ignore(new Tip(task, ''), exState.context);
    return;
  }
  if (result !== task) {
    return;
  }

  let outFolder = 'www';
  if (exists('@ionic/angular') || exists('ionicons')) {
    // Likely www
  } else {
    outFolder = 'dist';
  }
  // If there is a build folder and not a www folder then...
  if (!existsSync(join(project.projectFolder(), 'www'))) {
    if (existsSync(join(project.projectFolder(), 'build')) || exists('react')) {
      outFolder = 'build'; // use build folder (usually react)
    } else if (exists('@angular/core')) {
      outFolder = guessOutputFolder(project);
    } else if (existsSync(join(project.projectFolder(), 'dist')) || exists('vue')) {
      outFolder = 'dist'; /// use dist folder (usually vue)
    }
  }

  const pre = project.repoType != MonoRepoType.none ? InternalCommand.cwd : '';
  await runCommands(
    [
      npmInstall(`@capacitor/core`),
      npmInstall(`@capacitor/cli`),
      npmInstall(`@capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar`),
      `${pre}${npx(project)} capacitor init "${project.name}" "${asAppId(project.name)}" --web-dir ${outFolder}`,
      InternalCommand.ionicInit,
    ],
    'Integrating Capacitor',
    project,
  );
}

// Read the output folder from angular.json
function guessOutputFolder(project: Project): string {
  try {
    const angular = readAngularJson(project);
    for (const projectName of Object.keys(angular.projects)) {
      const outputPath = angular.projects[projectName].architect.build.options.outputPath;
      if (outputPath) {
        // It might be browser folder
        const browser = join(project.projectFolder(), outputPath, 'browser');
        return existsSync(browser) ? browser : outputPath;
      }
    }
  } catch {
    return 'dist';
  }
}
