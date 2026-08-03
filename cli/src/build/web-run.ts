import { existsSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { networkInterfaces } from 'os';
import { join } from 'path';
import { Project } from '../project/project';
import { getRunConfigurationArgs } from './build-configuration';
import { CommandResult, finalizeCommand } from './command-result';
import { certPath, liveReloadSSL } from './live-reload';
import { MonoRepoType } from '../project/monorepo';
import { commandContext, npmRun, npx, preflightNPMCheck } from './node-commands';

export interface ServeOptions {
  dontOpenBrowser?: boolean;
  isDebugging?: boolean;
  isNative?: boolean;
  httpsForWeb?: boolean;
  externalIP?: boolean;
  defaultPort?: number;
  runConfiguration?: string;
  projectName?: string;
  /** Selected external IP for live reload (replaces interactive quick-pick). */
  host?: string;
  /** When true, create SSL certs if missing instead of returning empty command. */
  createCerts?: boolean;
}

export interface ServeResult {
  command: CommandResult;
  port?: number;
}

/**
 * Create the ionic serve command
 */
export async function serve(project: Project, options: ServeOptions = {}): Promise<ServeResult> {
  const dontOpenBrowser = options.dontOpenBrowser ?? false;
  switch (project.repoType) {
    case MonoRepoType.none:
      return runServe(project, dontOpenBrowser, options);
    case MonoRepoType.nx:
      return { command: finalizeCommand(project, nxServe(project, options)) };
    case MonoRepoType.bun:
    case MonoRepoType.npm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
    case MonoRepoType.folder:
      return runServe(project, dontOpenBrowser, options);
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

async function runServe(project: Project, dontOpenBrowser: boolean, options: ServeOptions): Promise<ServeResult> {
  const preop = preflightNPMCheck(project);
  let externalIP = options.externalIP;
  let defaultPort = options.defaultPort;

  if (project.analyzer.exists('next')) {
    externalIP = undefined;
    defaultPort = undefined;
  }

  let serveFlags = '';
  if (project.frameworkType === 'angular-standalone') {
    if (dontOpenBrowser) {
      serveFlags += ' --no-open';
    } else {
      serveFlags += ' --open';
    }
  }

  if (externalIP) {
    serveFlags += ` ${await externalArg(project, options.isNative, options.host)}`;
  }

  let port: number | undefined;
  if (defaultPort) {
    port = await findNextPort(defaultPort, externalIP ? '0.0.0.0' : undefined);
    serveFlags += ` --port=${port}`;
  }

  if (options.projectName) {
    serveFlags += ` --project=${options.projectName}`;
  }

  serveFlags += getRunConfigurationArgs(options.runConfiguration, options.isDebugging);

  if (options.httpsForWeb) {
    serveFlags += ' --ssl';
    if (!existsSync(certPath('crt'))) {
      if (options.createCerts) {
        await liveReloadSSL(project);
      }
      return { command: '', port };
    }
    serveFlags += ` --ssl-cert='${certPath('crt')}'`;
    serveFlags += ` --ssl-key='${certPath('key')}'`;
  }

  const ctx = commandContext(project);
  const cmd = `${preop}${npx(project)} ${serveCmd(project, ctx)}${serveFlags}`;
  return { command: finalizeCommand(project, cmd), port };
}

function serveCmd(project: Project, ctx: ReturnType<typeof commandContext>): string {
  const guessed = guessServeCommand(project, ctx);
  if (guessed) {
    return guessed + ' -- ';
  }
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
    default:
      if (project.analyzer.exists('vite')) {
        return 'vite';
      }
      console.error(
        'Unable to determine the command used to serve your web application. Please add a "serve" script to your package.json.',
      );
      return '';
  }
}

function guessServeCommand(project: Project, ctx: ReturnType<typeof commandContext>): string | undefined {
  const filename = join(project.projectFolder(), 'package.json');
  if (existsSync(filename)) {
    const packageFile = JSON.parse(readFileSync(filename, 'utf8'));
    if (packageFile.scripts?.['wn:serve']) {
      return npmRun('wn:serve', ctx);
    } else if (packageFile.scripts?.['ionic:serve']) {
      return npmRun('ionic:serve', ctx);
    } else if (packageFile.scripts?.serve) {
      return npmRun('serve', ctx);
    } else if (packageFile.scripts?.dev) {
      return npmRun('dev', ctx);
    } else if (packageFile.scripts?.start) {
      return npmRun('start', ctx);
    }
  }
  return undefined;
}

export async function findNextPort(port: number, host: string | undefined): Promise<number> {
  let availablePort = port;
  while (await isPortInUse(availablePort, host)) {
    availablePort++;
  }
  return availablePort;
}

export async function isPortInUse(port: number, host: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port, host);
  });
}

async function externalArg(project: Project, isNative?: boolean, host?: string): Promise<string> {
  if (isNative && host) {
    return `--host=${host}`;
  }
  if (!project.analyzer.exists('@angular/core')) {
    return '--host';
  }
  return '--host=0.0.0.0';
}

function bestAddress(): string {
  const list = getExternalAddresses();
  return list.length === 1 ? list[0] : '0.0.0.0';
}

function nxServe(project: Project, options: ServeOptions): string {
  let serveFlags = '';
  if (options.externalIP) {
    serveFlags += ` --host=${bestAddress()}`;
  }
  return `${npx(project)} nx serve ${project.monoRepo.name}${serveFlags}`;
}

/** Return external IPv4 addresses suitable for device live reload. */
export function getExternalAddresses(): string[] {
  const nets = networkInterfaces();
  const result: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        result.push(net.address);
      }
    }
  }
  return result;
}

/** Resolve the external IP to use; prefers `host`, then `lastHost`, then the sole address. */
export function resolveExternalHost(host?: string, lastHost?: string): string | undefined {
  const list = getExternalAddresses();
  if (host) return host;
  if (list.length <= 1) return list[0];
  if (lastHost && list.includes(lastHost)) return lastHost;
  return undefined;
}

// Legacy alias
export const selectExternalIPAddress = resolveExternalHost;
