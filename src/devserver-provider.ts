import {
  CancellationToken,
  ExtensionContext,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from 'vscode';

import { commands } from 'vscode';
import { CommandName } from './command-name';
import { qrWebView } from './webview-debug';

export class DevServerProvider implements WebviewViewProvider {
  registered = false;
  constructor(
    private workspaceRoot: string | undefined,
    private context: ExtensionContext,
  ) {}

  resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, token: CancellationToken) {
    if (this.registered) return;
    this.registered = true;
    commands.registerCommand(CommandName.ViewDevServer, (externalUrl: string, localUrl: string) => {
      const shortUrl = qrWebView(webviewView.webview, externalUrl, localUrl);
      //webviewView.description = shortUrl;
      webviewView.show(true);

      // const value: string = workspace.getConfiguration(WorkspaceSection).get('√');
      // if (value !== 'no' && !exState.dontOpenBrowser) {
      //   openUri(localUrl);
      // }
    });

    commands.registerCommand(CommandName.HideDevServer, () => {
      // THERE IS NO API TO HIDE/COLLAPSE A VIEW
      const shortUrl = qrWebView(webviewView.webview, undefined, undefined);
      //webviewView.show(true);
    });
  }
}
