import { MobileProject, MobileProjectConfig } from '@trapezedev/project';
import { CapacitorProjectState } from './cap-project';
import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { channelShow, getStringFrom, setStringIn } from './utilities';
import { CapProjectCache } from './context-variables';
import { join } from 'path';
import { getCapacitorConfigureFile, updateCapacitorConfig } from './capacitor-config-file';
import { showOutput, write, writeError } from './logging';
import { existsSync, writeFileSync } from 'fs';
import { ExtensionContext, window } from 'vscode';

enum NativePlatform {
  iOSOnly,
  AndroidOnly,
}

let useCapProjectCache = true;

/**
 * Reviews the native app project for bundle id, display name, version and build numbers
 * @param  {Project} project
 * @param  {vscode.ExtensionContext} context
 */
export async function reviewCapacitorConfig(project: Project, context: ExtensionContext) {
  const state = await getCapacitorProjectState(project, context);
  if (!state) {
    return;
  }

  project.setSubGroup('Properties', TipType.Settings, undefined, undefined, true);

  // Allow the user to set the bundle id
  if (state.androidBundleId == state.iosBundleId || !state.iosBundleId || !state.androidBundleId) {
    // Create a single Bundle Id the user can edit
    const bundleId = state.androidBundleId ? state.androidBundleId : state.iosBundleId;
    const tip = new Tip('Bundle Id', bundleId, TipType.None);

    tip.setQueuedAction(setBundleId, bundleId, project, project.folder);
    project.add(tip);
  } else {
    // Bundle Ids different
    const tip = new Tip('Android Bundle Id', state.androidBundleId, TipType.None);
    tip.setQueuedAction(setBundleId, state.androidBundleId, project, project.folder, NativePlatform.AndroidOnly);
    project.add(tip);

    const tip2 = new Tip('iOS Bundle Id', state.iosBundleId, TipType.None);
    tip2.setQueuedAction(setBundleId, state.iosBundleId, project, project.folder, NativePlatform.iOSOnly);
    project.add(tip2);
  }

  // Allow the user to edit the display name of the app
  if (state.androidDisplayName == state.iosDisplayName || !state.iosDisplayName || !state.androidDisplayName) {
    const displayName = state.androidDisplayName ? state.androidDisplayName : state.iosDisplayName;
    const tip = new Tip('Display Name', displayName, TipType.None);
    tip.setQueuedAction(setDisplayName, displayName, project, project.folder);
    project.add(tip);
  } else {
    const tip = new Tip('Android Display Name', state.androidDisplayName, TipType.None);
    tip.setQueuedAction(setDisplayName, state.androidDisplayName, project, project.folder, NativePlatform.AndroidOnly);
    project.add(tip);

    const tip2 = new Tip('iOS Display Name', state.iosDisplayName, TipType.None);
    tip2.setQueuedAction(setDisplayName, state.iosDisplayName, project, project.folder, NativePlatform.iOSOnly);
    project.add(tip2);
  }

  // Allow the user to set the version
  if (state.androidVersion == state.iosVersion || !state.iosVersion || !state.androidVersion) {
    const version = state.androidVersion ? state.androidVersion : state.iosVersion;
    const tip = new Tip('Version Number', version?.toString(), TipType.None);
    tip.setQueuedAction(setVersion, version, project);
    project.add(tip);
  } else {
    const tip = new Tip('Android Version Number', state.androidVersion, TipType.None);
    tip.setQueuedAction(setVersion, state.androidVersion, project, NativePlatform.AndroidOnly);
    project.add(tip);

    const tip2 = new Tip('iOS Version Number', state.iosVersion, TipType.None);
    tip2.setQueuedAction(setVersion, state.iosVersion, project, NativePlatform.iOSOnly);
    project.add(tip2);
  }

  // Allow the user to increment the build
  if (state.androidBuild == state.iosBuild || !state.iosBuild || !state.androidBuild) {
    const build = state.androidBuild ? state.androidBuild : state.iosBuild;
    const tip = new Tip('Build Number', build?.toString(), TipType.None);
    tip.setQueuedAction(setBuild, build, project);
    project.add(tip);
  } else {
    const tip = new Tip('Android Build Number', state.androidBuild?.toString(), TipType.None);
    tip.setQueuedAction(setBuild, state.androidBuild, project, NativePlatform.AndroidOnly);
    project.add(tip);

    const tip2 = new Tip('iOS Build Number', state.iosBuild?.toString(), TipType.None);
    tip2.setQueuedAction(setBuild, state.iosBuild, project, NativePlatform.iOSOnly);
    project.add(tip2);
  }

  project.clearSubgroup();
}

/**
 * Gets the full path using a folder and the webDir property from capacitor.config.ts
 * @param  {string} folder
 * @returns string
 */
export function getCapacitorConfigWebDir(folder: string): string {
  let result = 'www';
  const config = getCapacitorConfigureFile(folder);
  if (config) {
    result = getStringFrom(config, `webDir: '`, `'`);
    if (!result) {
      result = getStringFrom(config, `webDir: "`, `"`);
    }
  }

  if (!result) {
    // No config file take a best guess
    if (existsSync(join(folder, 'www'))) {
      result = 'www';
    } else if (existsSync(join(folder, 'dist'))) {
      result = 'dist';
    } else if (existsSync(join(folder, 'build'))) {
      result = 'build';
    }
  }
  if (!result) {
    result = 'www'; // Assume www folder
  }
  return join(folder, result);
}

async function getCapacitorProjectState(prj: Project, context: ExtensionContext): Promise<CapacitorProjectState> {
  let state: CapacitorProjectState = {};

  const tmp: string = context.workspaceState.get(CapProjectCache(prj));
  if (tmp) {
    if (useCapProjectCache) {
      state = JSON.parse(tmp);
      return state;
    } else {
      useCapProjectCache = true;
    }
  }

  let project: MobileProject;
  try {
    project = await getCapacitorProject(prj);
  } catch {
    return undefined;
  }

  if (project.ios) {
    const appTarget = project.ios?.getAppTarget();
    if (appTarget) {
      state.iosBundleId = project.ios.getBundleId(appTarget.name);
      state.iosDisplayName = await project.ios.getDisplayName(appTarget.name);
      for (const buildConfig of project.ios.getBuildConfigurations(appTarget.name)) {
        try {
          state.iosVersion = project.ios?.getVersion(appTarget.name, buildConfig.name);
          state.iosBuild = await project.ios.getBuild(appTarget.name, buildConfig.name);
        } catch (error) {
          writeError(`Unable to getBuild of ios project ${appTarget.name} ${buildConfig.name}`);
        }
      }
    } else {
      writeError(`Unable to getAppTarget of ios project ${project.ios.getError().message}`);
    }
  }

  if (project.android) {
    try {
      const [androidBundleId, androidVersion, androidBuild, data] = await Promise.all([
        project.android?.getPackageName(),
        project.android?.getVersionName(),
        project.android?.getVersionCode(),
        project.android?.getResource('values', 'strings.xml'),
      ]);
      state.androidBundleId = androidBundleId;
      state.androidVersion = androidVersion;
      state.androidBuild = androidBuild;
      state.androidDisplayName = getStringFrom(data as string, `<string name="app_name">`, `</string`);
    } catch (error) {
      console.error('getCapacitorProjectState', error);
      return undefined;
    }
  }

  if (!project.ios && !project.android) {
    return undefined;
  }

  context.workspaceState.update(CapProjectCache(prj), JSON.stringify(state));
  return state;
}

/**
 * Change the Bundle Id of an App in the iOS and Android projects
 * @param  {string} bundleId The original bundle id / package name
 * @param  {string} folder Folder for the project
 * @param  {NativePlatform} platform Whether iOS or Android only (default both)
 */
async function setBundleId(
  queueFunction: QueueFunction,
  bundleId: string,
  prj: Project,
  folder: string,
  platform: NativePlatform,
) {
  const newBundleId = await window.showInputBox({
    title: 'Application Bundle Id',
    placeHolder: bundleId,
    value: bundleId,
    validateInput: (value: string) => {
      const regexp = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+[0-9a-z_]$/i;
      if (!regexp.test(value)) {
        return 'You cannot use spaces and some special characters like -. Must contain at least one full stop';
      }
      return null;
    },
  });

  if (!newBundleId) {
    return; // User cancelled
  }
  queueFunction();
  const project = await getCapacitorProject(prj);

  if (project?.ios && platform != NativePlatform.AndroidOnly) {
    const appTarget = project.ios?.getAppTarget();
    if (appTarget) {
      for (const buildConfig of project.ios.getBuildConfigurations(appTarget.name)) {
        write(`Set iOS Bundle Id for target ${appTarget.name} buildConfig.${buildConfig.name} to ${newBundleId}`);
        project.ios.setBundleId(appTarget.name, buildConfig.name, newBundleId);
      }
    } else {
      writeError(`Unable to update iosProject bundleId: ${project.ios.getError().message}`);
    }
  }

  if (project.android && platform != NativePlatform.iOSOnly) {
    write(`Set Android Package Name to ${newBundleId}`);
    try {
      // This doesnt really work in Trapeze: https://github.com/ionic-team/trapeze/issues/191
      // So we alter strings.xml afterwards
      await project.android?.setPackageName(newBundleId);
    } catch (error) {
      writeError(`Unable to setPackageName for android: ${error}`);
      console.error(error);
      return;
    }
  }
  await project.commit();

  await updateStringsXML(folder, prj, newBundleId);
  updateCapacitorConfig(prj, newBundleId);
  showOutput();
  clearCapProjectCache();
}

async function updateStringsXML(folder: string, prj: Project, newBundleId: string) {
  const project = await getCapacitorProject(prj);
  let data = await project.android?.getResource('values', 'strings.xml');
  if (!data) {
    write(`Unable to set Android display name`);
  }
  data = setStringIn(data as string, `<string name="package_name">`, `</string>`, newBundleId);
  data = setStringIn(data as string, `<string name="custom_url_scheme">`, `</string>`, newBundleId);
  const filename = join(folder, 'android/app/src/main/res/values/strings.xml');
  if (existsSync(filename)) {
    writeFileSync(filename, data);
  }
}

function setValueIn(data: string, key: string, value: string): string {
  if (data.includes(`${key}: '`)) {
    data = setStringIn(data, `${key}: '`, `'`, value);
  } else if (data.includes(`${key}: "`)) {
    data = setStringIn(data, `${key}: "`, `"`, value);
  }
  return data;
}

function clearCapProjectCache() {
  useCapProjectCache = false;
}

/**
 * Set Version Number of iOS and Android Project
 * @param  {string} version
 * @param  {NativePlatform} platform Whether to apply for iOS only, Android only or both (default)
 */
async function setVersion(queueFunction: QueueFunction, version: string, prj: Project, platform: NativePlatform) {
  const newVersion = await window.showInputBox({
    title: 'Application Version Number',
    placeHolder: version,
    value: version,
    validateInput: (value: string) => {
      const regexp = /^\S+$/;
      if (!regexp.test(value)) {
        return 'This version number is not valid';
      }
      return null;
    },
  });

  if (!newVersion) {
    return; // User cancelled
  }

  queueFunction();
  const project = await getCapacitorProject(prj);

  if (project?.ios && platform != NativePlatform.AndroidOnly) {
    const appTarget = project.ios?.getAppTarget();
    for (const buildConfig of project.ios.getBuildConfigurations(appTarget.name)) {
      write(`Set iOS Version for target ${appTarget.name} buildConfig.${buildConfig.name} to ${newVersion}`);
      await project.ios.setVersion(appTarget.name, buildConfig.name, newVersion);
    }
  }
  if (project.android && platform != NativePlatform.iOSOnly) {
    write(`Set Android Version to ${newVersion}`);
    await project.android?.setVersionName(newVersion);
  }
  await project.commit();
  channelShow();
  clearCapProjectCache();
}

/**
 * Set the build number
 * @param  {string} build The build number
 * @param  {CapacitorProject} project The Capacitor project
 * @param  {NativePlatform} platform Whether to apply on iOS only, Android Only or both (default)
 */
async function setBuild(queueFunction: QueueFunction, build: string, prj: Project, platform: NativePlatform) {
  const newBuild = await window.showInputBox({
    title: 'Application Build Number',
    placeHolder: build,
    value: build,
    validateInput: (value: string) => {
      const regexp = /^\d+$/;
      if (!regexp.test(value)) {
        return 'You can only use the digits 0 to 9';
      }
      return null;
    },
  });

  if (!newBuild) {
    return; // User cancelled
  }

  queueFunction();
  const project = await getCapacitorProject(prj);

  if (project?.ios && platform != NativePlatform.AndroidOnly) {
    const appTarget = project.ios?.getAppTarget();
    for (const buildConfig of project.ios.getBuildConfigurations(appTarget.name)) {
      write(`Set iOS Version for target ${appTarget.name} buildConfig.${buildConfig.name} to ${newBuild}`);
      await project.ios.setBuild(appTarget.name, buildConfig.name, parseInt(newBuild));
    }
  }
  if (project.android && platform != NativePlatform.iOSOnly) {
    write(`Set Android Version to ${newBuild}`);
    await project.android?.setVersionCode(parseInt(newBuild));
  }
  await project.commit();
  clearCapProjectCache();
  channelShow();
}

/**
 * Set the display name of the app
 * @param  {string} currentDisplayName The current value for the display name
 * @param  {string} folder Folder for the project
 * @param  {NativePlatform} platform Whether to apply to iOS only, Android only or both (default)
 */
async function setDisplayName(
  queueFunction: QueueFunction,
  currentDisplayName: string,
  prj: Project,
  folder: string,
  platform: NativePlatform,
) {
  const displayName = await window.showInputBox({
    title: 'Application Display Name',
    placeHolder: currentDisplayName,
    value: currentDisplayName,
  });

  if (!displayName) {
    return; // User cancelled
  }

  queueFunction();
  const project = await getCapacitorProject(prj);

  console.log(`Display name changed to ${displayName}`);
  if (project.ios != null && platform != NativePlatform.AndroidOnly) {
    const appTarget = project.ios?.getAppTarget();
    for (const buildConfig of project.ios.getBuildConfigurations(appTarget.name)) {
      write(`Set iOS Displayname for target ${appTarget.name} buildConfig.${buildConfig.name} to ${displayName}`);
      await project.ios.setDisplayName(appTarget.name, buildConfig.name, displayName);
    }
  }
  if (project.android != null && platform != NativePlatform.iOSOnly) {
    let data = await project.android?.getResource('values', 'strings.xml');
    if (!data) {
      write(`Unable to set Android display name`);
    }
    data = setStringIn(data as string, `<string name="app_name">`, `</string>`, displayName);
    data = setStringIn(data as string, `<string name="title_activity_main">`, `</string>`, displayName);
    const filename = join(folder, 'android/app/src/main/res/values/strings.xml');
    if (existsSync(filename)) {
      writeFileSync(filename, data);
      write(`Set Android app_name to ${displayName}`);
      write(`Set Android title_activity_main to ${displayName}`);
    } else {
      window.showErrorMessage('Unable to write to ' + filename);
    }
  }
  channelShow();
  project.commit();
  updateCapacitorConfig(prj, undefined, displayName);
  clearCapProjectCache();
}

async function getCapacitorProject(prj: Project): Promise<MobileProject> {
  const capConfig: MobileProjectConfig = {
    ios: {
      path: join(prj.projectFolder(), 'ios', 'App'),
    },
    android: {
      path: join(prj.projectFolder(), 'android'),
    },
  };
  const project = new MobileProject('', capConfig);
  await project.load();
  return project;
}
