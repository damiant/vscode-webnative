import { CancellationToken, commands, ProgressLocation, Uri, window, workspace } from 'vscode';
import { exists } from './analyzer';
import { CommandName } from './command-name';
import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { showOutput } from './logging';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { runInTerminal } from './terminal';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { CancelObject, run } from './utilities';
import { exState } from './wn-tree-provider';

export function checkBuilderIntegration(project: Project): Tip[] {
  const tips: Tip[] = [];
  if (
    !exists('@builder.io/dev-tools') &&
    (exists('next') || exists('@remix-run/react') || exists('@angular/core') || exists('qwik'))
  )
    tips.push(
      new Tip(
        'Integrate Builder Publish',
        '',
        TipType.Builder,
        'Integrate Builder.io Publish (Visual CMS) into this project?',
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

export function builderDevelopAuth(project: Project): Tip[] {
  const authed = getSetting(WorkspaceSetting.builderAuthenticated);
  if (authed) return [];

  return [
    new Tip(
      'Authenticate for Builder Develop',
      '',
      TipType.Builder,
      'Authenticate Builder.io Develop (AI Code Generation) for this project?',
      ['npx builder.io auth', rememberAuth],
      'Authenticate',
      'Builder authenticated.',
      undefined,
      'Authenticating with Builder.io for this Project...',
    )
      .setRunPoints([
        {
          title: '',
          text: 'Would you like to authenticate with Builder.io for this app?',
          action: async (message) => {
            return '\r\n'; // Just press enter
          },
        },
      ])
      .showProgressDialog()
      .canIgnore(),
  ];
}

async function rememberAuth(): Promise<void> {
  await setSetting(WorkspaceSetting.builderAuthenticated, true);
}

export function builderDevelopInteractive(project: Project): Tip {
  const authed = getSetting(WorkspaceSetting.builderAuthenticated);
  if (!authed) return undefined;

  return new Tip(
    'Develop',
    '',
    TipType.Builder,
    'Run Builder.io Develop',
    undefined,
    'Builder Develop',
    '',
    undefined,
    'Builder Develop',
  )
    .setQueuedAction(develop)
    .canRefreshAfter();
}

// Builder Rules File
export function builderSettingsRules(project: Project): Tip {
  const authed = getSetting(WorkspaceSetting.builderAuthenticated);
  if (!authed) return undefined;
  return new Tip(
    'Builder Rules',
    undefined,
    TipType.Builder,
    'Open the Builder Develop Rules file (custom instructions for the AI)',
  ).setQueuedAction(async () => {
    const file = join(project.projectFolder(), '.builderrules');
    if (!existsSync(file)) {
      writeFileSync(
        file,
        '# .builderrules (see https://www.builder.io/c/docs/cli-code-generation-best-practices#project-level-settings)\r\n\r\n',
        { encoding: 'utf8' },
      );
    }
    const doc = await workspace.openTextDocument(Uri.file(file));
    await window.showTextDocument(doc);
  });
}

// Builder Develop Prompt
export function builderDevelopPrompt(project: Project): Tip {
  const authed = getSetting(WorkspaceSetting.builderAuthenticated);
  if (!authed) return undefined;
  return new Tip('Chat', undefined, TipType.Builder, 'Chat with Builder Develop').setQueuedAction(async () => {
    const prompt = await window.showInputBox({
      title: 'Chat with Builder Develop',
      placeHolder: 'Enter prompt (eg "Create a component called Pricing Page")',
      ignoreFocusOut: true,
    });
    if (!prompt) return undefined;
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Builder`,
        cancellable: true,
      },
      async (progress, token: CancellationToken) => {
        const cancelObject: CancelObject = { proc: undefined, cancelled: false };
        await run(
          project.projectFolder(),
          `npx builder.io@latest code --prompt "${prompt}"`,
          cancelObject,
          [],
          [],
          progress,
          undefined,
          undefined,
          false,
          undefined,
          true,
          true,
        );
      },
    );
    const view = 'View Response';
    const res = await window.showInformationMessage(`Builder Develop has Finished.`, 'OK', view);
    if (res == view) {
      exState.channelFocus = true;
      showOutput();
    }
  });
}

async function develop(queueFunction: QueueFunction) {
  queueFunction();
  runInTerminal(`npx @builder.io/dev-tools@latest code`);
}
