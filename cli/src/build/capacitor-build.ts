import { readFileSync, writeFileSync } from 'fs';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { getCapacitorConfigureFilename, writeCapacitorConfig } from '../project/capacitor-config-file';
import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { getStringFrom, isEmpty } from '../project/utilities-strings';
import { CommandResult, finalizeCommand } from './command-result';
import { npx } from './node-commands';

export interface KeyStoreSettings {
  keyStorePath?: string;
  keyStorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
  signingType?: string;
}

export interface CapBuildOptions {
  /** APK or AAB for Android; ignored for iOS. */
  androidReleaseType?: 'APK' | 'AAB';
}

export type CapBuildSelection = 'ios-ipa' | 'android-apk' | 'android-aab';

/** Map a build selection to platform and CLI args. */
export function selectionToPlatformAndArgs(selection: CapBuildSelection): {
  platform: CapacitorPlatform;
  args: string;
} {
  if (selection === 'ios-ipa') {
    return { platform: CapacitorPlatform.ios, args: '' };
  }
  if (selection === 'android-apk') {
    return { platform: CapacitorPlatform.android, args: ' --androidreleasetype=APK' };
  }
  return { platform: CapacitorPlatform.android, args: ' --androidreleasetype=AAB' };
}

/** Returns available native build targets based on installed Capacitor platforms. */
export function listCapBuildTargets(project: Project): CapBuildSelection[] {
  const picks: CapBuildSelection[] = [];
  if (project.analyzer.exists('@capacitor/ios')) {
    picks.push('ios-ipa');
  }
  if (project.analyzer.exists('@capacitor/android')) {
    picks.push('android-apk', 'android-aab');
  }
  return picks;
}

export function capacitorBuildCommand(
  project: Project,
  platform: CapacitorPlatform,
  args: string,
  settings: KeyStoreSettings,
): CommandResult {
  switch (project.repoType) {
    case MonoRepoType.none:
      return finalizeCommand(project, capCLIBuild(platform, project, args, settings));
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.bun:
    case MonoRepoType.npm:
      return finalizeCommand(project, capCLIBuild(platform, project, args, settings));
    case MonoRepoType.nx:
      return finalizeCommand(project, nxCapBuild(project, platform, args));
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function capCLIBuild(platform: CapacitorPlatform, project: Project, args: string, settings: KeyStoreSettings): string {
  if (platform === CapacitorPlatform.android) {
    if (settings.keyAlias) args += ` --keystorealias="${settings.keyAlias}"`;
    if (settings.keyPassword) args += ` --keystorealiaspass="${settings.keyPassword}"`;
    if (settings.keyStorePassword) args += ` --keystorepass="${settings.keyStorePassword}"`;
    if (settings.keyStorePath) args += ` --keystorepath="${settings.keyStorePath}"`;
  }
  return `${npx(project)} cap build ${platform}${args}`;
}

function nxCapBuild(project: Project, platform: CapacitorPlatform, args: string): string {
  return `${npx(project)} nx run ${project.monoRepo.name}:build:${platform}${args}`;
}

export function readKeyStoreSettings(project: Project): KeyStoreSettings {
  const result: KeyStoreSettings = {};
  const filename = getCapacitorConfigureFilename(project.projectFolder());
  if (!filename) {
    return result;
  }
  try {
    const data = readFileSync(filename, 'utf-8');
    if (data.includes('CapacitorConfig = {')) {
      result.signingType = getValueFrom(data, 'signingType');
      if (isEmpty(result.signingType)) {
        result.signingType = 'apksigner';
      }
      result.keyStorePath = getValueFrom(data, 'keystorePath');
      result.keyAlias = getValueFrom(data, 'keystoreAlias');
      result.keyPassword = getValueFrom(data, 'keystoreAliasPassword');
      result.keyStorePassword = getValueFrom(data, 'keystorePassword');
    }
    return result;
  } catch (err) {
    console.error(err);
    return result;
  }
}

function getValueFrom(data: string, key: string): string {
  let result = getStringFrom(data, `${key}: '`, `'`);
  if (!result) {
    result = getStringFrom(data, `${key}: "`, `"`);
  }
  return result;
}

export function writeKeyStoreConfig(project: Project, settings: KeyStoreSettings): void {
  const filename = getCapacitorConfigureFilename(project.projectFolder());
  if (!filename) {
    return;
  }
  let data = readFileSync(filename, 'utf-8');

  if (!data.includes('buildOptions')) {
    data = data.replace(
      '};',
      `,
    android: {
       buildOptions: {
          keystorePath: '',
          keystoreAlias: '',
          signingType: 'apksigner',
       }
    }
  };`,
    );
  }
  if (!data.includes('signingType')) {
    data = data.replace(
      'buildOptions: {',
      `buildOptions: {
          signingType: 'apksigner',`,
    );
  }
  writeFileSync(filename, data);
  writeCapacitorConfig(project, [
    { key: 'keystorePath', value: settings.keyStorePath },
    { key: 'keystorePassword', value: settings.keyStorePassword },
    { key: 'keystoreAlias', value: settings.keyAlias },
    { key: 'keystoreAliasPassword', value: settings.keyPassword },
    { key: 'signingType', value: settings.signingType },
  ]);
}

export function isCapBuildSupported(project: Project): boolean {
  return project.analyzer.isGreaterOrEqual('@capacitor/cli', '4.4.0');
}
