import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
  checkCordovaAndroidPreference,
  checkCordovaAndroidPreferenceMinimum,
  checkCordovaIosPreference,
  checkMinVersion,
  exists,
  isGreaterOrEqual,
  warnMinVersion,
} from './analyzer';
import { getPackageJSONFilename } from './monorepo';
import { npmInstall, npmUninstall } from './node-commands';
import { Project } from './project';
import { Tip, TipType } from './tip';
import { getRunOutput } from './utilities';
import { ionicExport } from './ionic-export';
import { exState } from './tree-provider';

/**
 * Check rules for Cordova projects
 * @param  {Project} project
 */
export function checkCordovaRules(project: Project) {
  project.tip(
    warnMinVersion(
      'cordova-android',
      '10.0.1',
      'to be able to target Android SDK v30 which is required for all submissions to the Play Store',
    ),
  );
  project.tip(warnMinVersion('cordova-ios', '6.1.0'));

  if (isGreaterOrEqual('cordova-android', '10.0.0')) {
    project.checkNotExists(
      'cordova-plugin-whitelist',
      'should be removed as its functionality is now built into Cordova',
    );
    project.checkNotExists('phonegap-plugin-multidex', 'is not compatible with cordova-android 10+');
    project.checkNotExists('cordova-plugin-androidx', 'is not required when using cordova-android 10+');
    project.checkNotExists('cordova-plugin-androidx-adapter', 'is not required when using cordova-android 10+');
    project.checkNotExists(
      'phonegap-plugin-push',
      'is deprecated and does not support Android X. Migrate to using cordova-plugin-push',
    );

    project.tip(checkMinVersion('cordova-plugin-inappbrowser', '5.0.0', 'to support Android 10+'));
    project.tip(checkMinVersion('cordova-plugin-ionic-webview', '5.0.0', 'to support Android 10+'));
    project.tip(checkMinVersion('scandit-cordova-datacapture-barcode', '6.9.1', 'to support Android 10+'));
    project.tip(checkMinVersion('cordova-plugin-ionic', '5.5.0', 'to support Android 10+'));
    project.tip(checkCordovaAndroidPreference(project, 'AndroidXEnabled', true));

    if (exists('cordova-plugin-push') || exists('@havesource/cordova-plugin-push')) {
      project.tip(checkCordovaAndroidPreference(project, 'GradlePluginGoogleServicesEnabled', true));
      project.tip(checkCordovaAndroidPreferenceMinimum('GradlePluginGoogleServicesVersion', '4.3.8'));
    }
  } else {
    project.checkNotExists(
      'cordova-plugin-whitelist',
      'is deprecated and no longer required with cordova-android v10+',
    );
  }

  if (project.isCapacitor) {
    // Has both cordova and capacitor
    project.add(
      new Tip(
        'Remove Cordova',
        'Remnants of Cordova are present in package.json',
        TipType.Error,
        `Your project is based on Capacitor but has remnants of cordova in the package.json file.`,
        undefined,
        'Fix package.json',
      ).setAfterClickAction('Fix package.json', fixPackageJson, project),
    );
  }

  if (!project.isCapacitor) {
    project.add(
      new Tip('Export', '', TipType.Media)
        .setQueuedAction(ionicExport, project, exState.context)
        .setTooltip('Export a markdown file with all project dependencies and plugins'),
    );
  }
  if (isGreaterOrEqual('@ionic/angular-toolkit', '6.0.0')) {
    // In v6 Cordova projects require @ionic/cordova-builders
    if (!exists('@ionic/cordova-builders') && !project.isCapacitor) {
      project.recommendAdd(
        '@ionic/cordova-builders',
        '@ionic/cordova-builders',
        'Install @ionic/cordova-builders for compatibility',
        'The package @ionic/cordova-builders is required when @ionic/angular-toolkit is version 6 and higher.',
        true,
      );
    }
  }

  project.recommendReplace(
    'phonegap-plugin-push',
    'phonegap-plugin-push',
    `Replace with cordova-plugin-push due to deprecation`,
    `The plugin phonegap-plugin-push should be replaced with cordova-plugin-push as phonegap-plugin-push was deprecated in 2017`,
    '@havesource/cordova-plugin-push',
  );

  if (exists('cordova-plugin-customurlscheme') && exists('ionic-plugin-deeplinks')) {
    project.recommendRemove(
      'cordova-plugin-customurlscheme',
      'cordova-plugin-customurlscheme',
      'Remove as the functionality is part of ionic-plugin-deeplinks which is already installed.',
    );
  }

  if (exists('@ionic-enterprise/identity-vault')) {
    // Make sure Swift is 4.2 or 5 when using identity vault
    project.tip(checkCordovaIosPreference('UseSwiftLanguageVersion', [4.2, 5], 4.2));
    if (!isGreaterOrEqual('@ionic-enterprise/identity-vault', '5.0.0')) {
      project.tip(
        checkMinVersion(
          '@ionic-enterprise/identity-vault',
          '5.0.0',
          'Update to v5 as it contains significant security fixes and broader support for Android security features',
          'https://ionic.io/docs/identity-vault',
        ),
      );
    } else {
      if (!isGreaterOrEqual('@ionic-enterprise/identity-vault', '5.1.0')) {
        project.tip(
          checkMinVersion(
            '@ionic-enterprise/identity-vault',
            '5.1.0',
            'as the current version is missing important security fixes.',
            'https://ionic.io/docs/identity-vault',
          ),
        );
      }
    }
  }

  if (exists('cordova-support-google-services') && isGreaterOrEqual('cordova-android', '9.0.0')) {
    project.recommendRemove(
      'cordova-support-google-services',
      'cordova-support-google-services',
      'Remove as the functionality is built into cordova-android 9+. See: https://github.com/chemerisuk/cordova-support-google-services',
    );
  }
}

async function fixPackageJson(project: Project): Promise<void> {
  // Remove cordova section
  const filename = getPackageJSONFilename(project.projectFolder());
  if (existsSync(filename)) {
    const json = readFileSync(filename, 'utf8');
    const data = JSON.parse(json);
    delete data.cordova;
    const updated = JSON.stringify(data, undefined, 2);
    writeFileSync(filename, updated);
  }
  if (exists('cordova-ios')) {
    await getRunOutput(npmUninstall('cordova-ios'), project.folder);
  }
  if (exists('cordova-android')) {
    await getRunOutput(npmUninstall('cordova-android'), project.folder);
  }
}

export function checkCordovaPlugins(packages, project: Project) {
  if (Object.keys(packages).length == 0) return;

  // These are plugins that are required for Cordova projects but not Capacitor
  const ignorePlugins = ['cordova-plugin-add-swift-support', 'cordova-plugin-ionic-webview'];

  const missing = [];

  for (const library of Object.keys(packages)) {
    if (packages[library].depType == 'Plugin') {
      for (const dependentPlugin of packages[library].plugin.dependentPlugins) {
        if (
          !exists(dependentPlugin) &&
          !ignorePlugins.includes(dependentPlugin) &&
          !missing.includes(dependentPlugin)
        ) {
          missing.push(dependentPlugin);
          project.add(
            new Tip(
              dependentPlugin,
              `Missing dependency`,
              TipType.Warning,
              `The plugin ${library} has a dependency on ${dependentPlugin} but it is missing from your project. It should be installed.`,
              npmInstall(dependentPlugin),
              `Install`,
            ),
          );
        }
      }
    }
  }
}
