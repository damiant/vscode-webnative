import { workspace } from 'vscode';
import { exState } from './tree-provider';

export const WorkspaceSection = 'webnative';

export enum WorkspaceSetting {
  liveReload = 'liveReload',
  httpsForWeb = 'httpsForWeb',
  pluginDrift = 'pluginDrift', // Whether the user has been shown the plugin drift compared to NexusBrowser app
  webAction = 'webAction',
  logFilter = 'logFilter',
  lastIPAddress = 'lastIPAddress',
  debugBrowser = 'debugBrowser',
  emulator = 'emulator',
  cocoaPods = 'cocoaPods2',
  recCheck = 'recCheck',
}

export enum ExtensionSetting {
  internalAddress = 'internalAddress',
  javaHome = 'javaHome',
  manualNewProjects = 'manualNewProjects',
  packageManager = 'packageManager',
}

export enum GlobalSetting {
  lastTipsShown = 'lastTipsShown',
  projectsFolder = 'projectsFolder',
  suggestNPMInstall = 'suggestNPMInstall',
}

export function getSetting(key: WorkspaceSetting): any {
  return exState.context.workspaceState.get(key);
}

export async function setSetting(key: WorkspaceSetting, value: any): Promise<void> {
  await exState.context.workspaceState.update(key, value);
}

export function getExtSetting(key: ExtensionSetting): any {
  return workspace.getConfiguration(WorkspaceSection).get(key);
}

function setExtSetting(key: ExtensionSetting, value: any): any {
  return workspace.getConfiguration(WorkspaceSection).update(key, value);
}

export function getGlobalSetting(key: GlobalSetting): any {
  return exState.context.globalState.get(key);
}

export async function setGlobalSetting(key: GlobalSetting, value: any): Promise<void> {
  return await exState.context.globalState.update(key, value);
}
