import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { writeError } from './logging';
import { openUri } from './utilities';
import { exState } from './tree-provider';
import { ignore } from './ignore';
import { browsersList, exists } from './analyzer';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { window } from 'vscode';
import { join } from 'path';
import { getPackageJSONFilename } from './monorepo';

export function checkBrowsersList(project: Project) {
  try {
    // Is browserslist in the package.json
    if (browsersList().length > 0) {
      if (browsersList().includes('> 0.5%') || browsersList().includes('last 1 version')) {
        // We've got some poor defaults
        const title = 'Fix browserslist';
        const message =
          'The browserslist in package.json may cause some older devices to show a white screen due to missing polyfills.';
        project.add(
          new Tip(title, '', TipType.Idea).setQueuedAction(setBrowsersList, project, title, message).canIgnore(),
        );
        return;
      }
      return;
    }

    // Otherwise look for a browsers list file and either migrate or set it.
    let name = 'browserslist';
    const folder = project.projectFolder();
    let filename = join(folder, name);

    if (!existsSync(filename)) {
      name = '.browserslistrc';
      filename = join(folder, name);
    }
    if (exists('@angular/core')) {
      if (existsSync(filename)) {
        // Migrate to package.json
        const title = 'Reduce Config Files';
        const message = `${name} can be moved into your package.json`;
        project.add(
          new Tip(title, message, TipType.Idea)
            .setQueuedAction(moveFile, project, name, filename, title, message)
            .canIgnore(),
        );
        return;
      } else {
        const title = 'Set Browser Support';
        const message = `Some older devices will not be supported. Updating your package.json to include browserslist will fix this.`;
        project.add(
          new Tip(title, message, TipType.Idea).setQueuedAction(setBrowsersList, project, title, message).canIgnore(),
        );
      }
    }
  } catch (e) {
    writeError(e);
  }
}

function fixPackageJson(project: Project, browsersList: string[]): void {
  // Remove cordova section
  const filename = getPackageJSONFilename(project.projectFolder());
  if (existsSync(filename)) {
    const json = readFileSync(filename, 'utf8');
    const data = JSON.parse(json);
    data.browserslist = browsersList;
    const updated = JSON.stringify(data, undefined, 2);
    writeFileSync(filename, updated);
  }
}

async function setBrowsersList(queueFunction: QueueFunction, project: Project, title: string, message: string) {
  const choice = await window.showWarningMessage(
    `${message} This is typically caused by missed steps during upgrade of an Ionic Project. Do you want to replace with a good set of defaults?`,
    'Yes, Apply Changes',
    'Info',
    'Ignore',
  );
  if (!choice) {
    return;
  }

  try {
    if (choice == 'Ignore') {
      ignore(new Tip(title, message), exState.context);
      return;
    }

    if (choice == 'Info') {
      const list = browsersList();
      openUri(`https://browsersl.ist/#q=${encodeURIComponent(list.join(','))}`);
      return;
    }
    queueFunction();
    fixPackageJson(project, defaultValues());
  } catch (err) {
    window.showErrorMessage(`Failed to fix browserslist: ${err}`);
  }
}

async function moveFile(
  queueFunction: QueueFunction,
  project: Project,
  name: string,
  filename: string,
  title: string,
  message,
) {
  const choice = await window.showInformationMessage(
    `The file ${name} can be moved into package.json to reduce the number of config files in your project. Would you like to do this?`,
    'Yes, Apply Changes',
    'Ignore',
  );
  if (!choice) {
    return;
  }

  try {
    if (choice == 'Ignore') {
      ignore(new Tip(title, message), exState.context);
      return;
    }
    queueFunction();
    const txt = readFileSync(filename, 'utf8').split(/\r?\n/);
    const lines = txt.map((line) => line.trim());
    const list = [];
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const arg = line.split('#')[0];
        list.push(arg);
      }
    }
    fixPackageJson(project, list);
    rmSync(filename);
  } catch (err) {
    window.showErrorMessage(`Failed to fix ${name}: ${err}`);
  }
}

function defaultValues(): string[] {
  return ['Chrome >=61', 'ChromeAndroid >=61', 'Firefox >=63', 'Firefox ESR', 'Edge >=79', 'Safari >=13', 'iOS >=13'];
}

// async function createFile(name: string, filename: string, title: string, message: string) {
//   const choice = await window.showWarningMessage(
//     `${name} is missing. It allows support of older devices (run npx browserslist). Do you want to create this file?`,
//     'Create File',
//     'Ignore'
//   );
//   if (!choice) {
//     return;
//   }

//   if (choice == 'Ignore') {
//     ignore(new Tip(title, message), ionicState.context);
//     return;
//   }

//   const replace = defaultValues();
//   writeFileSync(filename, replace.join('\n'));
// }
