import { existsSync, readFileSync } from 'fs';
import { networkInterfaces } from 'os';

import { getConfigurationArgs } from './build-configuration';
import { InternalCommand } from './command-name';
import { exState } from './wn-tree-provider';
import { certPath } from './live-reload';
import { FrameworkType, MonoRepoType } from './monorepo';
import { npmRun, npx, preflightNPMCheck } from './node-commands';
import { Project } from './project';
import { liveReloadSSL } from './live-reload';
import {
  ExtensionSetting,
  getExtSetting,
  getSetting,
  setSetting,
  WorkspaceSection,
  WorkspaceSetting,
} from './workspace-state';
import { getWebConfiguration, WebConfigSetting } from './web-configuration';
import { window, workspace } from 'vscode';
import { write, writeError } from './logging';
import { createServer } from 'http';
import { join } from 'path';
import { viewInEditor } from './preview';
import { exists } from './analyzer';

/**
 * Create the ionic serve command
 * @param  {boolean} isNative Whether we are serving iOS or Android (for live reload)
 * @returns string
 */
export async function serve(
  project: Project,
  dontOpenBrowser: boolean,
  isDebugging?: boolean,
  isNative?: boolean,
): Promise<string> {
  exState.lastRun = undefined;
  switch (project.repoType) {
    case MonoRepoType.none:
      return runServe(project, dontOpenBrowser, isDebugging, isNative);
    case MonoRepoType.nx:
      return nxServe(project);
    case MonoRepoType.npm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
    case MonoRepoType.folder:
      return InternalCommand.cwd + (await runServe(project, dontOpenBrowser, isDebugging));
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

async function runServe(
  project: Project,
  dontOpenBrowser: boolean,
  isDebugging?: boolean,
  isNative?: boolean,
): Promise<string> {
  const preop = preflightNPMCheck(project);
  const httpsForWeb = getSetting(WorkspaceSetting.httpsForWeb);
  const webConfig: WebConfigSetting = getWebConfiguration();
  let externalIP = !getExtSetting(ExtensionSetting.internalAddress);
  let defaultPort: number | undefined = workspace.getConfiguration(WorkspaceSection).get('defaultPort');

  if (exists('next')) {
    // Disable options for nextjs apps
    externalIP = undefined;
    defaultPort = undefined;
  }

  if (webConfig.includes(WebConfigSetting.editor)) {
    exState.webView = viewInEditor('about:blank', true);
  }
  let serveFlags = '';
  exState.dontOpenBrowser = dontOpenBrowser;
  if (project.frameworkType === 'angular-standalone') {
    if (
      [WebConfigSetting.editor, WebConfigSetting.nexus, WebConfigSetting.none].includes(webConfig) ||
      dontOpenBrowser
    ) {
      serveFlags += ' --no-open';
    } else {
      serveFlags += ' --open';
    }
  }

  if (externalIP) {
    serveFlags += ` ${await externalArg(isNative)}`;
  }

  if (defaultPort) {
    const port = await findNextPort(defaultPort, externalIP ? '0.0.0.0' : undefined);
    serveFlags += ` --port=${port}`;
    exState.servePort = port;
  }

  if (exState.project) {
    serveFlags += ` --project=${exState.project}`;
  }

  serveFlags += getConfigurationArgs(isDebugging);

  if (httpsForWeb) {
    serveFlags += ' --ssl';
    if (!existsSync(certPath('crt'))) {
      liveReloadSSL(project);
      return '';
    }
    serveFlags += ` --ssl-cert='${certPath('crt')}'`;
    serveFlags += ` --ssl-key='${certPath('key')}'`;
  }
  // if (liveReload) {
  //   serveFlags += ` --live-reload`;
  // }

  return `${preop}${npx(project)} ${serveCmd(project)}${serveFlags}`;
}

function serveCmd(project: Project): string {
  switch (project.frameworkType) {
    case 'angular':
    case 'angular-standalone':
      return 'ng serve';
    case 'vue-vite':
    case 'react-vite':
      return 'vite';
    case 'react':
      return 'react-scripts start';
    case 'vue':
      return 'vue-cli-service serve';
    default: {
      const cmd = guessServeCommand(project) + ' -- ';
      if (cmd) {
        return cmd;
      }
      writeError(`serve command is not know for this project type`);
    }
  }
}

function guessServeCommand(project: Project): string | undefined {
  const filename = join(project.projectFolder(), 'package.json');
  if (existsSync(filename)) {
    const packageFile = JSON.parse(readFileSync(filename, 'utf8'));
    if (packageFile.scripts['ionic:serve']) {
      return npmRun('ionic:serve');
    } else if (packageFile.scripts?.serve) {
      return npmRun('serve');
    } else if (packageFile.scripts?.dev) {
      return npmRun('dev');
    } else if (packageFile.scripts?.start) {
      return npmRun('start');
    }
  }
  return undefined;
}

async function findNextPort(port: number, host: string | undefined): Promise<number> {
  let availablePort = port;
  while (await isPortInUse(availablePort, host)) {
    write(`Port ${availablePort} is in use.`);
    availablePort++;
  }
  return availablePort;
}

async function isPortInUse(port: number, host: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Port is currently in use
        resolve(true);
      } else {
        // Other error occurred
        resolve(false);
      }
    });

    server.once('listening', () => {
      // Close the server if listening doesn't fail
      server.close();
      resolve(false);
    });

    server.listen(port, host);
  });
}

async function externalArg(isNative?: boolean): Promise<string> {
  const liveReload = getSetting(WorkspaceSetting.liveReload);
  if (liveReload && isNative) {
    const host = await selectExternalIPAddress();
    return `--host=${host}`;
  } else {
    // Angular prefers --host=[ip]
    if (!exists('@angular/core')) {
      return '--host';
    } else {
      return '--host=0.0.0.0';
    }
  }
  return `--host=${bestAddress()}`;
}

function bestAddress(): string {
  const list = getAddresses();
  return list.length == 1 ? list[0] : '0.0.0.0';
}

function nxServe(project: Project): string {
  let serveFlags = '';
  const externalIP = !getExtSetting(ExtensionSetting.internalAddress);
  if (externalIP) {
    serveFlags += ` --host=${bestAddress()}`;
  }
  return `${npx(project)} nx serve ${project.monoRepo.name}${serveFlags}`;
}

export async function selectExternalIPAddress(): Promise<string> {
  const liveReload = getSetting(WorkspaceSetting.liveReload);
  const externalIP = !getExtSetting(ExtensionSetting.internalAddress);
  if (!externalIP && !liveReload) {
    return;
  }
  const list = getAddresses();
  if (list.length <= 1) {
    return list[0];
  }
  const lastIPAddress = getSetting(WorkspaceSetting.lastIPAddress);
  for (const address of list) {
    if (address == lastIPAddress) {
      return lastIPAddress;
    }
  }
  const selected = await window.showQuickPick(list, {
    placeHolder: 'Select the external network address to use',
  });
  if (selected) {
    setSetting(WorkspaceSetting.lastIPAddress, selected);
  }
  return selected;
}

function getAddresses(): Array<string> {
  const nets = networkInterfaces();
  const result = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      // Skip over link-local addresses (same as Ionic CLI)
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        result.push(net.address);
      }
    }
  }
  return result;
}
