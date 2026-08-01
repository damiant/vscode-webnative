import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { AndroidProject } from './android';
import { IosProject } from './ios';
import { setStringIn } from '../core/strings';

export interface CapacitorProjectState {
  iosBundleId?: string;
  androidBundleId?: string;
  iosVersion?: string;
  androidVersion?: string;
  iosBuild?: number;
  androidBuild?: number;
  iosDisplayName?: string;
  androidDisplayName?: string;
}

export enum NativePlatform {
  iOSOnly,
  AndroidOnly,
}

export const bundleIdRegex = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+[0-9a-z_]$/i;
export const versionRegex = /^\S+$/;
export const buildRegex = /^\d+$/;

export function validateBundleId(value: string): string | null {
  if (!bundleIdRegex.test(value)) {
    return 'You cannot use spaces and some special characters like -. Must contain at least one full stop';
  }
  return null;
}

export function validateVersion(value: string): string | null {
  if (!versionRegex.test(value)) {
    return 'This version number is not valid';
  }
  return null;
}

export function validateBuild(value: string): string | null {
  if (!buildRegex.test(value)) {
    return 'You can only use the digits 0 to 9';
  }
  return null;
}

export async function getCapacitorProjectState(projectFolder: string): Promise<CapacitorProjectState | undefined> {
  const state: CapacitorProjectState = {};

  const [androidProject, iosProject] = await Promise.all([
    getAndroidProject(projectFolder),
    getIosProject(projectFolder),
  ]);
  let hasNativeProject = false;

  if (iosProject && iosProject.exists()) {
    const appTarget = iosProject.getAppTarget();
    if (appTarget) {
      state.iosBundleId = iosProject.getBundleId(appTarget.name);
      state.iosDisplayName = await iosProject.getDisplayName();
      for (const buildConfig of iosProject.getBuildConfigurations(appTarget.name)) {
        try {
          state.iosVersion = iosProject.getVersion(appTarget.name, buildConfig.name);
          state.iosBuild = await iosProject.getBuild(appTarget.name, buildConfig.name);
        } catch (error) {
          console.error(`Unable to getBuild of ios project ${appTarget.name} ${buildConfig.name}`);
        }
      }
    } else {
      console.error(`Unable to getAppTarget of ios project`);
    }
    hasNativeProject = true;
  }

  if (androidProject && androidProject.exists()) {
    try {
      const [androidBundleId, androidVersion, androidBuild, androidDisplayName] = await Promise.all([
        androidProject.getPackageName(),
        androidProject.getVersionName(),
        androidProject.getVersionCode(),
        androidProject.getDisplayName(),
      ]);
      state.androidBundleId = androidBundleId;
      state.androidVersion = androidVersion;
      state.androidBuild = androidBuild;
      state.androidDisplayName = androidDisplayName;
    } catch (error) {
      console.error('getCapacitorProjectState', error);
      return undefined;
    }
    hasNativeProject = true;
  }

  if (!hasNativeProject) {
    return undefined;
  }

  return state;
}

export async function setBundleId(
  projectFolder: string,
  newBundleId: string,
  platform?: NativePlatform,
): Promise<void> {
  const err = validateBundleId(newBundleId);
  if (err) {
    throw new Error(err);
  }

  const iosProject = await getIosProject(projectFolder);

  if (iosProject?.exists() && platform != NativePlatform.AndroidOnly) {
    const appTarget = iosProject.getAppTarget();
    if (appTarget) {
      for (const buildConfig of iosProject.getBuildConfigurations(appTarget.name)) {
        await iosProject.setBundleId(appTarget.name, buildConfig.name, newBundleId);
      }
    } else {
      throw new Error(`Unable to update iosProject bundleId`);
    }
  }

  const androidProject = await getAndroidProject(projectFolder);
  if (androidProject?.exists() && platform != NativePlatform.iOSOnly) {
    try {
      await androidProject.setPackageName(newBundleId);
    } catch (error) {
      throw new Error(`Unable to setPackageName for android: ${error}`);
    }
    androidProject.updateStringsXML(newBundleId);
  }

  updateCapacitorConfig(projectFolder, newBundleId);
}

export async function setVersion(projectFolder: string, newVersion: string, platform?: NativePlatform): Promise<void> {
  const err = validateVersion(newVersion);
  if (err) {
    throw new Error(err);
  }

  const iosProject = await getIosProject(projectFolder);
  const androidProject = await getAndroidProject(projectFolder);

  if (iosProject && iosProject.exists() && platform != NativePlatform.AndroidOnly) {
    const appTarget = iosProject.getAppTarget();
    for (const buildConfig of iosProject.getBuildConfigurations(appTarget.name)) {
      await iosProject.setVersion(appTarget.name, buildConfig.name, newVersion);
    }
  }
  if (androidProject && androidProject.exists() && platform != NativePlatform.iOSOnly) {
    await androidProject.setVersionName(newVersion);
  }
}

export async function setBuild(
  projectFolder: string,
  newBuild: string | number,
  platform?: NativePlatform,
): Promise<void> {
  const buildStr = String(newBuild);
  const err = validateBuild(buildStr);
  if (err) {
    throw new Error(err);
  }

  const buildNum = parseInt(buildStr, 10);
  const iosProject = await getIosProject(projectFolder);
  const androidProject = await getAndroidProject(projectFolder);

  if (iosProject?.exists() && platform != NativePlatform.AndroidOnly) {
    const appTarget = iosProject.getAppTarget();
    for (const buildConfig of iosProject.getBuildConfigurations(appTarget.name)) {
      await iosProject.setBuild(appTarget.name, buildConfig.name, buildNum);
    }
  }
  if (androidProject?.exists() && platform != NativePlatform.iOSOnly) {
    await androidProject.setVersionCode(buildNum);
  }
}

export async function setDisplayName(
  projectFolder: string,
  displayName: string,
  platform?: NativePlatform,
): Promise<void> {
  const iosProject = await getIosProject(projectFolder);
  const androidProject = await getAndroidProject(projectFolder);

  if (iosProject?.exists() && platform != NativePlatform.AndroidOnly) {
    const appTarget = iosProject.getAppTarget();
    for (const buildConfig of iosProject.getBuildConfigurations(appTarget.name)) {
      await iosProject.setDisplayName(appTarget.name, buildConfig.name, displayName);
    }
  }
  if (androidProject?.exists() && platform != NativePlatform.iOSOnly) {
    androidProject.setDisplayName(displayName);
  }
  updateCapacitorConfig(projectFolder, undefined, displayName);
}

function getCapacitorConfigureFilename(folder: string): string {
  let capConfigFile = join(folder, 'capacitor.config.ts');
  if (!existsSync(capConfigFile)) {
    capConfigFile = join(folder, 'capacitor.config.js');
    if (!existsSync(capConfigFile)) {
      capConfigFile = join(folder, 'capacitor.config.json');
    }
  }
  return capConfigFile;
}

function setValueIn(data: string, key: string, value: string): string {
  if (data.includes(`${key}: '`)) {
    data = setStringIn(data, `${key}: '`, `'`, value);
  } else if (data.includes(`${key}: "`)) {
    data = setStringIn(data, `${key}: "`, `"`, value);
  } else if (data.includes(`"${key}": "`)) {
    data = setStringIn(data, `"${key}": "`, `"`, value);
  }
  return data;
}

export function updateCapacitorConfig(projectFolder: string, bundleId?: string, displayName?: string): void {
  const filename = getCapacitorConfigureFilename(projectFolder);
  if (!filename || !existsSync(filename)) {
    return;
  }
  let data = readFileSync(filename, 'utf-8');
  if (bundleId) {
    data = setValueIn(data, 'appId', bundleId);
  }
  if (displayName) {
    data = setValueIn(data, 'appName', displayName);
  }
  writeFileSync(filename, data);
}

async function getAndroidProject(projectFolder: string): Promise<AndroidProject> {
  const proj = new AndroidProject(join(projectFolder, 'android'));
  await proj.parse();
  return proj;
}

async function getIosProject(projectFolder: string): Promise<IosProject | undefined> {
  const proj = new IosProject(join(projectFolder, 'ios', 'App'));
  try {
    const ok = await proj.parse();
    if (!ok) {
      return undefined;
    }
    return proj;
  } catch (error) {
    console.error(`Unable to parse ios project: ${error}`);
    return undefined;
  }
}
