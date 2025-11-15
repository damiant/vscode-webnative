import { window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { runInTerminal } from './terminal';

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
  );

  if (result !== 'Yes') {
    return;
  }

  queueFunction();
  runInTerminal('npx cap spm-migration-assistant');
}
