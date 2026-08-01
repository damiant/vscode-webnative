import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { checkPrivacyManifest } from '../native/privacy';
import { commandContext, npmInstall } from '../build/node-commands';
import { FindingCollector } from './finding';
import {
  checkConsistentVersions,
  checkMinVersion,
  hasNodeModules,
  incompatiblePlugin,
  incompatibleReplacementPlugin,
  notRequiredPlugin,
  recommendAdd,
  recommendRemove,
  recommendReplace,
  replacementPlugin,
} from './factories';
import { checkMigrationAngularToolkit } from './rules-angular-toolkit';
import { checkAngularJson } from './rules-angular-json';
import { checkBrowsersList } from './rules-browserslist';

function suggestCapacitorMigration(
  project: Project,
  collector: FindingCollector,
  fromVersion: string,
  toVersion: string,
  url: string,
): void {
  if (
    project.analyzer.isLess('@capacitor/core', toVersion) &&
    project.analyzer.isGreaterOrEqual('@capacitor/core', fromVersion) &&
    hasNodeModules(project)
  ) {
    collector.add({
      id: `migrate-capacitor-${toVersion.split('.')[0]}`,
      severity: 'info',
      category: 'capacitor',
      title: `Migrate to Capacitor ${toVersion.split('.')[0]}`,
      detail: `Your project is on Capacitor ${project.analyzer.getPackageVersion('@capacitor/core')?.version}. Consider migrating to Capacitor ${toVersion.split('.')[0]}.`,
      url,
      fixable: false,
    });
  }
}

function checkBuildGradleForMinifyInRelease(project: Project, collector: FindingCollector): void {
  const filename = join(project.folder, 'android', 'app', 'build.gradle');
  if (existsSync(filename)) {
    const txt = readFileSync(filename, 'utf8');
    if (txt.includes('minifyEnabled true')) {
      checkMinVersion(
        project,
        collector,
        '@capacitor/android',
        '3.2.3',
        'to ensure Android release builds work when minifyEnabled is true',
        'https://developer.android.com/studio/build/shrink-code',
        'android',
      );
    }
  }
}

async function checkPrivacyManifestRules(project: Project, collector: FindingCollector): Promise<void> {
  if (!project.analyzer.exists('@capacitor/ios')) return;

  const result = await checkPrivacyManifest(project.projectFolder(), (plugin) => project.analyzer.exists(plugin));
  if (!result.required) return;

  if (result.error) {
    collector.add({
      id: 'privacy-manifest-error',
      severity: 'warning',
      category: 'privacy',
      title: 'Privacy manifest check failed',
      detail: result.error,
      fixable: false,
    });
    return;
  }

  if (result.needsCreation) {
    collector.add({
      id: 'privacy-manifest-missing',
      severity: 'warning',
      category: 'privacy',
      title: 'Add Privacy Manifest',
      detail: 'A Privacy Manifest file is required by Apple when submitting your app to the App Store.',
      fixable: false,
    });
  }

  for (const missing of result.missingCategories) {
    collector.add({
      id: `privacy-manifest-category-${missing.api}`,
      severity: 'warning',
      category: 'privacy',
      title: `Privacy manifest missing category ${missing.api}`,
      detail: `Plugin ${missing.plugin} requires reason codes for ${missing.api}. See ${missing.reasonUrl}`,
      url: missing.reasonUrl,
      fixable: false,
    });
  }
}

export async function checkCapacitorRules(project: Project, collector: FindingCollector): Promise<void> {
  checkMinVersion(project, collector, '@capacitor/core', '2.2.0', undefined, undefined, 'capacitor');
  checkConsistentVersions(project, collector, '@capacitor/core', '@capacitor/cli');
  checkConsistentVersions(project, collector, '@capacitor/core', '@capacitor/ios');
  checkConsistentVersions(project, collector, '@capacitor/core', '@capacitor/android');

  if (project.analyzer.exists('@ionic/cli')) {
    checkMinVersion(project, collector, '@ionic/cli', '6.0.0', undefined, undefined, 'capacitor');
  }
  if (!project.analyzer.exists('@capacitor/cli')) {
    recommendAdd(
      project,
      collector,
      '@capacitor/cli',
      '@capacitor/cli',
      'Install @capacitor/cli',
      'The Capacitor CLI should be installed locally in your project',
      true,
      'capacitor',
    );
  }

  recommendReplace(
    project,
    collector,
    'cordova-plugin-appsflyer-sdk',
    'cordova-plugin-appsflyer-sdk',
    'Replace with appsflyer-capacitor-plugin.',
    'The plugin cordova-plugin-appsflyer-sdk should be replaced with appsflyer-capacitor-plugin.',
    'appsflyer-capacitor-plugin',
    'capacitor',
  );

  recommendReplace(
    project,
    collector,
    '@ionic-enterprise/dialogs',
    '@ionic-enterprise/dialogs',
    'Replace with @capacitor/dialog due to official support',
    'The plugin @ionic-enterprise/dialogs should be replaced with @capacitor/dialog as it is an officially supported Capacitor plugin',
    '@capacitor/dialog',
    'capacitor',
  );

  recommendReplace(
    project,
    collector,
    '@ionic-enterprise/app-rate',
    '@ionic-enterprise/app-rate',
    'Replace with capacitor-rate-app due to Capacitor support',
    'The plugin @ionic-enterprise/app-rate should be replaced with capacitor-rate-app as designed to work with Capacitor',
    'capacitor-rate-app',
    'capacitor',
  );

  recommendReplace(
    project,
    collector,
    '@ionic-enterprise/nativestorage',
    '@ionic-enterprise/nativestorage',
    'Replace with @ionic/storage due to support',
    'The plugin @ionic-enterprise/nativestorage should be replaced with @ionic/storage. Consider @ionic-enterprise/secure-storage if encryption is required',
    '@ionic/storage',
    'capacitor',
  );

  recommendReplace(
    project,
    collector,
    'cordova-plugin-advanced-http',
    'cordova-plugin-advanced-http',
    'Replace with @capacitor/core due to official support',
    'The plugin cordova-plugin-advanced-http should be replaced with @capacitor/core. Capacitor now provides the equivalent native http functionality built in.',
    '@capacitor/core',
    'capacitor',
  );

  recommendRemove(
    project,
    collector,
    '@ionic-enterprise/promise',
    '@ionic-enterprise/promise',
    'This plugin should no longer be required in projects.',
    undefined,
    undefined,
    'capacitor',
  );

  recommendRemove(
    project,
    collector,
    'cordova-plugin-appminimize',
    'cordova-plugin-appminimize',
    'This plugin is not required and can be replaced with the minimizeApp method of @capacitor/app',
    undefined,
    'https://capacitorjs.com/docs/apis/app#minimizeapp',
    'capacitor',
  );

  recommendRemove(
    project,
    collector,
    'cordova-plugin-datepicker',
    'cordova-plugin-datepicker',
    'This plugin appears to have been abandoned in 2015. Consider using ion-datetime.',
    undefined,
    undefined,
    'capacitor',
  );

  recommendRemove(
    project,
    collector,
    '@jcesarmobile/ssl-skip',
    '@jcesarmobile/ssl-skip',
    'This plugin should only be used during development. Submitting an app with it included will cause it to be rejected.',
    undefined,
    undefined,
    'security',
  );

  if (project.analyzer.exists('cordova-plugin-file-transfer') && !project.analyzer.exists('cordova-plugin-whitelist')) {
    recommendAdd(
      project,
      collector,
      'cordova-plugin-whitelist',
      'cordova-plugin-file-transfer',
      'Install cordova-plugin-whitelist for compatibility',
      'The plugin cordova-plugin-file-transfer has a dependency on cordova-plugin-whitelist when used with a Capacitor project',
      false,
      'capacitor',
    );
  }

  if (
    project.analyzer.exists('@ionic-enterprise/auth') &&
    project.analyzer.isLessOrEqual('onesignal-cordova-plugin', '5.0.2')
  ) {
    recommendRemove(
      project,
      collector,
      'onesignal-cordova-plugin',
      'onesignal-cordova-plugin',
      'This plugin causes build errors on Android when used with Ionic Auth Connect. Upgrade to 5.0.3 or higher.',
      undefined,
      'https://github.com/OneSignal/OneSignal-Cordova-SDK/issues/928',
      'capacitor',
    );
  }

  if (project.analyzer.exists('@ionic/cordova-builders')) {
    recommendRemove(
      project,
      collector,
      '@ionic/cordova-builders',
      '@ionic/cordova-builders',
      'This package is only required for Cordova projects.',
      undefined,
      undefined,
      'capacitor',
    );
  }

  if (project.analyzer.isGreaterOrEqual('@ionic/angular-toolkit', '6.0.0')) {
    checkMigrationAngularToolkit(project, collector);
  }

  if (project.analyzer.exists('@capacitor/ios')) {
    await checkPrivacyManifestRules(project, collector);
  }

  if (project.analyzer.isGreaterOrEqual('@angular/core', '12.0.0')) {
    checkAngularJson(project, collector);
    if (project.analyzer.exists('@capacitor/android') || project.analyzer.exists('@capacitor/ios')) {
      checkBrowsersList(project, collector);
    }
    if (project.analyzer.isLess('@ionic/cli', '7.2.0')) {
      checkMinVersion(project, collector, '@ionic/cli', '7.2.0', 'to fix live reload support', undefined, 'capacitor');
    }
  }

  if (project.analyzer.isLess('@capacitor/android', '3.2.3')) {
    checkBuildGradleForMinifyInRelease(project, collector);
  }

  if (project.analyzer.isLess('@capacitor/android', '3.0.0')) {
    const coreVersion = project.analyzer.getPackageVersion('@capacitor/core')?.version;
    collector.add({
      id: 'capacitor-play-store-deadline',
      severity: 'error',
      category: 'android',
      title: 'Your app cannot be submitted to the Play Store after 1st November 2022',
      detail: `Capacitor ${coreVersion} must be migrated to Capacitor 4 to meet Play Store requirements of minimum target of SDK 31.`,
      url: 'https://capacitorjs.com/docs/updating/3-0',
      fixable: false,
    });
  }

  if (project.analyzer.isLess('@capacitor/core', '4.0.1') || project.analyzer.startsWith('@capacitor/core', '4.0.0')) {
    if (hasNodeModules(project) && project.analyzer.isGreaterOrEqual('@capacitor/core', '3.0.0')) {
      collector.add({
        id: 'migrate-capacitor-4',
        severity: 'info',
        category: 'capacitor',
        title: 'Migrate to Capacitor 4',
        detail: 'Recommend migration from Capacitor 3 to Capacitor 4.',
        url: 'https://capacitorjs.com/docs/updating/4-0',
        fixable: false,
      });
    }
  }

  suggestCapacitorMigration(project, collector, '4.0.0', '5.0.0', 'https://capacitorjs.com/docs/updating/5-0');
  suggestCapacitorMigration(project, collector, '5.0.0', '6.0.0', 'https://capacitorjs.com/docs/updating/6-0');
  suggestCapacitorMigration(project, collector, '6.0.0', '7.0.0', 'https://capacitorjs.com/docs/updating/7-0');
  suggestCapacitorMigration(project, collector, '7.0.0', '8.0.0', 'https://capacitorjs.com/docs/updating/8-0');

  if (!project.analyzer.isGreaterOrEqual('@ionic-enterprise/identity-vault', '5.1.0')) {
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

  const pluginFindings = await capacitorRecommendations(project, false);
  for (const finding of pluginFindings) {
    collector.add(finding);
  }
}

export async function capacitorRecommendations(
  project: Project,
  forMigration: boolean,
): Promise<import('./finding').Finding[]> {
  const findings: import('./finding').Finding[] = [];
  const collector: FindingCollector = {
    findings,
    add(f: import('./finding').Finding) {
      findings.push(f);
    },
  };

  function runCheck(fn: () => void) {
    fn();
  }

  function addOptional(fn: () => void) {
    if (!forMigration) fn();
  }

  if (
    project.repoType === MonoRepoType.nx &&
    !project.analyzer.exists('@nxext/capacitor') &&
    !project.analyzer.exists('@nxtend/capacitor') &&
    project.analyzer.exists('@nrwl/workspace')
  ) {
    collector.add({
      id: 'add-nx-capacitor-extension',
      severity: 'info',
      category: 'capacitor',
      title: 'Add Capacitor Extension for NX',
      detail: 'Add Capacitor Extension for NX?',
      url: 'https://nxext.dev/docs/capacitor/overview.html',
      fixable: true,
      fix: {
        id: 'add-nx-capacitor-extension',
        command: npmInstall('@nxext/capacitor', commandContext(project)),
      },
    });
  }

  if (
    !project.fileExists('capacitor.config.ts') &&
    !project.fileExists('capacitor.config.js') &&
    !project.fileExists('capacitor.config.json') &&
    !project.isCapacitorPlugin
  ) {
    collector.add({
      id: 'integrate-capacitor-config',
      severity: 'info',
      category: 'capacitor',
      title: 'Integrate Capacitor',
      detail: 'Add the Capacitor integration to this project',
      url: 'https://capacitorjs.com/docs/cordova/migrating-from-cordova-to-capacitor',
      fixable: false,
    });
  } else {
    if (!project.hasCapacitorProject(CapacitorPlatform.android) && hasNodeModules(project)) {
      collector.add({
        id: 'add-android-project',
        severity: 'info',
        category: 'android',
        title: 'Add Android Project',
        detail: 'Add Android support to your Capacitor project?',
        fixable: false,
      });
    }
    if (!project.hasCapacitorProject(CapacitorPlatform.ios) && hasNodeModules(project)) {
      collector.add({
        id: 'add-ios-project',
        severity: 'info',
        category: 'ios',
        title: 'Add iOS Project',
        detail: 'Add iOS support to your Capacitor project?',
        fixable: false,
      });
    }
  }

  if (
    project.analyzer.exists('@ionic/angular') &&
    !project.analyzer.exists('@angular/service-worker') &&
    project.analyzer.isGreaterOrEqual('@angular/core', '17.0.0')
  ) {
    collector.add({
      id: 'add-pwa-integration',
      severity: 'info',
      category: 'angular',
      title: 'Add PWA Integration',
      detail: 'Add @angular/pwa and integrate splash and icon resources',
      fixable: false,
    });
  }

  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'cordova-plugin-admobpro',
      'https://github.com/ionic-team/capacitor/issues/1101',
    ),
  );
  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'cordova-plugin-braintree',
      'https://github.com/ionic-team/capacitor/issues/1415',
    ),
  );
  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'cordova-plugin-code-push',
      'https://github.com/microsoft/code-push/issues/615',
    ),
  );
  runCheck(() =>
    incompatiblePlugin(project, collector, 'cordova-plugin-fcm', 'https://github.com/ionic-team/capacitor/issues/584'),
  );
  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'cordova-plugin-firebase',
      'https://github.com/ionic-team/capacitor/issues/815',
    ),
  );

  runCheck(() => notRequiredPlugin(project, collector, 'cordova-support-google-services'));
  runCheck(() => incompatiblePlugin(project, collector, 'cordova-plugin-passbook'));
  runCheck(() =>
    incompatibleReplacementPlugin(project, collector, 'cordova-plugin-ionic-keyboard', '@capacitor/keyboard'),
  );

  if (
    project.analyzer.exists('cordova-sqlite-storage') &&
    project.analyzer.exists('@ionic-enterprise/secure-storage')
  ) {
    recommendRemove(
      project,
      collector,
      'cordova-sqlite-storage',
      'Conflict with Secure Storage',
      'cordova-sqlite-storage cannot be used with Secure Storage (@ionic-enterprise/secure-storage) as it will cause compilation errors. cordova-sqlite-storage should be removed.',
      undefined,
      undefined,
      'capacitor',
    );
  }

  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'cordova-plugin-firebasex',
      'https://github.com/dpa99c/cordova-plugin-firebasex/issues/610#issuecomment-810236545',
    ),
  );
  runCheck(() =>
    incompatiblePlugin(project, collector, 'cordova-plugin-music-controls', 'It causes build failures, skipped'),
  );
  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'cordova-plugin-qrscanner',
      'https://github.com/ionic-team/capacitor/issues/1213',
    ),
  );
  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'cordova-plugin-swrve',
      'It relies on Cordova specific feature CDVViewController',
    ),
  );
  runCheck(() =>
    incompatiblePlugin(project, collector, 'cordova-plugin-ios-keychain', 'It is not compatible with Capacitor'),
  );

  runCheck(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-googlemaps',
      '@capacitor/google-maps',
      'It causes build failures on iOS but can be replaced with @capacitor/google-maps and will require code refactoring.',
      'error',
    ),
  );
  runCheck(() =>
    replacementPlugin(
      project,
      collector,
      'capacitor-rate-app',
      '@capacitor-community/in-app-review',
      'The capacitor-rate-app plugin has been deprecated in favor of @capacitor-community/in-app-review.',
      'error',
    ),
  );
  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'newrelic-cordova-plugin',
      'It relies on Cordova hooks. https://github.com/newrelic/newrelic-cordova-plugin/issues/15',
    ),
  );
  runCheck(() =>
    replacementPlugin(
      project,
      collector,
      'phonegap-plugin-push',
      '@havesource/cordova-plugin-push',
      'It will not compile but can be replaced with the plugin cordova-plugin-push',
    ),
  );
  runCheck(() =>
    incompatiblePlugin(
      project,
      collector,
      'cordova-plugin-appsflyer-sdk',
      'It will not compile but can be replaced with the plugin appsflyer-capacitor-plugin',
    ),
  );

  runCheck(() => notRequiredPlugin(project, collector, 'cordova-plugin-compat'));
  if (!project.analyzer.exists('cordova-plugin-file-transfer')) {
    runCheck(() =>
      notRequiredPlugin(
        project,
        collector,
        'cordova-plugin-whitelist',
        'The functionality is built into Capacitors configuration file',
      ),
    );
  }
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-plugin-crosswalk-webview',
      'Capacitor doesn’t allow to change the webview',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-plugin-ionic-webview',
      'An App store compliant Webview is built into Capacitor',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-plugin-wkwebview-engine',
      'An App store compliant Webview is built into Capacitor',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-plugin-androidx',
      'This was required for Cordova Android 10 support but is not required by Capacitor',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-android-support-gradle-release',
      'Capacitor provides control to set library versions',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-plugin-add-swift-support',
      'Swift is supported out-of-the-box with Capacitor',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-plugin-enable-multidex',
      'Multidex is handled by Android Studio and does not require a plugin',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-support-android-plugin',
      'This plugin is used to simplify Cordova plugin development and is not required for Capacitor',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(
      project,
      collector,
      'cordova-plugin-androidx-adapter',
      'Android Studio patches plugins for AndroidX without requiring this plugin',
    ),
  );
  runCheck(() =>
    notRequiredPlugin(project, collector, 'cordova-custom-config', 'Configuration achieved through native projects'),
  );
  runCheck(() =>
    notRequiredPlugin(project, collector, 'cordova-plugin-cocoapod-support', 'Pod dependencies supported in Capacitor'),
  );
  runCheck(() =>
    notRequiredPlugin(project, collector, 'phonegap-plugin-multidex', 'Android Studio handles compilation'),
  );

  runCheck(() =>
    checkMinVersion(
      project,
      collector,
      'cordova-plugin-inappbrowser',
      '5.0.0',
      'to compile in a Capacitor project',
      undefined,
      'capacitor',
    ),
  );
  runCheck(() =>
    checkMinVersion(
      project,
      collector,
      'cordova-plugin-camera',
      '6.0.0',
      'to compile in a Capacitor project',
      undefined,
      'capacitor',
    ),
  );
  runCheck(() =>
    checkMinVersion(
      project,
      collector,
      'cordova.plugins.diagnostic',
      '6.1.1',
      'to compile in a Capacitor project',
      undefined,
      'capacitor',
    ),
  );
  runCheck(() =>
    checkMinVersion(
      project,
      collector,
      'cordova-plugin-file-opener2',
      '2.1.1',
      'to compile in a Capacitor project',
      undefined,
      'capacitor',
    ),
  );
  runCheck(() =>
    checkMinVersion(
      project,
      collector,
      'cordova-plugin-statusbar',
      '3.0.0',
      'to compile in a Capacitor project',
      undefined,
      'capacitor',
    ),
  );
  runCheck(() =>
    checkMinVersion(
      project,
      collector,
      'branch-cordova-sdk',
      '4.0.0',
      'Requires update. See: https://help.branch.io/developers-hub/docs/capacitor',
      'https://help.branch.io/developers-hub/docs/capacitor',
      'capacitor',
    ),
  );

  runCheck(() => incompatibleReplacementPlugin(project, collector, 'sentry-cordova', '@sentry/capacitor'));
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-actionsheet',
      '@capacitor/action-sheet',
      'https://capacitorjs.com/docs/apis/action-sheet',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-camera',
      '@capacitor/camera',
      'https://capacitorjs.com/docs/apis/camera',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'ionic-plugin-deeplinks',
      '@capacitor/app',
      'https://capacitorjs.com/docs/guides/deep-links',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-customurlscheme',
      '@capacitor/app',
      'https://capacitorjs.com/docs/guides/deep-links',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      '@ionic-enterprise/clipboard',
      '@capacitor/clipboard',
      'https://capacitorjs.com/docs/apis/clipboard',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      '@ionic-enterprise/deeplinks',
      '@capacitor/app',
      'https://capacitorjs.com/docs/guides/deep-links',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      '@ionic-enterprise/statusbar',
      '@capacitor/status-bar',
      'https://capacitorjs.com/docs/apis/status-bar',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-firebase',
      '@capacitor-community/fcm',
      'https://github.com/capacitor-community/fcm',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-firebase-messaging',
      '@capacitor/push-notifications',
      'https://capacitorjs.com/docs/apis/push-notifications',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-firebase-analytics',
      '@capacitor-community/firebase-analytics',
      'https://github.com/capacitor-community/firebase-analytics',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-app-version',
      '@capacitor/app',
      'https://capacitorjs.com/docs/apis/app',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-dialogs',
      '@capacitor/dialog',
      'https://capacitorjs.com/docs/apis/dialog',
    ),
  );

  if (!project.analyzer.exists('cordova-plugin-advanced-http')) {
    addOptional(() =>
      replacementPlugin(
        project,
        collector,
        'cordova-plugin-file',
        '@capacitor/filesystem',
        'https://capacitorjs.com/docs/apis/filesystem',
      ),
    );
  }

  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-file-transfer',
      '@capacitor/filesystem',
      'https://capacitorjs.com/docs/apis/filesystem',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-datepicker',
      '@capacitor-community/date-picker',
      'https://github.com/capacitor-community/date-picker',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-geolocation',
      '@capacitor/geolocation',
      'https://capacitorjs.com/docs/apis/geolocation',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-sqlite-storage',
      '@capacitor-community/sqlite',
      'https://github.com/capacitor-community/sqlite',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-safariviewcontroller',
      '@capacitor/browser',
      'https://capacitorjs.com/docs/apis/browser',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-appavailability',
      '@capacitor/app',
      'https://capacitorjs.com/docs/apis/app',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-network-information',
      '@capacitor/network',
      'https://capacitorjs.com/docs/apis/network',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-device',
      '@capacitor/device',
      'https://capacitorjs.com/docs/apis/device',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-ionic-keyboard',
      '@capacitor/keyboard',
      'https://capacitorjs.com/docs/apis/keyboard',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-splashscreen',
      '@capacitor/splash-screen',
      'https://capacitorjs.com/docs/apis/splash-screen',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'cordova-plugin-statusbar',
      '@capacitor/status-bar',
      'https://capacitorjs.com/docs/apis/status-bar',
    ),
  );
  addOptional(() =>
    replacementPlugin(
      project,
      collector,
      'phonegap-plugin-push',
      '@capacitor/push-notifications',
      'https://capacitorjs.com/docs/apis/push-notifications',
    ),
  );

  return findings;
}
