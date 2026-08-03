import { Project } from '../project/project';
import { FindingCollector } from './finding';
import { commandContext, npmInstall } from '../build/node-commands';
import {
  checkCordovaAndroidPreference,
  checkCordovaAndroidPreferenceMinimum,
  checkCordovaIosPreference,
  checkMinVersion,
  checkNotExists,
  recommendAdd,
  recommendRemove,
  recommendReplace,
  warnMinVersion,
} from './factories';

export function checkCordovaRules(project: Project, collector: FindingCollector): void {
  warnMinVersion(
    project,
    collector,
    'cordova-android',
    '10.0.1',
    'to be able to target Android SDK v30 which is required for all submissions to the Play Store',
    undefined,
    'cordova',
  );
  warnMinVersion(project, collector, 'cordova-ios', '6.1.0', undefined, undefined, 'cordova');

  if (project.analyzer.isGreaterOrEqual('cordova-android', '10.0.0')) {
    checkNotExists(
      project,
      collector,
      'cordova-plugin-whitelist',
      'should be removed as its functionality is now built into Cordova',
      'cordova',
    );
    checkNotExists(
      project,
      collector,
      'phonegap-plugin-multidex',
      'is not compatible with cordova-android 10+',
      'cordova',
    );
    checkNotExists(
      project,
      collector,
      'cordova-plugin-androidx',
      'is not required when using cordova-android 10+',
      'cordova',
    );
    checkNotExists(
      project,
      collector,
      'cordova-plugin-androidx-adapter',
      'is not required when using cordova-android 10+',
      'cordova',
    );
    checkNotExists(
      project,
      collector,
      'phonegap-plugin-push',
      'is deprecated and does not support Android X. Migrate to using cordova-plugin-push',
      'cordova',
    );

    checkMinVersion(
      project,
      collector,
      'cordova-plugin-inappbrowser',
      '5.0.0',
      'to support Android 10+',
      undefined,
      'cordova',
    );
    checkMinVersion(
      project,
      collector,
      'cordova-plugin-ionic-webview',
      '5.0.0',
      'to support Android 10+',
      undefined,
      'cordova',
    );
    checkMinVersion(
      project,
      collector,
      'scandit-cordova-datacapture-barcode',
      '6.9.1',
      'to support Android 10+',
      undefined,
      'cordova',
    );
    checkMinVersion(
      project,
      collector,
      'cordova-plugin-ionic',
      '5.5.0',
      'to support Android 10+',
      undefined,
      'cordova',
    );
    checkCordovaAndroidPreference(project, collector, 'AndroidXEnabled', true);

    if (project.analyzer.exists('cordova-plugin-push') || project.analyzer.exists('@havesource/cordova-plugin-push')) {
      checkCordovaAndroidPreference(project, collector, 'GradlePluginGoogleServicesEnabled', true);
      checkCordovaAndroidPreferenceMinimum(project, collector, 'GradlePluginGoogleServicesVersion', '4.3.8');
    }
  } else {
    checkNotExists(
      project,
      collector,
      'cordova-plugin-whitelist',
      'is deprecated and no longer required with cordova-android v10+',
      'cordova',
    );
  }

  if (project.isCapacitor) {
    collector.add({
      id: 'cordova-remnants-in-capacitor',
      severity: 'error',
      category: 'cordova',
      title: 'Remove Cordova remnants from package.json',
      detail: 'Your project is based on Capacitor but has remnants of cordova in the package.json file.',
      fixable: false,
    });
  }

  if (project.analyzer.isGreaterOrEqual('@ionic/angular-toolkit', '6.0.0')) {
    if (!project.analyzer.exists('@ionic/cordova-builders') && !project.isCapacitor) {
      recommendAdd(
        project,
        collector,
        '@ionic/cordova-builders',
        '@ionic/cordova-builders',
        'Install @ionic/cordova-builders for compatibility',
        'The package @ionic/cordova-builders is required when @ionic/angular-toolkit is version 6 and higher.',
        true,
        'cordova',
      );
    }
  }

  recommendReplace(
    project,
    collector,
    'phonegap-plugin-push',
    'phonegap-plugin-push',
    'Replace with cordova-plugin-push due to deprecation',
    'The plugin phonegap-plugin-push should be replaced with cordova-plugin-push as phonegap-plugin-push was deprecated in 2017',
    '@havesource/cordova-plugin-push',
    'cordova',
  );

  if (project.analyzer.exists('cordova-plugin-customurlscheme') && project.analyzer.exists('ionic-plugin-deeplinks')) {
    recommendRemove(
      project,
      collector,
      'cordova-plugin-customurlscheme',
      'cordova-plugin-customurlscheme',
      'Remove as the functionality is part of ionic-plugin-deeplinks which is already installed.',
      undefined,
      undefined,
      'cordova',
    );
  }

  if (project.analyzer.exists('@ionic-enterprise/identity-vault')) {
    checkCordovaIosPreference(project, collector, 'UseSwiftLanguageVersion', [4.2, 5], 4.2);
    if (!project.analyzer.isGreaterOrEqual('@ionic-enterprise/identity-vault', '5.0.0')) {
      checkMinVersion(
        project,
        collector,
        '@ionic-enterprise/identity-vault',
        '5.0.0',
        'Update to v5 as it contains significant security fixes and broader support for Android security features',
        'https://ionic.io/docs/identity-vault',
        'security',
      );
    } else if (!project.analyzer.isGreaterOrEqual('@ionic-enterprise/identity-vault', '5.1.0')) {
      checkMinVersion(
        project,
        collector,
        '@ionic-enterprise/identity-vault',
        '5.1.0',
        'as the current version is missing important security fixes.',
        'https://ionic.io/docs/identity-vault',
        'security',
      );
    }
  }

  if (
    project.analyzer.exists('cordova-support-google-services') &&
    project.analyzer.isGreaterOrEqual('cordova-android', '9.0.0')
  ) {
    recommendRemove(
      project,
      collector,
      'cordova-support-google-services',
      'cordova-support-google-services',
      'Remove as the functionality is built into cordova-android 9+. See: https://github.com/chemerisuk/cordova-support-google-services',
      undefined,
      undefined,
      'cordova',
    );
  }
}

export function checkCordovaPlugins(
  packages: Record<string, any>,
  project: Project,
  collector: FindingCollector,
): void {
  if (Object.keys(packages).length === 0) return;

  const ignorePlugins = ['cordova-plugin-add-swift-support', 'cordova-plugin-ionic-webview'];
  const missing: string[] = [];

  for (const library of Object.keys(packages)) {
    if (packages[library].depType === 'Plugin') {
      for (const dependentPlugin of packages[library].plugin?.dependentPlugins ?? []) {
        if (
          !project.analyzer.exists(dependentPlugin) &&
          !ignorePlugins.includes(dependentPlugin) &&
          !missing.includes(dependentPlugin)
        ) {
          missing.push(dependentPlugin);
          const id = `missing-package-${dependentPlugin.replace(/^@/, '').replace(/\//g, '-')}`;
          collector.add({
            id,
            severity: 'warning',
            category: 'cordova',
            title: `Missing dependency ${dependentPlugin}`,
            detail: `The plugin ${library} has a dependency on ${dependentPlugin} but it is missing from your project. It should be installed.`,
            fixable: true,
            fix: {
              id,
              command: npmInstall(dependentPlugin, commandContext(project)),
            },
          });
        }
      }
    }
  }
}
