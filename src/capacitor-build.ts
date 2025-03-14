import { Project } from './project';
import { MonoRepoType } from './monorepo';
import { CapacitorPlatform } from './capacitor-platform';
import { InternalCommand } from './command-name';
import { runWithProgress, getStringFrom, RunResults, openUri } from './utilities';
import { writeError, writeIonic } from './logging';
import { exists, isGreaterOrEqual } from './analyzer';
import { readFileSync, writeFileSync } from 'fs';
import { capacitorOpen } from './capacitor-open';
import { npx, PackageManager } from './node-commands';
import { exec } from 'child_process';
import { getCapacitorConfigureFilename, writeCapacitorConfig } from './capacitor-config-file';
import { window } from 'vscode';
import { QueueFunction } from './tip';

/**
 * Capacitor build command
 * @param  {Project} project
 */
export async function capacitorBuild(queueFunction: QueueFunction, project: Project) {
  if (!isGreaterOrEqual('@capacitor/cli', '4.4.0')) {
    await window.showErrorMessage('This option is only available in Capacitor version 4.4.0 and above.');
    return;
  }
  const picks = [];
  if (exists('@capacitor/ios')) {
    picks.push('iOS Release Build (.ipa)');
  }
  if (exists('@capacitor/android')) {
    picks.push('Android Debug Build (.apk)', 'Android Release Build (.aab)');
  }
  const selection = await window.showQuickPick(picks, { placeHolder: 'Create a build to target which format?' });
  if (!selection) return;
  const platform = selection.includes('ipa') ? CapacitorPlatform.ios : CapacitorPlatform.android;
  let args = '';
  if (selection.includes('apk')) {
    args += ' --androidreleasetype=APK';
  }
  if (selection.includes('aab')) {
    args += ' --androidreleasetype=AAB';
  }

  let settings: KeyStoreSettings = readKeyStoreSettings(project);
  settings = await verifySettings(project, platform, settings);
  if (!settings) {
    return;
  }

  try {
    queueFunction();
    const command = capBuildCommand(project, platform, args, settings);
    writeIonic(command);
    const results: RunResults = { output: '', success: false };
    await runWithProgress(command, 'Preparing Release Build...', project.projectFolder(), results);
    if (results.success) {
      writeConfig(project, settings);
      const tmp = results.output.split('at: ');
      const folder = tmp[1].replace('\n', '');
      exec(`open "${folder}"`);
      openPortal(platform);
    }
  } catch (err) {
    writeError(err);
  }
}

async function openPortal(platform: CapacitorPlatform) {
  const uri =
    platform == CapacitorPlatform.android ? 'https://play.google.com/console' : 'https://developer.apple.com/account';
  const selection = await window.showInformationMessage(
    `Do you want to open the ${platform == CapacitorPlatform.ios ? 'Apple Developer Portal?' : 'Google Play Console?'}`,
    'Open',
    'Exit',
  );
  if (selection == 'Open') {
    openUri(uri);
  }
}

async function verifySettings(
  project: Project,
  platform: CapacitorPlatform,
  settings: KeyStoreSettings,
): Promise<KeyStoreSettings> {
  if (platform == CapacitorPlatform.ios) return settings;

  if (!settings.keyStorePath) {
    const selection = await window.showInformationMessage(
      'An Android Keystore file is required. You can create one in Android Studio (Build > Generate Signed Bundle).',
      'Select Keystore File',
      'Open Android Studio',
      'Exit',
    );
    if (!selection || selection == 'Exit') {
      return undefined;
    }
    if (selection == 'Open Android Studio') {
      await runWithProgress(
        await capacitorOpen(project, platform),
        'Opening Android Studio...',
        project.projectFolder(),
      );
      return undefined;
    }
    const path = await window.showOpenDialog({
      canSelectFolders: false,
      canSelectFiles: true,
      canSelectMany: false,
      title: 'Select the key store path',
    });
    if (!path) return undefined;
    settings.keyStorePath = path[0].fsPath;
  }

  if (!settings.keyStorePassword) {
    settings.keyStorePassword = await window.showInputBox({
      title: 'Key store password',
      placeHolder: 'Enter key store password',
      password: true,
      ignoreFocusOut: true,
    });
    if (!settings.keyStorePassword) return undefined;
  }

  if (!settings.keyAlias) {
    settings.keyAlias = await window.showInputBox({
      title: 'Key alias',
      placeHolder: 'Enter key alias',
      ignoreFocusOut: true,
    });
    if (!settings.keyAlias) return undefined;
  }

  if (!settings.keyPassword) {
    settings.keyPassword = await window.showInputBox({
      title: 'Key password',
      placeHolder: 'Enter key password',
      password: true,
      ignoreFocusOut: true,
    });
    if (!settings.keyPassword) return undefined;
  }

  return settings;
}

export interface KeyStoreSettings {
  keyStorePath?: string;
  keyStorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
}

function capBuildCommand(
  project: Project,
  platform: CapacitorPlatform,
  args: string,
  settings: KeyStoreSettings,
): string {
  switch (project.repoType) {
    case MonoRepoType.none:
      return capCLIBuild(platform, project, args, settings);
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.npm:
      return InternalCommand.cwd + capCLIBuild(platform, project, args, settings);
    case MonoRepoType.nx:
      return nxBuild(project, platform, args);
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function capCLIBuild(platform: CapacitorPlatform, project: Project, args: string, settings: KeyStoreSettings): string {
  if (platform == CapacitorPlatform.android) {
    if (settings.keyAlias) args += ` --keystorealias="${settings.keyAlias}"`;
    if (settings.keyPassword) args += ` --keystorealiaspass="${settings.keyPassword}"`;
    if (settings.keyStorePassword) args += ` --keystorepass="${settings.keyStorePassword}"`;
    if (settings.keyStorePath) args += ` --keystorepath="${settings.keyStorePath}"`;
  }
  return `${npx(project)} cap build ${platform}${args}`;
}

function nxBuild(project: Project, platform: CapacitorPlatform, args: string): string {
  return `${npx(project)} nx run ${project.monoRepo.name}:build:${platform}${args}`;
}

function readKeyStoreSettings(project: Project): KeyStoreSettings {
  const result: KeyStoreSettings = {};
  const filename = getCapacitorConfigureFilename(project.projectFolder());
  if (!filename) {
    return;
  }
  try {
    const data = readFileSync(filename, 'utf-8');
    if (data.includes('CapacitorConfig = {')) {
      result.keyStorePath = getValueFrom(data, 'keystorePath');
      result.keyAlias = getValueFrom(data, 'keystoreAlias');
      result.keyPassword = getValueFrom(data, 'keystoreAliasPassword');
      result.keyStorePassword = getValueFrom(data, 'keystorePassword');
    }
    return result;
  } catch (err) {
    writeError(err);
    return;
  }
}

function getValueFrom(data: string, key: string): string {
  let result = getStringFrom(data, `${key}: '`, `'`);
  if (!result) {
    result = getStringFrom(data, `${key}: "`, `"`);
  }
  return result;
}

function writeConfig(project: Project, settings: KeyStoreSettings) {
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
       }
    }
  };`,
    );
  }
  writeFileSync(filename, data);
  writeCapacitorConfig(project, [
    { key: 'keystorePath', value: settings.keyStorePath },
    { key: 'keystorePassword', value: settings.keyStorePassword },
    { key: 'keystoreAlias', value: settings.keyAlias },
    { key: 'keystoreAliasPassword', value: settings.keyPassword },
  ]);
}
