import { existsSync } from 'fs';
import { join } from 'path';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { gradleToJson } from '../native/gradle-to-json';
import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { build } from './build';
import { InternalCommand } from './command-name';
import { CommandResult, finalizeCommand } from './command-result';
import { certPath, liveReloadSSL } from './live-reload';
import { isWindows } from './platform';
import { npx, preflightNPMCheck } from './node-commands';
import { serve } from './web-run';

export interface CapRunOptions {
  projectDirty?: boolean;
  syncDone?: CapacitorPlatform[];
  servePort?: number;
  /** Android product flavor; when omitted and flavors exist, returns undefined command. */
  flavor?: string;
  liveReload?: boolean;
  internalAddress?: boolean;
  httpsForWeb?: boolean;
  buildForProduction?: boolean;
  target?: string;
  publicHost?: string;
  createCerts?: boolean;
}

/**
 * Creates the command line to run for Capacitor
 */
export async function capacitorRun(
  project: Project,
  platform: CapacitorPlatform,
  options: CapRunOptions = {},
): Promise<CommandResult | undefined> {
  let preop = '';
  let rebuilt = false;
  const syncDone = options.syncDone ?? [];
  const noSync = syncDone.includes(platform);

  if (options.projectDirty) {
    preop = commandString(await build(project, { platform })) + ' && ';
    rebuilt = true;
  } else {
    preop = preflightNPMCheck(project);
  }

  switch (project.repoType) {
    case MonoRepoType.none:
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.bun:
    case MonoRepoType.npm:
      return finalizeCommand(
        project,
        preop + (await capRun(platform, project.repoType, rebuilt, noSync, project, options)),
      );
    case MonoRepoType.nx:
      return finalizeCommand(
        project,
        preop + (await nxRun(platform, project.repoType, rebuilt, noSync, project, options)),
      );
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function commandString(result: CommandResult): string {
  return typeof result === 'string' ? result : result.command;
}

export function capacitorDevicesCommand(platform: CapacitorPlatform, project: Project): string {
  const ionic = useIonicCLI(project) ? 'ionic ' : '';
  return `${npx(project)} ${ionic}cap run ${platform} --list`;
}

export function useIonicCLI(project: Project): boolean {
  if (project.analyzer.exists('@capacitor/cli')) {
    return false;
  }
  return project.analyzer.exists('@ionic/cli');
}

async function capRun(
  platform: CapacitorPlatform,
  repoType: MonoRepoType,
  _noBuild: boolean,
  noSync: boolean,
  project: Project,
  options: CapRunOptions,
): Promise<string> {
  let liveReload = options.liveReload ?? false;
  const externalIP = !options.internalAddress && liveReload;
  const httpsForWeb = options.httpsForWeb ?? false;
  const prod = options.buildForProduction ?? false;

  if (liveReload && project.repoType === MonoRepoType.npm) {
    console.error('Live Reload is not supported with npm workspaces. Ignoring the live reload option');
    liveReload = false;
  }

  let capRunFlags = liveReload ? '--live-reload' : '';

  if (
    liveReload &&
    project.analyzer.exists('@ionic-enterprise/auth') &&
    project.analyzer.isLess('@ionic-enterprise/auth', '3.9.4')
  ) {
    capRunFlags = '';
    console.warn('Live Update was ignored as you have less than v3.9.4 of @ionic-enterprise/auth in your project');
  }

  const ionic = '';

  if (externalIP) {
    if (project.analyzer.isLess('@capacitor/core', '7.0.0')) {
      if (capRunFlags.length >= 0) capRunFlags += ' ';
      capRunFlags += '--external';
    }
  }

  if (ionic !== '' && prod) {
    if (capRunFlags.length >= 0) capRunFlags += ' ';
    capRunFlags += '--prod';
  }

  if (noSync) {
    if (capRunFlags.length >= 0) capRunFlags += ' ';
    capRunFlags += '--no-sync';
  }

  if (liveReload && options.servePort) {
    capRunFlags += ` --port=${options.servePort}`;
  }

  const flavors = getFlavors(platform, project, options.flavor);
  if (flavors === undefined) return '';
  capRunFlags += flavors;

  if (externalIP && options.publicHost) {
    capRunFlags += ` --public-host=${options.publicHost}`;
  } else if (externalIP) {
    capRunFlags += ` ${InternalCommand.publicHost}`;
  }

  if (httpsForWeb) {
    if (capRunFlags.length >= 0) capRunFlags += ' ';
    capRunFlags += '--ssl';

    if (!existsSync(certPath('crt'))) {
      if (options.createCerts) {
        await liveReloadSSL(project);
      }
      return '';
    }
    capRunFlags += ` -- --ssl-cert='${certPath('crt')}'`;
    capRunFlags += ` --ssl-key='${certPath('key')}'`;
  }

  const target = options.target ?? InternalCommand.target;
  let post = '';
  const capRunCommand = `${npx(project)} ${ionic}cap run ${platform} --target=${target} ${capRunFlags}`;
  if (liveReload) {
    const serveResult = await serve(project, {
      dontOpenBrowser: true,
      isDebugging: false,
      isNative: true,
      createCerts: options.createCerts,
    });
    const serveCmd = commandString(serveResult.command);
    if (isWindows()) {
      return `start /B ${serveCmd} & ${capRunCommand}`;
    }
    post = ` & ${serveCmd}`;
  }
  return `${capRunCommand}${post}`;
}

async function nxRun(
  platform: CapacitorPlatform,
  _repoType: MonoRepoType,
  noBuild: boolean,
  noSync: boolean,
  project: Project,
  options: CapRunOptions,
): Promise<string> {
  if (project.monoRepo?.isNXStandalone) {
    return capRun(platform, project.repoType, noBuild, noSync, project, options);
  }
  const target = options.target ?? InternalCommand.target;
  return `${npx(project)} nx run ${project.monoRepo.name}:cap --cmd "run ${platform} --target=${target}"`;
}

function getFlavors(platform: CapacitorPlatform, prj: Project, selected?: string): string | undefined {
  if (platform === CapacitorPlatform.ios) {
    return '';
  }

  const buildGradle = join(prj.projectFolder(), 'android', 'app', 'build.gradle');
  const data = gradleToJson(buildGradle);
  const list: string[] = [];
  if (data?.android?.productFlavors) {
    list.push(...Object.keys(data.android.productFlavors));
  }
  if (list.length === 0) {
    return '';
  }
  if (!selected) {
    return undefined;
  }
  return ` --flavor=${selected}`;
}

/** List Android product flavors from build.gradle, if any. */
export function listAndroidFlavors(project: Project): string[] {
  const buildGradle = join(project.projectFolder(), 'android', 'app', 'build.gradle');
  const data = gradleToJson(buildGradle);
  if (data?.android?.productFlavors) {
    return Object.keys(data.android.productFlavors);
  }
  return [];
}
