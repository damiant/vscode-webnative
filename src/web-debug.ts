import { window } from 'vscode';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';

export enum WebDebugSetting {
  edge = 'pwa-msedge',
  chrome = 'chrome',
}

export function getWebDebugSetting(): WebDebugSetting {
  const setting = getSetting(WorkspaceSetting.debugBrowser);
  if (setting) {
    return setting;
  } else {
    return WebDebugSetting.edge;
  }
}

export async function webDebugSetting(): Promise<void> {
  const setting = getSetting(WorkspaceSetting.debugBrowser);
  const configs = [
    check(WebDebugSetting.edge, setting, 'Microsoft Edge'),
    check(WebDebugSetting.chrome, setting, 'Google Chrome'),
  ];

  const selection = await window.showQuickPick(configs, {
    placeHolder: 'Select the debuggable Browser',
  });
  if (selection) {
    const value = selection.includes('Edge') ? WebDebugSetting.edge : WebDebugSetting.chrome;
    setSetting(WorkspaceSetting.debugBrowser, value);
  }
}

function check(msg: string, setting: string, title: string): string {
  if (msg === setting) {
    return title + ` $(check)`;
  }
  return title;
}
