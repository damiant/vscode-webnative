import { commands } from 'vscode';
import { exists } from './analyzer';
import { ActionResult, CommandName } from './command-name';
import { npmInstall } from './node-commands';
import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { showOutput } from './logging';

export function checkBuilderIntegration(project: Project): Tip[] {
  const tips: Tip[] = [];
  if (
    !exists('@builder.io/dev-tools') &&
    (exists('next') || exists('@remix-run/react') || exists('@angular/core') || exists('qwik'))
  )
    tips.push(
      new Tip(
        'Integrate with Builder',
        '',
        TipType.Builder,
        'Integrate Builder.io into this project?',
        ['npm init builder.io@latest', runApp],
        'Add Builder',
        'Builder support added to your project. Click Run to complete the integration.',
        undefined,
        'Adding Builder.io DevTools to this Project...',
      )
        .setRunPoints([
          {
            title: '',
            text: 'Would you like to integrate Builder.io with this app?',
            action: async (message) => {
              return '\r\n'; // Just press enter
            },
          },
          {
            title: '',
            text: 'Which sdk would you like to install?',
            action: async (message) => {
              return '\r\n'; // Just press enter to pick the recommended one
            },
          },
        ])
        .showProgressDialog()
        .canIgnore(),
    );
  return tips;
}

function runApp(): Promise<void> {
  return new Promise((resolve) => {
    showOutput();
    commands.executeCommand(CommandName.RunForWeb);
    resolve();
  });
}
