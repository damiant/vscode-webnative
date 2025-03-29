import { join } from 'path';
import {
  Webview,
  WebviewPanel,
  window,
  Uri,
  ViewColumn,
  QuickPickItemKind,
  DebugConfiguration,
  debug,
  commands,
} from 'vscode';
import { exState } from './wn-tree-provider';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { debugSkipFiles, openUri } from './utilities';
import { cancelLastOperation } from './tasks';

enum MessageType {
  setMobile = 'setMobile',
  setWeb = 'setWeb',
  device = 'device',
  stopSpinner = 'stopSpinner',
}

interface device {
  name: string;
  width: number;
  height: number;
  type: string;
  icon?: string;
}

function iconFor(name: string) {
  return {
    light: Uri.file(join(__filename, '..', '..', 'resources', 'light', name + '.svg')),
    dark: Uri.file(join(__filename, '..', '..', 'resources', 'dark', name + '.svg')),
  };
}

const devices: Array<device> = [
  { name: 'Web', width: 0, height: 0, type: 'web', icon: '$(globe)' },
  { name: 'Mobile Responsive', width: 0, height: 0, type: 'mobile' },
  { name: 'iPhone SE', width: 375, height: 667, type: 'ios' },
  { name: 'iPhone XR', width: 414, height: 896, type: 'ios' },
  { name: 'iPhone 12 Pro', width: 390, height: 844, type: 'ios' },
  { name: 'iPad Air', width: 820, height: 1180, type: 'ios' },
  { name: 'iPad Mini', width: 768, height: 1024, type: 'ios' },
  { name: 'Pixel 3', width: 393, height: 786, type: 'android' },
  { name: 'Pixel 5', width: 393, height: 851, type: 'android' },
  { name: 'Samsung Galaxy S8+', width: 360, height: 740, type: 'android' },
  { name: 'Samsung Galaxy S20 Ultra', width: 412, height: 915, type: 'android' },
  { name: 'Samsung Galaxy Tab S4', width: 712, height: 1138, type: 'android' },
];

let lastUrl = '';
const id = `w${Math.random()}`;

export function viewInEditor(
  url: string,
  active?: boolean,
  existingPanel?: boolean,
  stopSpinner?: boolean,
  overrideAsWeb?: boolean, // Force Web
): WebviewPanel {
  const panel = existingPanel
    ? exState.webView
    : window.createWebviewPanel('viewApp', 'Preview', active ? ViewColumn.Active : ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });
  lastUrl = url;
  const extensionUri = exState.context.extensionUri;
  panel.webview.html = url ? getWebviewContent(panel.webview, extensionUri) : '';
  panel.iconPath = iconFor('globe');
  if (!existingPanel) {
    commands.executeCommand('workbench.action.closeSidebar');
  }
  let device = getSetting(WorkspaceSetting.emulator);

  if (overrideAsWeb) {
    device = devices[0];
  }
  const assetsUri = getUri(panel.webview, extensionUri, ['preview', 'build', 'assets']).toString();

  if (device) {
    panel.title = device.name;
    panel.webview.postMessage({ command: MessageType.device, device, baseUrl: url, id, assetsUri });
  }
  if (existingPanel || stopSpinner) {
    panel.webview.postMessage({ command: MessageType.stopSpinner });
  }

  if ((panel as any).initialized) return panel;
  (panel as any).initialized = true;
  panel.webview.onDidReceiveMessage(async (message) => {
    console.log(message);
    for (const device of devices) {
      if (message.command == device.name) {
        setSetting(WorkspaceSetting.emulator, device);
        panel.title = device.name;
        panel.webview.postMessage({ command: MessageType.device, device });
        return;
      }
    }
    if (message.command == 'browser') {
      openUri(lastUrl);
      return;
    }
    if (message.command == 'add') {
      console.log('add');
      viewInEditor(lastUrl, true, false, true);
      return;
    }

    const device = await selectMockDevice();
    if (!device) {
      return;
    }
    setSetting(WorkspaceSetting.emulator, device);
    panel.title = device.name;
    panel.webview.postMessage({ command: MessageType.device, device });
  });
  return panel;
}

export function getDebugBrowserName(): string {
  const browser = getDebugBrowserSetting();
  if (browser == 'pwa-msedge') return 'Microsoft Edge';
  if (browser == 'chrome') return 'Google Chrome';
  return browser;
}

function getDebugBrowserSetting() {
  let browserType: string = getSetting(WorkspaceSetting.debugBrowser);
  if (!browserType) {
    browserType = 'chrome';
  }
  return browserType;
}

export async function debugBrowser(url: string, stopWebServerAfter: boolean) {
  try {
    const launchConfig: DebugConfiguration = {
      type: getDebugBrowserSetting(),
      name: 'Debug Web',
      request: 'launch',
      url: url,
      webRoot: '${workspaceFolder}',
      skipFiles: debugSkipFiles(),
    };

    debug.onDidTerminateDebugSession(async (e) => {
      if (stopWebServerAfter) {
        // This stops the dev server
        await cancelLastOperation();
        // Switch back to Ionic View
        exState.view.reveal(undefined, { focus: true });
      }
    });

    await debug.startDebugging(undefined, launchConfig);
  } catch {
    //
  }
}

async function selectMockDevice(): Promise<device> {
  const last = getSetting(WorkspaceSetting.emulator);
  const picks: any[] = devices.map((device) => {
    let name = device.icon ? `${device.icon} ` : '$(device-mobile) ';
    name += device.width == 0 ? device.name : `${device.name} (${device.width} x ${device.height})`;
    if (device.name == last?.name) {
      name += ' $(check)';
    }
    return name;
  });
  const newWindow = '$(add) New Window';
  picks.push({ label: '', kind: QuickPickItemKind.Separator });
  picks.push(newWindow);
  const newBrowser = `$(globe) Open in Browser`;
  picks.push(newBrowser);

  const selected = await window.showQuickPick(picks, { placeHolder: 'Select Emulated Device' });
  if (!selected) return;
  if (selected == newWindow) {
    viewInEditor(lastUrl, true, false, true);
    return;
  }
  if (selected == newBrowser) {
    openUri(lastUrl);
    return;
  }

  return devices.find((device) => selected.includes(device.name));
}

function getWebviewContent(webview: Webview, extensionUri: Uri) {
  const stylesUri = getUri(webview, extensionUri, ['preview', 'build', 'styles.css']);
  const runtimeUri = getUri(webview, extensionUri, ['preview', 'build', 'runtime.js']);
  const polyfillsUri = getUri(webview, extensionUri, ['preview', 'build', 'polyfills.js']);
  const scriptUri = getUri(webview, extensionUri, ['preview', 'build', 'main.js']);

  const nonce = getNonce();

  // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <!--<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">-->
        <link rel="stylesheet" type="text/css" href="${stylesUri}">
        <titlePreview</title>
      </head>
      <body>
        <app-root></app-root>
        <script type="module" nonce="${nonce}" src="${runtimeUri}"></script>
        <script type="module" nonce="${nonce}" src="${polyfillsUri}"></script>
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>
  `;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}
