import { window } from 'vscode';
import { GlobalSetting, getGlobalSetting, setGlobalSetting } from './workspace-state';
import { alt } from './utilities';

// Feature Flags for experimental options
export const Features = {
  debugAndroid: true, // Whether debugging for Android is turned on
  pluginExplorer: true, // Whether the plugin explorer is shown
  requireLogin: false, // Whether we require the user to be logged in via "ionic login"
};

export function showTips() {
  const tips = getGlobalSetting(GlobalSetting.lastTipsShown);
  const shownAt = tips ? Date.parse(tips) : 0;
  const days = (new Date().getTime() - shownAt) / (1000 * 3600 * 24);
  if (days > 30) {
    window.showInformationMessage(`Ionic Tip: Press ${alt('D')} to debug your app and ${alt('R')} to run it!`, 'OK');
    setGlobalSetting(GlobalSetting.lastTipsShown, new Date().toISOString());
  }
}
