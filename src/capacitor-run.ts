import { existsSync } from 'fs';
import { exists, isLess } from './analyzer';
import { CapacitorPlatform } from './capacitor-platform';
import { InternalCommand } from './command-name';
import { writeError, writeWN } from './logging';
import { build } from './build';
import { exState } from './tree-provider';
import { certPath, liveReloadSSL } from './live-reload';
import { MonoRepoType } from './monorepo';
import { npx, preflightNPMCheck } from './node-commands';
import { Project } from './project';
import { gradleToJson } from './gradle-to-json';
import { ExtensionSetting, getExtSetting, getSetting, WorkspaceSection, WorkspaceSetting } from './workspace-state';
import { window, workspace } from 'vscode';
import { join } from 'path';
import { serve } from './web-run';
import { isWindows } from './utilities';

/**
 * Creates the command line to run for Capacitor
 * @param  {CapacitorPlatform} platform
 * @param  {Project} project
 * @returns string
 */
export async function capacitorRun(project: Project, platform: CapacitorPlatform): Promise<string> {
  let preop = '';
  let rebuilt = false;
  let noSync = false;

  // If the user modified something in the editor then its likely they need to rebuild the app before running
  if (exState.projectDirty) {
    writeWN('Rebuilding as you changed your project...');
    preop = (await build(project, { platform })) + ' && ';
    rebuilt = true;
  } else {
    preop = preflightNPMCheck(project);
  }

  noSync = exState.syncDone.includes(platform);

  exState.refreshDebugDevices = true;
  exState.lastRun = platform;

  switch (project.repoType) {
    case MonoRepoType.none:
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.bun:
    case MonoRepoType.npm:
      return preop + (await capRun(platform, project.repoType, rebuilt, noSync, project));
    case MonoRepoType.nx:
      return preop + (await nxRun(platform, project.repoType, rebuilt, noSync, project));
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

export function capacitorDevicesCommand(platform: CapacitorPlatform, project: Project): string {
  const ionic = useIonicCLI() ? 'ionic ' : '';
  return `${npx(project)} ${ionic}cap run ${platform} --list`;
}

export function useIonicCLI(): boolean {
  if (exists('@capacitor/cli')) {
    return false;
  }
  return exists('@ionic/cli');
}

async function capRun(
  platform: CapacitorPlatform,
  repoType: MonoRepoType,
  noBuild: boolean,
  noSync: boolean,
  project: Project,
): Promise<string> {
  let liveReload = getSetting(WorkspaceSetting.liveReload);
  const externalIP = !getExtSetting(ExtensionSetting.internalAddress) && liveReload;
  const httpsForWeb = getSetting(WorkspaceSetting.httpsForWeb);
  const prod: boolean = workspace.getConfiguration(WorkspaceSection).get('buildForProduction');

  if (liveReload && project.repoType == MonoRepoType.npm) {
    writeError('Live Reload is not supported with npm workspaces. Ignoring the live reload option');
    liveReload = false;
  }

  // ionic cli uses --livereload but capacitor cli uses --live-reload
  let capRunFlags = liveReload ? '--live-reload' : '';

  if (liveReload && exists('@ionic-enterprise/auth') && isLess('@ionic-enterprise/auth', '3.9.4')) {
    capRunFlags = '';
    // @ionic-enterprise/auth gets a crypt error when running with an external IP address. So avoid the issue
    writeWN('Live Update was ignored as you have less than v3.9.4 of @ionic-enterprise/auth in your project');
  }

  const ionic = '';

  if (externalIP) {
    if (isLess('@capacitor/core', '7.0.0')) {
      if (capRunFlags.length >= 0) capRunFlags += ' ';
      capRunFlags += '--external';
    }
  }

  if (ionic != '' && prod) {
    if (capRunFlags.length >= 0) capRunFlags += ' ';
    capRunFlags += '--prod';
  }

  // Live reload clashes with --no-build
  // no-build flag was removed with Capacitor 7
  // if (noBuild && !liveReload) {
  //   if (capRunFlags.length >= 0) capRunFlags += ' ';
  //   capRunFlags += '--no-build';
  // }

  if (noSync) {
    if (capRunFlags.length >= 0) capRunFlags += ' ';
    capRunFlags += '--no-sync';
  }

  // cap run doesn't have a --project flag. Removing
  // if (exState.project && exState.project != 'app') {
  //   if (capRunFlags.length >= 0) capRunFlags += ' ';
  //   capRunFlags += `--project=${exState.project}`;
  // }

  if (liveReload) {
    //capRunFlags += getConfigurationArgs();
    capRunFlags += ` --port=${exState.servePort}`;
  }

  const flavors = await getFlavors(platform, project);
  if (flavors == undefined) return;
  capRunFlags += flavors;

  if (externalIP) {
    capRunFlags += InternalCommand.publicHost;
  }
  if (httpsForWeb) {
    if (capRunFlags.length >= 0) capRunFlags += ' ';
    capRunFlags += '--ssl';

    if (!existsSync(certPath('crt'))) {
      liveReloadSSL(project);
      return '';
    }
    capRunFlags += ` -- --ssl-cert='${certPath('crt')}'`;
    capRunFlags += ` --ssl-key='${certPath('key')}'`;
  }

  const pre =
    repoType == MonoRepoType.npm ||
    repoType == MonoRepoType.folder ||
    repoType == MonoRepoType.pnpm ||
    repoType == MonoRepoType.yarn ||
    repoType == MonoRepoType.lerna
      ? InternalCommand.cwd
      : '';

  let post = '';
  const capRunCommand = `${npx(project)} ${ionic}cap run ${platform} --target=${InternalCommand.target} ${capRunFlags}`;
  if (liveReload) {
    const serveCmd = await serve(project, true, false, true);
    if (isWindows()) {
      // On Windows, we must use 'start /B' to run the dev server in a background process.
      // The '&' operator on Windows is sequential (waits for previous command to complete),
      // so we start the dev server first in background, then run cap run in foreground.
      // This ensures both processes run in parallel.
      return `${pre}start /B ${serveCmd} & ${capRunCommand}`;
    } else {
      // On Unix/Mac, the '&' operator runs the previous command in background.
      // So 'cap run & serve' means: run cap run in background, then run serve in foreground.
      post = ` & ${serveCmd}`;
    }
  }
  return `${pre}${capRunCommand}${post}`;
}

async function nxRun(
  platform: CapacitorPlatform,
  repoType: MonoRepoType,
  noBuild: boolean,
  noSync: boolean,
  project: Project,
): Promise<string> {
  if (project.monoRepo?.isNXStandalone) {
    return await capRun(platform, repoType, noBuild, noSync, project);
  }
  // Note: This may change, see: https://github.com/nxtend-team/nxtend/issues/490
  return `${npx(project)} nx run ${project.monoRepo.name}:cap --cmd "run ${platform} --target=${
    InternalCommand.target
  }"`;
}

async function getFlavors(platform: CapacitorPlatform, prj: Project): Promise<string | undefined> {
  if (platform == CapacitorPlatform.ios) {
    return '';
  }

  if (exState.flavors == undefined) {
    exState.flavors = [];
    const buildGradle = join(prj.projectFolder(), 'android', 'app', 'build.gradle');
    const data = gradleToJson(buildGradle);
    if (data?.android?.productFlavors) {
      const list = Object.keys(data.android.productFlavors);
      if (list?.length == 0) {
        return '';
      }
      exState.flavors = list;
    }
  }
  if (exState.flavors.length == 0) {
    return '';
  }

  const selection = await window.showQuickPick(exState.flavors, { placeHolder: 'Select the Android Flavor to run' });
  if (!selection) return undefined;
  return ` --flavor=${selection}`;
}
