import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn, ExtensionContext } from 'vscode';
import { PluginSummary, Plugin } from './plugin-summary';
import { getRunOutput, httpRequest, showProgress } from './utilities';
import { existsSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { PackageManager, npmInstall, npmUninstall } from './node-commands';
import { run } from './utilities';
import { ProjectSummary, inspectProject } from './project';
import { PackageInfo } from './package-info';
import { IonicTreeProvider, ionicState } from './wn-tree-provider';
import { clearOutput, write } from './logging';
import { findCompatibleVersion2 } from './peer-dependencies';
import { getPackageVersion } from './analyzer';
import { capacitorSync } from './capacitor-sync';
import { packageUpgrade } from './rules-package-upgrade';

interface Dependency {
  name: string;
  version: string;
  latest: string;
}

enum MessageType {
  getPlugins = 'getPlugins',
  getInstalledDeps = 'getInstalledDeps',
  install = 'install',
  getPlugin = 'getPlugin',
  uninstall = 'uninstall',
  chooseVersion = 'choose-version',
}

export class PluginExplorerPanel {
  public static currentPanel: PluginExplorerPanel | undefined;
  private readonly panel: WebviewPanel;
  private disposables: Disposable[] = [];
  private provider: IonicTreeProvider;
  private path: string;

  private constructor(
    panel: WebviewPanel,
    extensionUri: Uri,
    path: string,
    context: ExtensionContext,
    provider: IonicTreeProvider,
  ) {
    this.panel = panel;
    this.path = path;
    this.provider = provider;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = this.getWebviewContent(this.panel.webview, extensionUri);
    this.setWebviewMessageListener(this.panel.webview, extensionUri, path, context);
  }

  public static init(extensionUri: Uri, path: string, context: ExtensionContext, provider: IonicTreeProvider) {
    if (PluginExplorerPanel.currentPanel) {
      // If the webview panel already exists reveal it
      PluginExplorerPanel.currentPanel.provider = provider;
      PluginExplorerPanel.currentPanel.panel.reveal(ViewColumn.One);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        'pluginExplorer',
        // Panel title
        'Plugins',
        ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            Uri.joinPath(extensionUri, 'out'),
            Uri.joinPath(extensionUri, 'plugin-explorer', 'build'),
          ],
        },
      );

      PluginExplorerPanel.currentPanel = new PluginExplorerPanel(panel, extensionUri, path, context, provider);
    }
  }

  public dispose() {
    PluginExplorerPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getWebviewContent(webview: Webview, extensionUri: Uri) {
    const stylesUri = getUri(webview, extensionUri, ['plugin-explorer', 'build', 'styles.css']);
    const runtimeUri = getUri(webview, extensionUri, ['plugin-explorer', 'build', 'runtime.js']);
    const polyfillsUri = getUri(webview, extensionUri, ['plugin-explorer', 'build', 'polyfills.js']);
    const scriptUri = getUri(webview, extensionUri, ['plugin-explorer', 'build', 'main.js']);

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
          <title>Plugins</title>
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

  private setWebviewMessageListener(webview: Webview, extensionUri: Uri, path: string, context: ExtensionContext) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;
        const text = message.text;
        switch (command) {
          case MessageType.install: {
            // Code that should run in response to the hello message command
            this.install(text);
            break;
          }
          case MessageType.uninstall: {
            this.uninstall(text);
            break;
          }
          case MessageType.chooseVersion: {
            const changed = await this.chooseVersion(text, path);
            webview.postMessage({ command, changed });
            break;
          }
          case MessageType.getInstalledDeps: {
            const list = await getInstalledDeps(path, context);
            webview.postMessage({ command, list });
            break;
          }
          case MessageType.getPlugin: {
            const data = await getPluginInfo(text, path);
            webview.postMessage({ command, data });
            break;
          }
          case MessageType.getPlugins: {
            const list = await getInstalledDeps(path, context);
            webview.postMessage({ command: MessageType.getInstalledDeps, list });
            const uri = await fetchPluginData(webview, extensionUri);
            const assetsUri = getUri(webview, extensionUri, ['plugin-explorer', 'build', 'assets']).toString();
            webview.postMessage({ command, uri: `${uri}`, assetsUri: assetsUri });
            break;
          }
        }
      },
      undefined,
      this.disposables,
    );
  }

  async checkEnterpriseRegister(plugin: string): Promise<boolean> {
    if (ionicState.packageManager !== PackageManager.npm) {
      return;
    }
    if (!plugin.startsWith('@ionic-enterprise/')) {
      return;
    }

    if (this.hasProductKey()) {
      return;
    }

    const productKey = await window.showInputBox({
      title: 'Ionic Enterprise Product Key',
      placeHolder: 'Enter product key',
    });
    if (productKey == '') {
      return true;
    }
    if (!productKey) return false;
    const cmd = `npx ionic enterprise register --key=${productKey}`;
    return await run(this.path, cmd, undefined, [], [], undefined, undefined, undefined, false);
  }

  hasProductKey(): boolean {
    const npmrc = join(this.path, '.npmrc');
    if (existsSync(npmrc)) {
      const data = readFileSync(npmrc, 'utf-8');
      if (data.includes('@ionic-enterprise') && data.includes('_authToken')) {
        return true;
      }
    }
    return false;
  }

  async install(plugin: string) {
    const pluginVersion = await findBestVersion(plugin);
    if (!pluginVersion) return;
    if (pluginVersion.endsWith(getPackageVersion(plugin))) {
      // Already installed latest possible
      window.showInformationMessage(`Version ${getPackageVersion(plugin)} of ${plugin} is already installed.`, 'OK');
      return;
    }
    const cmd = npmInstall(pluginVersion);
    const result = await this.checkEnterpriseRegister(plugin);
    if (result == false) return;
    this.dispose();

    await showProgress(`Installing ${plugin}`, async () => {
      write(`> ${cmd}`);
      await run(this.path, cmd, undefined, [], [], undefined, undefined, undefined, false);
      await run(
        this.path,
        await capacitorSync(ionicState.projectRef),
        undefined,
        [],
        [],
        undefined,
        undefined,
        undefined,
        false,
      );
      this.provider.refresh();
      window.showInformationMessage(`${plugin} was installed.`, 'OK');
    });
  }

  async chooseVersion(plugin: string, folder: string): Promise<boolean> {
    const updated = await packageUpgrade({ name: plugin, version: '' }, folder);
    this.provider.refresh();
    return updated;
  }

  async uninstall(plugin: string) {
    this.dispose();
    const cmd = npmUninstall(plugin);
    await showProgress(`Uninstalling ${plugin}`, async () => {
      clearOutput();
      write(`> ${cmd}`);
      await run(this.path, cmd, undefined, [], [], undefined, undefined, undefined, false);
      this.provider.refresh();
      window.showInformationMessage(`${plugin} was removed.`, 'OK');
    });
  }
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

async function getInstalledDeps(path: string, context: ExtensionContext): Promise<Dependency[]> {
  const summary: ProjectSummary = await inspectProject(path, context, undefined);
  const dependencies: Dependency[] = [];
  for (const libType of ['Capacitor Plugin', 'Plugin']) {
    for (const library of Object.keys(summary.packages).sort()) {
      const pkg: PackageInfo = summary.packages[library];
      if (pkg.depType == libType) {
        dependencies.push({ name: library, version: pkg.version, latest: pkg.latest });
      }
    }
  }
  return dependencies;
}

async function fetchPluginData(webview: Webview, extensionUri: Uri): Promise<Uri> {
  const path = join(extensionUri.fsPath, 'plugin-explorer', 'build', 'plugins.json');

  // Download plugin data again if we havent before or its been 24 hours
  if (!existsSync(path) || ageInHours(path) > 12) {
    //const url = `https://capacitorjs.com/directory/plugin-data-raw.json`;
    const json = (await httpRequest('GET', 'capacitorjs.com', '/directory/plugin-data-raw.json')) as PluginSummary;
    writeFileSync(path, JSON.stringify(json));
  }
  return getUri(webview, extensionUri, ['plugin-explorer', 'build', 'plugins.json']);
}

async function getPluginInfo(name: string, path: string): Promise<Plugin> {
  // The UI is searching for a particular plugin or dependency.
  // As not all packages are indexed and may not even be a plugin we search and return info
  if (!name) return undefined;
  try {
    const p: any = JSON.parse(await getRunOutput(`npm view ${name} --json`, path, undefined, true));

    //const p: any = await httpRequest('GET', `registry.npmjs.org`, `/${name}`);
    if (!p.name) {
      console.error(`getPluginInfo(${name}}) ${p}`);
      return undefined;
    }
    const gh = p.repository?.url ? await getGHInfo(p.repository.url) : undefined;
    const data: Plugin = {
      name: p.name,
      version: p.version,
      success: [],
      fails: [],
      versions: [],
      description: p.description,
      author: p.author,
      bugs: p.bugs?.url,
      image: gh?.owner?.avatar_url,
      stars: gh?.stargazers_count,
      fork: gh?.fork,
      updated: gh?.updated_at,
      published: p.time.modified,
      keywords: p.keywords,
      repo: cleanRepo(p.repository?.url),
      license: p.license,
    };
    console.log(`Found npm package ${name}`, p);
    return data;
  } catch (error) {
    console.error(`getPluginInfo(${name})`, error);
    return undefined;
  }
}

function cleanRepo(url: string): string {
  if (url) {
    return url
      .replace('git+', '')
      .replace('ssh://git@', '')
      .replace('.git', '')
      .replace('git://github.com/', 'https://github.com/');
  }
}

async function getGHInfo(repo: string): Promise<any> {
  try {
    if (!repo) return undefined;
    const part = repo
      .replace('https://github.com/', '')
      .replace('.git', '')
      .replace('ssh://git@', '')
      .replace('git+', '')
      .replace('git://github.com/', '');
    console.log(`getGHInfo api.github.com/repos/${part}`);
    const gh = await httpRequest('GET', `api.github.com`, `/repos/${part}`);
    console.log(gh);
    return gh;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

function ageInHours(path: string): number {
  const info = statSync(path);
  const d = new Date(info.mtime);
  const n = new Date();
  return (n.getTime() - d.getTime()) / 3600000;
}

async function findBestVersion(plugin: string): Promise<string> {
  let v = 'latest';
  await showProgress(`Finding the best version of ${plugin} that works with your project`, async () => {
    v = await findCompatibleVersion2({ name: plugin, conflict: undefined });
  });
  if (v == 'latest') {
    const res = await window.showInformationMessage(`${plugin} is not compatible with your project.`, 'Install Anyway');
    if (!res) return;
  }
  return v ? `${plugin}@${v}` : plugin;
}
