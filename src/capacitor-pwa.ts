import { window } from 'vscode';
import { Project } from './project';
import { ignore } from './ignore';
import { exState } from './wn-tree-provider';
import { QueueFunction, Tip } from './tip';
import { runCommands } from './advanced-actions';
import { npx } from './node-commands';

export async function integratePWA(queueFunction: QueueFunction, project: Project, tip: Tip): Promise<void> {
  const result = await window.showInformationMessage(
    `Progressive Web Application (PWA) Integration - This will add @angular/pwa to your project and make changes in your project to make it a PWA (manifest file, splash screen and icon resources).`,
    'Apply Changes',
    'Ignore',
  );
  if (result == 'Ignore') {
    ignore(tip, exState.context);
    return;
  }
  if (!result) {
    return;
  }
  queueFunction();
  await runCommands(
    [`${npx(project)} ng add @angular/pwa --defaults --skip-confirmation true`],
    'Adding @angular/pwa',
    project,
  );
}
