'use strict';

import { Context, VSCommand } from './context-variables';
import { exState, ExTreeProvider } from './wn-tree-provider';
import { clearRefreshCache } from './process-packages';
import { Recommendation } from './recommendation';
import { installPackage, reviewProject } from './project';
import { Command, Tip, TipFeature } from './tip';
import { CancelObject, run, estimateRunTime, openUri } from './utilities';
import { ignore } from './ignore';
import { ActionResult, CommandName, InternalCommand } from './command-name';
import { packageUpgrade } from './rules-package-upgrade';
import { ProjectsProvider } from './projects-provider';
import { buildConfiguration } from './build-configuration';
import { setWebConfig, WebConfigSetting } from './web-configuration';
import { selectDevice } from './capacitor-device';
import { getLocalFolder } from './monorepo';
import { androidDebugUnforward } from './android-debug-bridge';
import { AndroidDebugProvider } from './android-debug-provider';
import { DevServerProvider } from './devserver-provider';
import { AndroidDebugType } from './android-debug';
import { CapacitorPlatform } from './capacitor-platform';
import { kill } from './process-list';
import { selectExternalIPAddress } from './ionic-serve';
import { advancedActions } from './advanced-actions';
import { PluginExplorerPanel } from './plugin-explorer';
import { Features, showTips } from './features';

import { webDebugSetting } from './web-debug';
import { showOutput, write, writeError, writeWN } from './logging';
import { ImportQuickFixProvider } from './quick-fix';
import {
  cancelIfRunning,
  finishCommand,
  markActionAsCancelled,
  markActionAsRunning,
  markOperationAsRunning,
  startCommand,
  waitForOtherActions,
} from './tasks';
import { buildAction, debugOnWeb } from './recommend';
import { IonicStartPanel } from './starter';
import {
  CancellationToken,
  ProgressLocation,
  window,
  commands,
  ExtensionContext,
  workspace,
  debug,
  TextDocument,
  languages,
} from 'vscode';
import { existsSync } from 'fs';
import { CommandTitle } from './command-title';
import { autoFixOtherImports } from './imports-icons';
import { setSetting, WorkspaceSection, WorkspaceSetting } from './workspace-state';

/**
 * Runs the command while showing a vscode window that can be cancelled
 * @param  {string|string[]} command Node command
 * @param  {string} rootPath path to run the command
 * @param  {ExTreeProvider} ionicProvider? the provide which will be refreshed on completion
 * @param  {string} successMessage? Message to display if successful
 */
export async function fixIssue(
  command: string | string[],
  rootPath: string,
  ionicProvider?: ExTreeProvider,
  tip?: Tip,
  successMessage?: string,
  title?: string,
) {
  const hasRunPoints = tip && tip.runPoints && tip.runPoints.length > 0;

  if (command == Command.NoOp) {
    await tip.executeAction();
    ionicProvider?.refresh();
    return;
  }

  // If the task is already running then cancel it
  const didCancel = await cancelIfRunning(tip);
  if (didCancel) return;

  markOperationAsRunning(tip);

  let msg = tip.commandProgress ? tip.commandProgress : tip.commandTitle ? tip.commandTitle : command;
  if (title) msg = title;
  let failed = false;
  await window.withProgress(
    {
      location: tip.progressDialog ? ProgressLocation.Notification : ProgressLocation.Window,
      title: `${msg}`,
      cancellable: true,
    },

    async (progress, token: CancellationToken) => {
      const cancelObject: CancelObject = { proc: undefined, cancelled: false };
      let increment = undefined;
      let percentage = undefined;

      const interval = setInterval(async () => {
        // Kill the process if the user cancels
        if (token.isCancellationRequested || tip.cancelRequested) {
          tip.cancelRequested = false;
          writeWN(`Stopped "${tip.title}"`);
          if (tip.features.includes(TipFeature.welcome)) {
            commands.executeCommand(CommandName.hideDevServer);
          }

          if (tip.title.toLowerCase() == CapacitorPlatform.ios) {
            exState.selectedIOSDeviceName = '';
          }
          if (tip.title.toLowerCase() == CapacitorPlatform.android) {
            exState.selectedAndroidDeviceName = '';
          }

          //channelShow();
          clearInterval(interval);
          finishCommand(tip);
          cancelObject.cancelled = true;

          console.log(`Killing process ${cancelObject.proc.pid}`);
          await kill(cancelObject.proc, rootPath);
          if (ionicProvider) {
            ionicProvider.refresh();
          }
        } else {
          if (increment && !hasRunPoints) {
            percentage += increment;
            const msg = percentage > 100 ? ' ' : `${parseInt(percentage)}%`;
            progress.report({ message: msg, increment: increment });
          }
        }
      }, 1000);

      const commandList = Array.isArray(command) ? command : [command];

      let clear = true;
      for (const cmd of commandList) {
        startCommand(tip, cmd, clear);
        clear = false;
        const secondsTotal = estimateRunTime(cmd);
        if (secondsTotal) {
          increment = 100.0 / secondsTotal;
          percentage = 0;
        }
        try {
          let retry = true;
          while (retry) {
            try {
              retry = await run(
                rootPath,
                cmd,
                cancelObject,
                tip.features,
                tip.runPoints,
                progress,
                ionicProvider,
                undefined,
                undefined,
                tip.data,
              );
            } catch (err) {
              retry = false;
              failed = true;
              writeError(err);
            }
          }
        } finally {
          finishCommand(tip);
        }
      }
      return true;
    },
  );
  if (ionicProvider) {
    ionicProvider.refresh();
  }
  if (successMessage) {
    write(successMessage);
  }
  if (tip.title) {
    if (failed) {
      writeError(`${tip.title} Failed.`);
    } else {
      writeWN(`${tip.title} Completed.`);
    }
    write('');
    showOutput();
  }

  if (tip.syncOnSuccess) {
    if (!exState.syncDone.includes(tip.syncOnSuccess)) {
      exState.syncDone.push(tip.syncOnSuccess);
    }
  }
}

export async function activate(context: ExtensionContext) {
  const rootPath =
    workspace.workspaceFolders && workspace.workspaceFolders.length > 0
      ? workspace.workspaceFolders[0].uri.fsPath
      : undefined;

  // Ionic Tree View
  const ionicProvider = new ExTreeProvider(rootPath, context);
  const view = window.createTreeView('wn-tree', { treeDataProvider: ionicProvider });

  // Quick Fixes
  context.subscriptions.push(
    languages.registerCodeActionsProvider({ scheme: 'file', language: 'html' }, new ImportQuickFixProvider(), {
      providedCodeActionKinds: ImportQuickFixProvider.providedCodeActionKinds,
    }),
  );

  const diagnostics = languages.createDiagnosticCollection('webnative');
  context.subscriptions.push(diagnostics);

  // Project List Panel
  const projectsProvider = new ProjectsProvider(rootPath, context);
  const projectsView = window.createTreeView('webnative-zprojects', { treeDataProvider: projectsProvider });

  // Quick Fixes

  // Dev Server Running Panel
  const ionicDevServerProvider = new DevServerProvider(rootPath, context);

  context.subscriptions.push(
    window.registerWebviewViewProvider('webnative-devserver', ionicDevServerProvider, {
      webviewOptions: { retainContextWhenHidden: false },
    }),
  );

  exState.view = view;
  exState.projectsView = projectsView;
  exState.context = context;

  // if (rootPath == undefined) {
  //     // Show the start new project panel
  //     IonicStartPanel.init(context.extensionUri, this.workspaceRoot, context);
  // }

  exState.shell = context.workspaceState.get(Context.shell);
  const shellOverride: string = workspace.getConfiguration(WorkspaceSection).get('shellPath');
  if (shellOverride && shellOverride.length > 0) {
    exState.shell = shellOverride;
  }

  trackProjectChange();

  commands.registerCommand(CommandName.Refresh, () => {
    clearRefreshCache(context);
    ionicProvider.refresh();
  });

  commands.registerCommand(CommandName.Add, async () => {
    if (Features.pluginExplorer) {
      PluginExplorerPanel.init(context.extensionUri, rootPath, context, ionicProvider);
    } else {
      await installPackage(context.extensionPath, rootPath);
      if (ionicProvider) {
        ionicProvider.refresh();
      }
    }
  });

  commands.registerCommand(CommandName.Stop, async (recommendation: Recommendation) => {
    recommendation.tip.data = Context.stop;
    await fixIssue(undefined, context.extensionPath, ionicProvider, recommendation.tip);
    recommendation.setContext(undefined);
  });

  commands.registerCommand(CommandName.OpenInXCode, async () => {
    await findAndRun(ionicProvider, rootPath, CommandTitle.OpenInXCode);
  });
  commands.registerCommand(CommandName.OpenInAndroidStudio, async () => {
    await findAndRun(ionicProvider, rootPath, CommandTitle.OpenInAndroidStudio);
  });
  commands.registerCommand(CommandName.RunForIOS, async () => {
    await findAndRun(ionicProvider, rootPath, CommandTitle.RunForIOS);
  });
  commands.registerCommand(CommandName.RunForAndroid, async () => {
    await findAndRun(ionicProvider, rootPath, CommandTitle.RunForAndroid);
  });
  commands.registerCommand(CommandName.RunForWeb, async () => {
    await findAndRun(ionicProvider, rootPath, CommandTitle.RunForWeb);
  });
  commands.registerCommand(CommandName.Sync, async () => {
    await findAndRun(ionicProvider, rootPath, CommandTitle.Sync);
  });

  commands.registerCommand(CommandName.Upgrade, async (recommendation: Recommendation) => {
    await packageUpgrade(recommendation.tip.data, getLocalFolder(rootPath));
    ionicProvider.refresh();
  });

  commands.registerCommand(CommandName.RefreshDebug, async () => {
    exState.refreshDebugDevices = true;
    ionicProvider.refresh();
  });

  commands.registerCommand(CommandName.SelectAction, async (r: Recommendation) => {
    await advancedActions(r.getData());
    ionicProvider.refresh();
  });

  commands.registerCommand(CommandName.LiveReload, async () => {
    setSetting(WorkspaceSetting.liveReload, true);
    commands.executeCommand(VSCommand.setContext, Context.liveReload, true);
  });

  commands.registerCommand(CommandName.LiveReloadSelected, async () => {
    setSetting(WorkspaceSetting.liveReload, false);
    commands.executeCommand(VSCommand.setContext, Context.liveReload, false);
  });

  commands.registerCommand(CommandName.WebOpenBrowser, async () => {
    setWebConfig(WebConfigSetting.browser);
  });

  commands.registerCommand(CommandName.WebOpenBrowserSelected, async () => {
    setWebConfig(WebConfigSetting.none);
  });

  commands.registerCommand(CommandName.WebEditor, async () => {
    setWebConfig(WebConfigSetting.editor);
  });

  commands.registerCommand(CommandName.WebEditorSelected, async () => {
    setWebConfig(WebConfigSetting.editor);
  });

  commands.registerCommand(CommandName.WebNexusBrowser, async () => {
    setWebConfig(WebConfigSetting.nexus);
  });

  commands.registerCommand(CommandName.WebNexusBrowserSelected, async () => {
    setWebConfig(WebConfigSetting.nexus);
  });

  commands.registerCommand(CommandName.BuildConfig, async (r: Recommendation) => {
    const config = await buildConfiguration(context.extensionPath, context, r.tip.actionArg(0));
    if (!config) return;
    if (config != 'default') {
      r.tip.addActionArg(`--configuration=${config}`);
    }
    exState.configuration = config;
    runAction(r.tip, ionicProvider, rootPath);
  });

  commands.registerCommand(CommandName.NewProject, async () => {
    IonicStartPanel.init(exState.context.extensionUri, this.workspaceRoot, exState.context, true);
  });

  commands.registerCommand(CommandName.PluginExplorer, async () => {
    await reviewProject(rootPath, context, context.workspaceState.get('SelectedProject'));
    PluginExplorerPanel.init(context.extensionUri, rootPath, context, ionicProvider);
  });

  commands.registerCommand(CommandName.Open, async (recommendation: Recommendation) => {
    if (existsSync(recommendation.tip.secondCommand)) {
      openUri(recommendation.tip.secondCommand);
    }
  });

  commands.registerCommand(CommandName.RunIOS, async (recommendation: Recommendation) => {
    runAgain(ionicProvider, rootPath);
  });

  commands.registerCommand(CommandName.Rebuild, async (recommendation: Recommendation) => {
    await recommendation.tip.executeAction();
    ionicProvider.refresh();
  });

  commands.registerCommand(CommandName.Function, async (recommendation: Recommendation) => {
    await recommendation.tip.executeAction();
  });

  commands.registerCommand(CommandName.WebDebugConfig, async (recommendation: Recommendation) => {
    await webDebugSetting();
    ionicProvider.refresh();
  });

  commands.registerCommand(CommandName.Fix, async (tip: Tip) => {
    await fix(tip, rootPath, ionicProvider, context);
  });

  // The project list panel needs refreshing
  commands.registerCommand(CommandName.ProjectsRefresh, async (project: string) => {
    projectsProvider.refresh(project);
  });

  // User selected a project from the list (monorepo)
  commands.registerCommand(CommandName.ProjectSelect, async (project: string) => {
    context.workspaceState.update('SelectedProject', project);
    ionicProvider.selectProject(project);
  });

  commands.registerCommand(CommandName.Idea, async (t: Tip | Recommendation) => {
    if (!t) return;
    // If the user clicks the light bulb it is a Tip, if they click the item it is a recommendation
    const tip: Tip = (t as Recommendation).tip ? (t as Recommendation).tip : (t as Tip);
    await fix(tip, rootPath, ionicProvider, context);
  });

  commands.registerCommand(CommandName.Run, async (r: Recommendation) => {
    runAction(r.tip, ionicProvider, rootPath);
  });

  commands.registerCommand(CommandName.Debug, async () => {
    runAction(debugOnWeb(exState.projectRef), ionicProvider, rootPath);
  });

  commands.registerCommand(CommandName.Build, async () => {
    runAction(buildAction(exState.projectRef), ionicProvider, rootPath);
  });

  commands.registerCommand(CommandName.SelectDevice, async (r: Recommendation) => {
    if (r.tip.actionArg(1) == CapacitorPlatform.android) {
      exState.selectedAndroidDevice = undefined;
      exState.selectedAndroidDeviceName = undefined;
    } else {
      exState.selectedIOSDevice = undefined;
      exState.selectedIOSDeviceName = undefined;
    }
    runAction(r.tip, ionicProvider, rootPath, CommandName.SelectDevice);
  });

  commands.registerCommand(CommandName.Link, async (tip: Tip) => {
    await openUri(tip.url);
  });

  context.subscriptions.push(debug.registerDebugConfigurationProvider(AndroidDebugType, new AndroidDebugProvider()));
  context.subscriptions.push(debug.onDidTerminateDebugSession(androidDebugUnforward));

  if (!exState.runWeb) {
    const summary = await reviewProject(rootPath, context, context.workspaceState.get('SelectedProject'));
    if (summary?.project.isCapacitor) {
      showTips();
    }
  }
}

async function runAgain(ionicProvider: ExTreeProvider, rootPath: string) {
  let runInfo = exState.runWeb;
  switch (exState.lastRun) {
    case CapacitorPlatform.android:
      runInfo = exState.runAndroid;
      break;
    case CapacitorPlatform.ios:
      runInfo = exState.runIOS;
      break;
  }
  if (runInfo) {
    runAction(runInfo, ionicProvider, rootPath);
  }
}

async function findAndRun(ionicProvider: ExTreeProvider, rootPath: string, commandTitle: CommandTitle) {
  const list = await ionicProvider.getChildren();
  const r = findRecursive(commandTitle, list);
  if (r) {
    runAction(r.tip, ionicProvider, rootPath);
  } else {
    window.showInformationMessage(`The action "${commandTitle}" is not available.`);
  }
}

function findRecursive(label: string, items: Recommendation[]): Recommendation | undefined {
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      const found = findRecursive(label, item.children);
      if (found) {
        return found;
      }
    }
    if (item.label == label) {
      return item;
    }
  }
  return undefined;
}

function trackProjectChange() {
  workspace.onDidSaveTextDocument((document: TextDocument) => {
    exState.projectDirty = true;
    if (document.fileName.endsWith('.html')) {
      autoFixOtherImports(document);
    }
  });

  window.onDidChangeVisibleTextEditors((e: Array<any>) => {
    let outputIsFocused = false;
    for (const d of e) {
      if ((d as any)?.document?.uri?.scheme == 'output') {
        outputIsFocused = true;
      }
    }
    exState.outputIsFocused = outputIsFocused;
  });
}

async function runAction(tip: Tip, ionicProvider: ExTreeProvider, rootPath: string, srcCommand?: CommandName) {
  if (await waitForOtherActions(tip)) {
    return; // Canceled
  }
  if (tip.stoppable) {
    markActionAsRunning(tip);
    ionicProvider.refresh();
  }
  await tip.generateCommand();
  tip.generateTitle();
  if (tip.command) {
    let command = tip.command;
    let host = '';
    if (tip.doIpSelection) {
      host = await selectExternalIPAddress();
      if (host) {
        // Ionic cli uses --public-host but capacitor cli uses --host
        host = ` --host=${host}`;
      } else {
        host = '';
      }
    }
    command = (tip.command as string).replace(InternalCommand.publicHost, host);

    if (tip.doDeviceSelection) {
      const target = await selectDevice(tip.secondCommand as string, tip.data, tip, srcCommand);
      if (!target) {
        markActionAsCancelled(tip);
        ionicProvider.refresh();
        return;
      }
      command = (command as string).replace(InternalCommand.target, target);
    }
    if (command) {
      execute(tip, exState.context);
      fixIssue(command, rootPath, ionicProvider, tip);
      return;
    }
  } else {
    await execute(tip, exState.context);
    if (tip.refresh) {
      ionicProvider.refresh();
    }
  }
}

async function fix(
  tip: Tip,
  rootPath: string,
  ionicProvider: ExTreeProvider,
  context: ExtensionContext,
): Promise<void> {
  if (await waitForOtherActions(tip)) {
    return; // Canceled
  }
  await tip.generateCommand();
  tip.generateTitle();
  if (tip.command) {
    const urlBtn = tip.url ? 'Info' : undefined;
    const msg = tip.message ? `: ${tip.message}` : '';
    const info = tip.description ? tip.description : `${tip.title}${msg}`;
    const ignoreTitle = tip.ignorable ? 'Ignore' : undefined;
    const selection = await window.showInformationMessage(info, urlBtn, tip.secondTitle, tip.commandTitle, ignoreTitle);
    if (selection && selection == tip.commandTitle) {
      fixIssue(tip.command, rootPath, ionicProvider, tip, tip.commandSuccess);
    }
    if (selection && selection == tip.secondTitle) {
      fixIssue(tip.secondCommand, rootPath, ionicProvider, tip, undefined, tip.secondTitle);
    }
    if (selection && selection == urlBtn) {
      openUri(tip.url);
    }
    if (selection && selection == ignoreTitle) {
      ignore(tip, context);
      if (ionicProvider) {
        ionicProvider.refresh();
      }
    }
  } else {
    await execute(tip, context);

    if (ionicProvider) {
      ionicProvider.refresh();
    }
  }
}

async function execute(tip: Tip, context: ExtensionContext): Promise<void> {
  const result: ActionResult = (await tip.executeAction()) as ActionResult;
  if (result == ActionResult.Ignore) {
    ignore(tip, context);
  }
  if (tip.url) {
    await openUri(tip.url);
  }
}
