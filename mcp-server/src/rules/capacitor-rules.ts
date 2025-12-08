/**
 * Analysis tools for MCP server
 * Generates project analysis and recommendations
 */

import {
  checkConsistentVersions,
  checkMinVersion,
  deprecatedPackages,
  exists,
  isGreaterOrEqual,
  isLess,
  remotePackages,
} from '../shared/analyzer.js';
import { Project } from '../shared/project.js';
import { Tip, TipType } from '../shared/tip.js';

/**
 * Check Angular-specific rules
 */
export function checkAngularRules(project: Project): void {
  if (!exists('@angular/core')) return;

  // Check for minimum Ionic CLI version for Angular 12+
  if (isGreaterOrEqual('@angular/core', '12.0.0')) {
    if (isLess('@ionic/cli', '7.2.0')) {
      project.addTip(
        new Tip(
          'Upgrade @ionic/cli to 7.2.0+',
          'Required for live reload support with Angular 12+',
          TipType.Warning,
        ).setRelatedDependency('@ionic/cli'),
      );
    }
  }
}

/**
 * Check Capacitor-specific rules and generate tips
 */
export async function checkCapacitorRules(project: Project): Promise<void> {
  // Check minimum versions
  const minCapVersion = checkMinVersion('@capacitor/core', '2.2.0');
  if (minCapVersion && !minCapVersion.satisfies) {
    project.addTip(
      new Tip(
        `Upgrade @capacitor/core to ${minCapVersion.requiredVersion}+`,
        `Current version: ${minCapVersion.currentVersion}, required: ${minCapVersion.requiredVersion}`,
        TipType.Error,
      ).setRelatedDependency('@capacitor/core'),
    );
  }

  // Check consistent versions
  const coreCliCheck = checkConsistentVersions('@capacitor/core', '@capacitor/cli');
  if (!coreCliCheck.consistent) {
    project.addTip(
      new Tip(
        'Inconsistent versions: @capacitor/core and @capacitor/cli',
        `@capacitor/core: ${coreCliCheck.version1}, @capacitor/cli: ${coreCliCheck.version2}`,
        TipType.Warning,
      ),
    );
  }

  const coreIosCheck = checkConsistentVersions('@capacitor/core', '@capacitor/ios');
  if (!coreIosCheck.consistent) {
    project.addTip(
      new Tip(
        'Inconsistent versions: @capacitor/core and @capacitor/ios',
        `@capacitor/core: ${coreIosCheck.version1}, @capacitor/ios: ${coreIosCheck.version2}`,
        TipType.Warning,
      ),
    );
  }

  const coreAndroidCheck = checkConsistentVersions('@capacitor/core', '@capacitor/android');
  if (!coreAndroidCheck.consistent) {
    project.addTip(
      new Tip(
        'Inconsistent versions: @capacitor/core and @capacitor/android',
        `@capacitor/core: ${coreAndroidCheck.version1}, @capacitor/android: ${coreAndroidCheck.version2}`,
        TipType.Warning,
      ),
    );
  }

  // Check for CLI installation
  if (!exists('@capacitor/cli')) {
    project.addTip(
      new Tip(
        'Install @capacitor/cli',
        'The Capacitor CLI should be installed locally in your project',
        TipType.Error,
        '@capacitor/cli should be installed as a dev dependency',
      )
        .setRelatedDependency('@capacitor/cli')
        .setAction('install_plugin', '@capacitor/cli', '--save-dev'),
    );
  }

  // Check for deprecated plugins
  checkDeprecatedPlugins(project);

  // Check for plugin replacements
  checkPluginReplacements(project);
}

/**
 * Check for remote dependencies
 */
export function checkRemoteDependencies(project: Project): void {
  const remote = remotePackages();
  if (remote.length > 0) {
    for (const pkg of remote) {
      project.addTip(
        new Tip(
          `Remote dependency: ${pkg}`,
          `The package ${pkg} is installed from a remote git repository which may cause issues`,
          TipType.Warning,
        ).setRelatedDependency(pkg),
      );
    }
  }
}

/**
 * Generate all recommendations for a project
 */
export async function generateRecommendations(project: Project): Promise<void> {
  project.clearTips();

  if (project.isCapacitor) {
    await checkCapacitorRules(project);
  }

  checkRemoteDependencies(project);
  checkAngularRules(project);
}

/**
 * Get plugin compatibility information
 */
export function getPluginCompatibility(pluginName: string): {
  compatible: boolean;
  message?: string;
  replacement?: string;
} {
  const deprecatedList = deprecatedPackages();
  if (deprecatedList.includes(pluginName)) {
    return {
      compatible: false,
      message: `${pluginName} is deprecated`,
    };
  }

  // Check known incompatible plugins
  const incompatible: Record<string, { message: string; replacement?: string }> = {
    'cordova-plugin-advanced-http': {
      message: 'Replaced by built-in Capacitor functionality',
      replacement: '@capacitor/core',
    },
    'cordova-plugin-appsflyer-sdk': {
      message: "Doesn't build with Capacitor",
      replacement: 'appsflyer-capacitor-plugin',
    },
  };

  if (incompatible[pluginName]) {
    return {
      compatible: false,
      ...incompatible[pluginName],
    };
  }

  return {
    compatible: true,
  };
}

/**
 * Check for deprecated plugins
 */
function checkDeprecatedPlugins(project: Project): void {
  const deprecated = deprecatedPackages();
  for (const pkg of deprecated) {
    project.addTip(
      new Tip(
        `Deprecated: ${pkg}`,
        `The package ${pkg} is deprecated and should be replaced`,
        TipType.Warning,
      ).setRelatedDependency(pkg),
    );
  }
}

/**
 * Check for plugin replacement recommendations
 */
function checkPluginReplacements(project: Project): void {
  const replacements = [
    {
      new: 'appsflyer-capacitor-plugin',
      old: 'cordova-plugin-appsflyer-sdk',
      reason: 'The plugin cordova-plugin-appsflyer-sdk should be replaced with appsflyer-capacitor-plugin',
    },
    {
      new: '@capacitor/dialog',
      old: '@ionic-enterprise/dialogs',
      reason:
        'The plugin @ionic-enterprise/dialogs should be replaced with @capacitor/dialog as it is an officially supported Capacitor plugin',
    },
    {
      new: 'capacitor-rate-app',
      old: '@ionic-enterprise/app-rate',
      reason: 'The plugin @ionic-enterprise/app-rate should be replaced with capacitor-rate-app',
    },
    {
      new: '@capacitor/core',
      old: 'cordova-plugin-advanced-http',
      reason: 'Capacitor now provides native HTTP functionality built in',
    },
  ];

  for (const replacement of replacements) {
    if (exists(replacement.old)) {
      project.addTip(
        new Tip(`Replace ${replacement.old} with ${replacement.new}`, replacement.reason, TipType.Idea)
          .setRelatedDependency(replacement.old)
          .setAction('replace_plugin', replacement.old, replacement.new),
      );
    }
  }

  // Check for packages that should be removed
  const toRemove = [
    {
      pkg: '@ionic-enterprise/promise',
      reason: 'This plugin should no longer be required in projects',
    },
    {
      pkg: 'cordova-plugin-appminimize',
      reason: 'This plugin can be replaced with the minimizeApp method of @capacitor/app',
    },
    {
      pkg: 'cordova-plugin-datepicker',
      reason: 'This plugin appears to have been abandoned. Consider using ion-datetime',
    },
    {
      pkg: '@ionic/cordova-builders',
      reason: 'This package is only required for Cordova projects',
    },
  ];

  for (const item of toRemove) {
    if (exists(item.pkg)) {
      project.addTip(
        new Tip(`Remove ${item.pkg}`, item.reason, TipType.Idea)
          .setRelatedDependency(item.pkg)
          .setAction('uninstall_plugin', item.pkg),
      );
    }
  }
}
