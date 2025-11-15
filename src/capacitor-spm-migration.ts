import { window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { runInTerminal } from './terminal';
import { openUri } from './utilities';

/**
 * Run the SPM Migration Assistant for iOS projects
 * @param queueFunction
 * @param project
 */
export async function runSPMMigration(queueFunction: QueueFunction, project: Project) {
  const result = await window.showInformationMessage(
    'This will help migrate from CocoaPods to Swift Package Manager. Begin the SPM migration tool?',
    'Yes',
    'No',
    'More Information',
  );

  if (result === 'More Information') {
    openUri('https://capacitorjs.com/docs/ios/spm');
    return;
  }

  if (result !== 'Yes') {
    return;
  }

  queueFunction();
  runInTerminal('npx cap spm-migration-assistant');
}
