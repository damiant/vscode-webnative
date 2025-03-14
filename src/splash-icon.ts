import { channelShow, run } from './utilities';
import { write, writeIonic } from './logging';
import { QueueFunction, Tip, TipType } from './tip';
import { Project } from './project';
import { exists } from './analyzer';
import { CapacitorPlatform } from './capacitor-platform';
import { npmInstall, npmUninstall, npx } from './node-commands';
import { Context } from './context-variables';
import { extname, join } from 'path';
import { ProgressLocation, window } from 'vscode';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

export enum AssetType {
  splash = 'splash.png',
  splashDark = 'splash-dark.png',
  icon = 'icon.png',
  adaptiveForeground = 'icon-foreground.png',
  adaptiveBackground = 'icon-background.png',
}

export function addSplashAndIconFeatures(project: Project) {
  project.setSubGroup(
    `Splash Screen & Icon`,
    TipType.Media,
    'Allows setting of the Splash Screen and Icon. Clicking Rebuild will create assets for your iOS and Android native projects.',
    Context.rebuild,
  ).tip = new Tip('Rebuild Assets', undefined).setQueuedAction(runCapacitorAssets, project);
  project.add(createFeature('Splash Screen', AssetType.splash, project));
  project.add(createFeature('Splash Screen Dark', AssetType.splashDark, project));
  project.add(createFeature('Icon', AssetType.icon, project));
  project.add(createFeature('Icon Foreground', AssetType.adaptiveForeground, project));
  project.add(createFeature('Icon Background', AssetType.adaptiveBackground, project));
  project.clearSubgroup();
}

function getAssetTipType(folder: string, filename: AssetType): TipType {
  const assetfilename = join(getResourceFolder(folder, filename), filename);
  if (existsSync(assetfilename)) {
    return TipType.CheckMark;
  } else {
    return TipType.Warning;
  }
}

function createFeature(title: string, assetType: AssetType, project: Project): Tip {
  const tip = new Tip(title, undefined, getAssetTipType(project.projectFolder(), assetType));
  tip.setQueuedAction(setAssetResource, project, assetType);
  tip.setContextValue(Context.asset);
  const filename = join(getResourceFolder(project.projectFolder(), assetType), assetType);
  tip.setSecondCommand('Open Asset', filename);
  tip.tooltip = getAssetTooltip(project.projectFolder(), assetType);
  return tip;
}

function getResourceFolder(folder: string, filename: AssetType, createIfMissing?: boolean): string {
  let resourceFolder = join(folder, 'resources');
  if (createIfMissing && !existsSync(resourceFolder)) {
    mkdirSync(resourceFolder);
  }
  if (filename == AssetType.adaptiveBackground || filename == AssetType.adaptiveForeground) {
    resourceFolder = join(resourceFolder, 'android');
    if (createIfMissing && !existsSync(resourceFolder)) {
      mkdirSync(resourceFolder);
    }
  }
  return resourceFolder;
}

function getAssetTooltip(folder: string, filename: AssetType): string {
  switch (filename) {
    case AssetType.splash:
      return 'Your splash screen should be a 2732×2732px png file. It will be used as the original asset to create suitably sized splash screens for iOS and Android.';
      break;
    case AssetType.splashDark:
      return 'Your dark mode splash screen should be a 2732×2732px png file. It will be used as the original asset to create suitably sized dark mode splash screens for iOS and Android.';
      break;
    case AssetType.icon:
      return 'Your icon should be a 1024×1024px png file that does not contain transparency. It will be used as the original asset to create suitably sized icons for iOS and Android.';
      break;
    case AssetType.adaptiveForeground:
      return 'The icon should be at least 432x432 png file. It will be used as the original asset to create suitably sized adaptive icons for Android.';
      break;
    case AssetType.adaptiveBackground:
      return 'The icon should be at least 432x432 png file. It will be used as the original asset to create suitably sized adaptive icons for Android.';
      break;
  }
}

async function setAssetResource(queueFunction: QueueFunction, project: Project, filename: AssetType) {
  const folder = project.projectFolder();
  const title = getAssetTooltip(folder, filename);
  const buttonTitle = getAssetTipType(folder, filename) == TipType.Warning ? `Select File` : `Update File`;
  const selected = await window.showInformationMessage(title, buttonTitle);
  if (!selected) return;

  try {
    queueFunction();
    // Copy newfilename to resources/splash.png
    const resourceFolder = getResourceFolder(folder, filename, true);

    const files = await window.showOpenDialog({ canSelectFiles: true, canSelectMany: false });
    if (!files || files.length !== 1) return;
    const copyfilename = files[0].fsPath;

    if (extname(copyfilename) !== '.png') {
      window.showErrorMessage('The file must be a png');
      return;
    }

    const newfilename = join(resourceFolder, filename);
    copyFileSync(copyfilename, newfilename);
    if (!existsSync(newfilename)) {
      await window.showErrorMessage(`Unable to create ${newfilename}`);
      return;
    }

    // If its an icon file and no adaptive icons then use the icon
    if (filename == AssetType.icon) {
      const adaptiveBackground = join(
        getResourceFolder(folder, AssetType.adaptiveBackground, true),
        AssetType.adaptiveBackground,
      );
      const adaptiveForeground = join(
        getResourceFolder(folder, AssetType.adaptiveForeground, true),
        AssetType.adaptiveForeground,
      );
      if (!existsSync(adaptiveBackground)) {
        copyFileSync(copyfilename, adaptiveBackground);
      }
      if (!existsSync(adaptiveForeground)) {
        copyFileSync(copyfilename, adaptiveForeground);
      }
    }

    await runCapacitorAssets(undefined, project);
  } catch (err) {
    window.showErrorMessage(`Operation failed ${err}`);
  }
}

function hasNeededAssets(folder: string): string {
  const icon = join(getResourceFolder(folder, AssetType.icon), AssetType.icon);
  const splash = join(getResourceFolder(folder, AssetType.splash), AssetType.splash);
  const splashDark = join(getResourceFolder(folder, AssetType.splashDark), AssetType.splashDark);

  if (!existsSync(icon)) {
    return 'An icon needs to be specified next.';
  }
  if (!existsSync(splash)) {
    return 'A splash screen needs to be specified next.';
  }
  if (!existsSync(splashDark)) {
    return 'A dark mode splash screen needs to be specified next.';
  }
}

async function runCapacitorAssets(queueFunction: QueueFunction | undefined, project: Project) {
  const hasCordovaRes = exists('@capacitor/assets');
  const ios = project.hasCapacitorProject(CapacitorPlatform.ios);
  const android = project.hasCapacitorProject(CapacitorPlatform.android);
  const pwa = exists('@angular/service-worker');
  const folder = project.projectFolder();
  const neededMessage = hasNeededAssets(folder);
  if (neededMessage) {
    await window.showInformationMessage(neededMessage, 'OK');
    return;
  }

  if (queueFunction) {
    queueFunction();
  }
  writeIonic('Generating Splash Screen and Icon Assets...');
  channelShow();
  await showProgress('Generating Splash Screen and Icon Assets', async () => {
    if (exists('cordova-res')) {
      await run(folder, npmUninstall('cordova-res'), undefined, [], undefined, undefined);
    }
    let cmd = '';
    if (ios) {
      cmd = `${npx(project, { forceNpx: true })} @capacitor/assets generate --ios`;
      write(`> ${cmd}`);
      await run(folder, cmd, undefined, [], undefined, undefined);
      addToGitIgnore(folder, 'resources/ios/**/*');
    }
    if (android) {
      cmd = `${npx(project, { forceNpx: true })} @capacitor/assets generate --android`;
      write(`> ${cmd}`);
      await run(folder, cmd, undefined, [], undefined, undefined);
      addToGitIgnore(folder, 'resources/android/**/*');
    }
    if (pwa) {
      cmd = `${npx(project, {
        forceNpx: true,
      })} @capacitor/assets generate --pwa --pwaManifestPath './src/manifest.webmanifest'`;
      write(`> ${cmd}`);
      await run(folder, cmd, undefined, [], undefined, undefined);
    }
  });

  writeIonic('Completed created Splash Screen and Icon Assets');
  channelShow();
}

function addToGitIgnore(folder: string, ignoreGlob: string) {
  const filename = join(folder, '.gitignore');
  if (existsSync(filename)) {
    let txt = readFileSync(filename, { encoding: 'utf-8' });
    const lines = txt.split('\n');
    if (!txt.includes(ignoreGlob)) {
      txt = txt + `\n${ignoreGlob}`;
      writeFileSync(filename, txt);
    }
  }
}

async function showProgress(message: string, func: () => Promise<any>) {
  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `${message}`,
      cancellable: false,
    },
    async (progress, token) => {
      await func();
    },
  );
}
