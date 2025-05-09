'use strict';

import { Context, VSCommand } from './context-variables';
import { exState, ExTreeProvider } from './wn-tree-provider';
import { clearRefreshCache } from './process-packages';
import { Recommendation } from './recommendation';
import { installPackage, reviewProject } from './project';
import { Tip } from './tip';
import { channelShow, openUri } from './utilities';
import { CommandName } from './command-name';
import { packageUpgrade } from './rules-package-upgrade';
import { ProjectsProvider } from './projects-provider';
import { buildConfiguration, runConfiguration } from './build-configuration';
import { setWebConfig, WebConfigSetting } from './web-configuration';
import { getLocalFolder } from './monorepo';
import { androidDebugUnforward } from './android-debug-bridge';
import { AndroidDebugProvider } from './android-debug-provider';
import { DevServerProvider } from './devserver-provider';
import { AndroidDebugType } from './android-debug';
import { CapacitorPlatform } from './capacitor-platform';
import { advancedActions } from './advanced-actions';
import { PluginExplorerPanel } from './plugin-explorer';
import { Features, showTips } from './features';
import { webDebugSetting } from './web-debug';
import { showOutput } from './logging';
import { ImportQuickFixProvider } from './quick-fix';
import { buildAction, debugOnWeb } from './recommend';
import { StarterPanel } from './starter';
import { window, commands, ExtensionContext, workspace, debug, languages, StatusBarAlignment } from 'vscode';
import { existsSync } from 'fs';
import { CommandTitle } from './command-title';
import { setSetting, WorkspaceSection, WorkspaceSetting } from './workspace-state';
import { viewInEditor } from './preview';
import { autoRunClipboard } from './features/auto-run-clipboard';
import { findAndRun, fix, fixIssue, runAction, runAgain } from './features/fix-issue';
import { trackProjectChange } from './features/track-project-changes';

export const extensionName = 'WebNative';

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

  const statusBarBuild = window.createStatusBarItem(StatusBarAlignment.Left, 1000);
  statusBarBuild.command = CommandName.Debug;
  statusBarBuild.text = `$(debug-alt)`;
  statusBarBuild.tooltip = 'Debug the current project';
  statusBarBuild.show();
  context.subscriptions.push(statusBarBuild);

  const statusBarRun = window.createStatusBarItem(StatusBarAlignment.Left, 1000);
  statusBarRun.command = CommandName.RunForWeb;
  statusBarRun.text = `$(play)`;
  statusBarRun.tooltip = 'Run the current project';
  statusBarRun.show();
  context.subscriptions.push(statusBarRun);
  exState.runStatusBar = statusBarRun;

  const statusBarOpenWeb = window.createStatusBarItem(StatusBarAlignment.Left, 100);
  statusBarOpenWeb.command = CommandName.OpenWeb;
  statusBarOpenWeb.text = `$(globe)`;
  statusBarOpenWeb.tooltip = 'Open the current project in a browser';
  statusBarOpenWeb.hide();
  context.subscriptions.push(statusBarOpenWeb);
  exState.openWebStatusBar = statusBarOpenWeb;
  commands.registerCommand(CommandName.OpenWeb, async () => {
    openUri(exState.localUrl);
  });

  const statusBarOpenEditor = window.createStatusBarItem(StatusBarAlignment.Left, 100);
  statusBarOpenEditor.command = CommandName.OpenEditor;
  statusBarOpenEditor.text = `$(search-new-editor)`;
  statusBarOpenEditor.tooltip = 'Open the current project in an editor window';
  statusBarOpenEditor.hide();
  context.subscriptions.push(statusBarOpenEditor);
  exState.openEditorStatusBar = statusBarOpenEditor;
  commands.registerCommand(CommandName.OpenEditor, async () => {
    viewInEditor(exState.localUrl ?? 'https://webnative.dev', exState.externalUrl, true, false, true, true);
  });

  // Dev Server Running Panel
  const devServerProvider = new DevServerProvider(rootPath, context);

  context.subscriptions.push(
    window.registerWebviewViewProvider('webnative-devserver', devServerProvider, {
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

  // On focusing with extension if clipboard has a command give option to run it
  autoRunClipboard();

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
  commands.registerCommand(CommandName.ShowLogs, async () => {
    exState.channelFocus = true;
    channelShow();
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
    exState.buildConfiguration = config;
    runAction(r.tip, ionicProvider, rootPath);
  });
  commands.registerCommand(CommandName.RunConfig, async (r: Recommendation) => {
    const config = await runConfiguration(context.extensionPath, context, r.tip.actionArg(0));
    if (!config) return;
    if (config != 'default') {
      r.tip.addActionArg(`--configuration=${config}`);
    }
    exState.runConfiguration = config;
    runAction(r.tip, ionicProvider, rootPath);
  });

  commands.registerCommand(CommandName.NewProject, async () => {
    StarterPanel.init(exState.context.extensionUri, this.workspaceRoot, exState.context, true);
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
    runAction(debugOnWeb(exState.projectRef, 'Web'), ionicProvider, rootPath);
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

  // Ensures the Dev Server is Showing
  //qrView(undefined, undefined);
}
