import {
  CancellationToken,
  ExtensionContext,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from 'vscode';

import { commands } from 'vscode';
import { CommandName } from './command-name';
import { qrWebView } from './nexus-browser';

export class IonicDevServerProvider implements WebviewViewProvider {
  registered = false;
  constructor(
    private workspaceRoot: string | undefined,
    private context: ExtensionContext,
  ) {}

  resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, token: CancellationToken) {
    if (this.registered) return;
    this.registered = true;
    commands.registerCommand(CommandName.ViewDevServer, (url: string) => {
      const shortUrl = qrWebView(webviewView.webview, url);
      //webviewView.description = shortUrl;
      webviewView.show(true);
    });

    commands.registerCommand(CommandName.hideDevServer, () => {
      // THERE IS NO API TO HIDE/COLLAPSE A VIEW
      const shortUrl = qrWebView(webviewView.webview, undefined);
      //webviewView.show(true);
    });
  }
}
