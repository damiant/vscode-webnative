import { Command, TreeItemCollapsibleState } from 'vscode';
import { debugAndroid } from './android-debug';
import { findDevices, findWebViews } from './android-debug-bridge';
import { Device, WebView } from './android-debug-models';
import { CommandName } from './command-name';
import { exState } from './wn-tree-provider';
import { Recommendation } from './recommendation';
import { QueueFunction, Tip, TipType } from './tip';

export async function getAndroidWebViewList(
  hasCapacitorAndroid: boolean,
  wwwFolder: string,
): Promise<Recommendation[]> {
  if (exState.refreshDebugDevices) {
    exState.refreshDebugDevices = false;
  }
  if (!hasCapacitorAndroid) {
    return [];
  }

  const result: Array<Recommendation> = [];
  const devices = await findDevices();
  for (const device of devices) {
    const webviews = await findWebViews(device!);
    for (const webview of webviews) {
      const r = new Recommendation(
        `Debug ${webview.packageName} ${webview.versionName} on running Android device ${device.product}`,
        `(${device.product})`,
        `${webview.packageName}`,
        TreeItemCollapsibleState.None,
        getCommand(),
        undefined,
      );
      r.setIcon('debug');
      r.tip = new Tip(undefined, undefined, TipType.Run).setQueuedAction(debug, device, webview, wwwFolder).doNotWait();
      r.command.arguments = [r];
      result.push(r);
    }
    if (webviews.length == 0) {
      const r = new Recommendation(
        'test',
        'No Web View',
        device.product,
        TreeItemCollapsibleState.None,
        getCommand(),
        undefined,
      );
      r.setIcon('android');
      result.push(r);
    }
  }
  return result;
}

async function debug(queueFunction: QueueFunction, device: Device, webview: WebView, wwwfolder: string): Promise<void> {
  queueFunction();
  debugAndroid(webview.packageName, wwwfolder);
  return;
}

function getCommand(): Command {
  return {
    command: CommandName.Function,
    title: 'Open',
  };
}
