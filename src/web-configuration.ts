import { commands, window } from 'vscode';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { Context, VSCommand } from './context-variables';

export enum WebConfigSetting {
  nexus = 'WebConfigNexusBrowser',
  browser = 'WebConfigWebBrowser',
  editor = 'WebConfigEditor',
  none = 'WebConfigNone',
}

export function getWebConfiguration(): WebConfigSetting {
  const setting = getSetting(WorkspaceSetting.webAction);
  if (setting) {
    return setting;
  } else {
    return WebConfigSetting.browser;
  }
}

export async function setWebConfig(setting: WebConfigSetting) {
  setSetting(WorkspaceSetting.webAction, setting);
  commands.executeCommand(VSCommand.setContext, Context.webConfig, setting);
}
