// vsCode Ionic Command Names match to the strings in package.json
export enum CommandName {
  Run = 'webnative.runapp',
  Fix = 'webnative.fix',
  Link = 'webnative.link',
  Idea = 'webnative.lightbulb',
  Refresh = 'webnative.refresh',
  Add = 'webnative.add',
  Stop = 'webnative.stop',
  Rebuild = 'webnative.rebuild',
  RefreshDebug = 'webnative.refreshDebug',
  Function = 'webnative.function',
  Open = 'webnative.open',
  Upgrade = 'webnative.upgrade',
  ProjectsRefresh = 'webnative.projectRefresh',
  ProjectSelect = 'webnative.projectSelect',
  BuildConfig = 'webnative.buildConfig',
  RunConfig = 'webnative.runConfig',
  StatusRun = 'webnative.statusRun',

  LiveReload = 'webnative.liveReload',
  LiveReloadSelected = 'webnative.liveReloadSelected',
  WebOpenBrowser = 'webnative.webOpenBrowser',
  WebOpenBrowserSelected = 'webnative.webOpenBrowserSelected',
  WebEditor = 'webnative.webEditor',
  WebEditorSelected = 'webnative.webEditorSelected',
  WebNexusBrowser = 'webnative.webNexus',
  WebNexusBrowserSelected = 'webnative.webNexusSelected',

  WebDebugConfig = 'webnative.webDebugConfig',
  SelectAction = 'webnative.selectAction',
  DebugMode = 'webnative.debugMode',
  PluginExplorer = 'webnative.pluginExplorer',
  NewProject = 'webnative.newProject',
  RunMode = 'webnative.runMode',
  SelectDevice = 'webnative.selectDevice',
  RunIOS = 'webnative.run',
  RunForIOS = 'webnative.runIOS',
  RunForAndroid = 'webnative.runAndroid',
  RunForWeb = 'webnative.runWeb',
  ShowLogs = 'webnative.showLogs',
  OpenWeb = 'webnative.openWeb',
  OpenEditor = 'webnative.openEditor',
  Sync = 'webnative.capSync',
  Debug = 'webnative.debug',
  Build = 'webnative.build',
  OpenInXCode = 'webnative.openXcode',
  OpenInAndroidStudio = 'webnative.openAndroidStudio',
  ViewDevServer = 'webnative.viewDevServer', // View the dev server window
  HideDevServer = 'webnative.hideDevServer', // Hide the dev server window
}

export enum InternalCommand {
  cwd = '[@cwd]', // Used to change the working directory for a commmand if we are in a monorepo
  target = '[@target]', // Used to change the target to the device selected
  removeCordova = 'rem-cordova', // Will remove cordova from the project
  ionicInit = '[@ionic-init]', // Will call ionic init if ionic.config.json is missing
  publicHost = '[@public-host]', // Will be replaced with --public-host
}

export enum ActionResult {
  None = '',
  Ignore = 'ignore',
}
