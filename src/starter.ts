import {
  Disposable,
  Webview,
  WebviewPanel,
  window,
  Uri,
  ViewColumn,
  ExtensionContext,
  commands,
  workspace,
} from 'vscode';
import { isWindows, openUri, replaceAll, run, showMessage, toTitleCase } from './utilities';
import { writeWN } from './logging';
import { homedir } from 'os';
import { ExtensionSetting, GlobalSetting, getExtSetting, getGlobalSetting, setGlobalSetting } from './workspace-state';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { CapacitorPlatform } from './capacitor-platform';
import { npmInstall } from './node-commands';
import { frameworks, starterTemplates, targets, Template } from './starter-templates';

enum MessageType {
  getTemplates = 'getTemplates',
  getProjectsFolder = 'getProjectsFolder',
  createProject = 'createProject',
  chooseFolder = 'chooseFolder',
  creatingProject = 'creatingProject',
  openUrl = 'openUrl',
}

export class IonicStartPanel {
  public static currentPanel: IonicStartPanel | undefined;
  private readonly panel: WebviewPanel;
  private disposables: Disposable[] = [];

  private path: string;

  private constructor(panel: WebviewPanel, extensionUri: Uri, path: string, context: ExtensionContext) {
    if (!path) {
      path = extensionUri.fsPath;
    }
    this.panel = panel;
    this.path = path;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = this.getWebviewContent(this.panel.webview, extensionUri);
    this.setWebviewMessageListener(this.panel.webview, extensionUri, path, context);
  }

  public static init(extensionUri: Uri, path: string, context: ExtensionContext, force?: boolean) {
    const manualNewProjects = getExtSetting(ExtensionSetting.manualNewProjects);
    if (manualNewProjects && !force) return;
    if (IonicStartPanel.currentPanel) {
      // If the webview panel already exists reveal it
      IonicStartPanel.currentPanel.panel.reveal(ViewColumn.One);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        'ionicStart',
        // Panel title
        'New',
        ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [Uri.joinPath(extensionUri, 'out'), Uri.joinPath(extensionUri, 'starter', 'build')],
        },
      );

      IonicStartPanel.currentPanel = new IonicStartPanel(panel, extensionUri, path, context);
    }
  }

  public dispose() {
    IonicStartPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private getWebviewContent(webview: Webview, extensionUri: Uri) {
    const stylesUri = getUri(webview, extensionUri, ['starter', 'build', 'styles.css']);
    const runtimeUri = getUri(webview, extensionUri, ['starter', 'build', 'runtime.js']);
    const polyfillsUri = getUri(webview, extensionUri, ['starter', 'build', 'polyfills.js']);
    const scriptUri = getUri(webview, extensionUri, ['starter', 'build', 'main.js']);

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
          <title>New Project</title>
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
        switch (command) {
          case MessageType.getTemplates: {
            const templates: Template[] = starterTemplates;
            const assetsUri = getUri(webview, extensionUri, ['starter', 'build', 'assets']).toString();
            webview.postMessage({ command, templates, assetsUri, frameworks, targets });
            break;
          }
          case MessageType.openUrl: {
            openUri(message.text);
            break;
          }
          case MessageType.getProjectsFolder: {
            webview.postMessage({ command, folder: getProjectsFolder() });
            break;
          }
          case MessageType.chooseFolder: {
            const paths = await window.showOpenDialog({
              defaultUri: isWindows() ? undefined : Uri.parse(getProjectsFolder()),
              canSelectFolders: true,
              canSelectFiles: false,
              canSelectMany: false,
            });
            if (paths && paths.length > 0) {
              let pth = paths[0].path;
              if (isWindows() && pth.startsWith('/')) {
                pth = pth.replace('/', '');
              }
              setProjectsFolder(pth);
              webview.postMessage({ command, folder: paths[0].path });
            }
            break;
          }
          case MessageType.createProject: {
            createProject(JSON.parse(message.text), webview, this);
            break;
          }
        }
      },
      undefined,
      this.disposables,
    );
  }
}

function workspaceFolder() {
  if (!workspace.workspaceFolders) {
    return undefined;
  }
  if (workspace.workspaceFolders.length == 0) {
    return undefined;
  }
  return workspace.workspaceFolders[0].uri.fsPath;
}

function folderEmpty(folder: string) {
  try {
    const files = readdirSync(folder);
    if (!files) return true;
    return files.length == 0;
  } catch {
    return true;
  }
}

function getProjectsFolder() {
  const projectsFolder = getGlobalSetting(GlobalSetting.projectsFolder);
  if (workspaceFolder() && folderEmpty(workspaceFolder())) {
    return workspaceFolder(); // Use the users opened folder if it is empty
  }
  if (!projectsFolder) {
    return isWindows() ? winHomeDir() : homedir();
  }
  return projectsFolder;
}

function winHomeDir() {
  return join(process.env.USERPROFILE, 'Documents');
}

function setProjectsFolder(folder: string) {
  setGlobalSetting(GlobalSetting.projectsFolder, folder);
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

interface Project {
  name: string;
  type: string;
  template: string;
  targets: string[];
}

function getProjectName(name: string): string {
  name = name.toLocaleLowerCase().replace(/ /g, '-');
  return name.replace(/[^a-zA-Z0-9- ]/g, '');
}

function getPackageId(name: string): string {
  let packageId = name.replace(/ /g, '.').replace(/-/g, '.');
  if (!packageId.includes('.')) {
    packageId = `ionic.${packageId}`;
  }

  const parts = packageId.split('.');
  for (const part of parts) {
    if (!isNaN(part as any)) {
      packageId = packageId.replace(part, `v${part}`);
    }
  }
  return packageId.trim();
}

interface ProjectOptions {
  noGit: boolean; // Do not initialize a git repo
  folder: string; // Project folder
  packageId: string; // Package Id
  name: string;
}

function getCommands(project: Project, options: ProjectOptions, commands?: string[]): string[] {
  const isIonic = ['angular-standalone', 'angular', 'react', 'vue'].includes(project.type);
  if (isIonic) return getIonicTemplateCommands(project, options);
  if (project.type == 'plugin') {
    return getCapacitorPluginCommands(project, options);
  }
  commands.push('#' + options.folder);
  return commands.map((c) => {
    let r = replaceAll(c, '$(project-name)', options.name);
    r = replaceAll(r, '$(package-id)', options.packageId);
    return r;
  });
}

function getCapacitorPluginCommands(project: Project, options: ProjectOptions): string[] {
  const nmt = replaceAll(toTitleCase(replaceAll(options.name, '-', ' ')), ' ', '');
  const nm = replaceAll(options.name, ' ', '').toLowerCase();
  const nmp = replaceAll(nm, '-', '.');
  return [
    `npx @capacitor/create-plugin "${nm}" --name "${nm}" --package-id "com.mycompany.${nmp}" --class-name "${nmt}" --author "me" --license MIT --repo https://github.com --description "${nmt} Capacitor Plugin"`,
  ];
}

function getIonicTemplateCommands(project: Project, options: ProjectOptions): string[] {
  const cmds: string[] = [];
  cmds.push(
    `npm create ionic@beta "${options.name}" -- ${project.template} --type ${project.type} --no-git --capacitor --package-id ${options.packageId}`,
  );
  cmds.push('#' + options.folder);

  // Cap Init
  if (project.targets.includes(CapacitorPlatform.android) || project.targets.includes(CapacitorPlatform.ios)) {
    cmds.push(npmInstall(`@capacitor/core`));
    cmds.push(npmInstall(`@capacitor/cli`));
    cmds.push(npmInstall(`@capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar`));
  }

  // Create Platforms
  if (project.targets.includes(CapacitorPlatform.android)) {
    cmds.push(npmInstall('@capacitor/android'));
    cmds.push('npx cap add android');
  }
  if (project.targets.includes(CapacitorPlatform.ios)) {
    cmds.push(npmInstall('@capacitor/ios'));
    cmds.push('npx cap add ios');
  }

  if (options.noGit) {
    cmds.push('git init');
  }
  return cmds;
}

async function createProject(project: Project, webview: Webview, panel: IonicStartPanel) {
  const name = getProjectName(project.name);
  const packageId = getPackageId(name);
  const noGit = !isWindows();
  const folder = join(getProjectsFolder(), name);
  const templates: Template[] = starterTemplates;
  const template = templates.find((t) => t.name == project.template && t.type == project.type);
  if (!template) {
    window.showErrorMessage(`Cannot find template ${project.template} of type ${project.type}`, 'OK');
    return;
  }
  const projectOptions: ProjectOptions = { noGit, folder, packageId, name };
  const cmds: string[] = getCommands(project, projectOptions, template.commands);

  if (existsSync(folder)) {
    // Folder already exists
    window.showInformationMessage(`The folder "${folder}" already exists. Please choose a unique name.`, 'OK');
    return;
  }
  webview.postMessage({ command: MessageType.creatingProject });

  try {
    await runCommands(cmds);
    const folderPathParsed = isWindows() ? folder : folder.split(`\\`).join(`/`);
    // Updated Uri.parse to Uri.file
    const folderUri = Uri.file(folderPathParsed);
    commands.executeCommand(`vscode.openFolder`, folderUri);
  } finally {
    panel.dispose();
  }
}

async function runCommands(cmds: string[]) {
  let folder = getProjectsFolder();
  for (const cmd of cmds) {
    if (cmd.startsWith('#')) {
      folder = cmd.replace('#', '');
      writeWN(`Folder changed to ${folder}`);
    } else {
      writeWN(cmd);
      await run(folder, cmd, undefined, [], undefined, undefined);
    }
  }
}
