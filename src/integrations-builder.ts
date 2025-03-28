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
import { CancelObject, openUri, run, runWithProgress } from './utilities';
import { exState } from './wn-tree-provider';
import { viewInEditor } from './preview';

export function checkBuilderIntegration(): Tip[] {
  const tips: Tip[] = [];
  if (
    !exists('@builder.io/dev-tools') &&
    (exists('next') || exists('react') || exists('@remix-run/react') || exists('@angular/core') || exists('qwik'))
  )
    tips.push(
      new Tip(
        'Integrate DevTools',
        '',
        TipType.None,
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

export function builderDevelopAuth(): Tip[] {
  const title = hasBuilder() ? 'Reauthenticate' : 'Authenticate';

  return [
    new Tip(
      title,
      '',
      TipType.None,
      'Authenticate with Builder.io for this project?',
      [auth, rememberAuth],
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
      .canIgnore(),
  ];
}

async function auth(): Promise<void> {
  const folder = exState.projectRef.projectFolder();
  const cmd = 'npx builder.io auth';
  await runWithProgress(cmd, 'Authenticating With Builder', folder);
}

async function rememberAuth(): Promise<void> {
  await setSetting(WorkspaceSetting.builderAuthenticated, true);
}

export function builderDevelopInteractive(): Tip {
  if (!hasBuilder()) return undefined;
  return new Tip(
    'Chat',
    'Interactive',
    TipType.None,
    'Run Builder.io Develop',
    undefined,
    'Builder Develop',
    '',
    undefined,
    'Builder Develop',
  )
    .setQueuedAction(develop)
    .setTooltip('Chat with Builder Develop interactively in the terminal to modify your project')
    .canRefreshAfter();
}

// Builder Rules File
export function builderSettingsRules(project: Project): Tip {
  if (!hasBuilder()) return undefined;

  return new Tip(
    'Rules',
    '',
    TipType.None,
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

function hasBuilder(): boolean {
  const authed = getSetting(WorkspaceSetting.builderAuthenticated);
  if (authed || hasDevTools()) return true;
  return false;
}

function hasDevTools() {
  return exists('@builder.io/dev-tools');
}

// Open Builder
export function builderOpen(): Tip {
  if (!hasBuilder()) return undefined;
  return new Tip('Open', '', TipType.None, '').setQueuedAction(async () => {
    openUri('https://builder.io/content');
    //viewInEditor('https://builder.io/content', true, false, true, true );
  });
}

// Chat: Builder Develop Prompt
export function builderDevelopPrompt(project: Project): Tip {
  const authed = getSetting(WorkspaceSetting.builderAuthenticated);
  if (!authed) return undefined;
  return new Tip('Chat', '', TipType.None, 'Chat with Builder Develop')
    .setTooltip('Chat with Builder Develop to modify your project')
    .setQueuedAction(async () => {
      await chat(project.projectFolder());
    });
}

export async function chat(folder: string, url?: string, append?: string): Promise<void> {
  let chatting = true;
  while (chatting) {
    const title = url
      ? `How would you like to integrate this Figma design?`
      : `How would you like to modify your project?`;
    const prompt = await window.showInputBox({
      title,
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
          folder,
          `npx builder.io@latest code --prompt "${prompt}" ${url ? `--url "${url}"${append ?? ''}` : ''}`,
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
    const chat = 'Chat More';
    chatting = false;
    const res = await window.showInformationMessage(`Builder Develop has Finished.`, chat, view, 'Exit');
    if (res == view) {
      exState.channelFocus = true;
      showOutput();
    }
    if (res == chat) {
      url = undefined;
      append = undefined;
      chatting = true;
    }
  }
}

async function develop(queueFunction: QueueFunction) {
  queueFunction();
  runInTerminal(`npx @builder.io/dev-tools@latest code`);
}
