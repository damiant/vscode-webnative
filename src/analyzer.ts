'use strict';

import { coerce, compare, lt, gte, lte } from 'semver';

import { XMLParser, X2jOptions } from 'fast-xml-parser';

import {
  writeConsistentVersionError,
  writeMinVersionError,
  writeMinVersionWarning,
  error,
  writeConsistentVersionWarning,
} from './messages';
import { processPackages } from './process-packages';
import { Command, Tip, TipType } from './tip';
import { Project } from './project';
import { getRunOutput } from './utilities';
import { npmInstall, npmUninstall, PackageManager } from './node-commands';
import { exState } from './tree-provider';
import { ExtensionContext, window } from 'vscode';
import { existsSync, lstatSync, readFileSync, statSync, writeFileSync } from 'fs';
import { setStringIn } from './utilities-strings';

let packageFile;
let allDependencies = {};
let cordovaConfig;
let androidManifest;

function createXMLParserConfig(): X2jOptions {
  return {
    removeNSPrefix: true,
    isArray: (name, jPath, isLeafNode, isAttribute) => {
      return true;
    },
    parseTagValue: true,
    parseAttributeValue: true,
    ignoreAttributes: false,
  };
}

function processConfigXML(folder: string) {
  const configXMLFilename = `${folder}/config.xml`;
  const config = { preferences: {}, androidPreferences: {}, iosPreferences: {}, plugins: {} };
  if (existsSync(configXMLFilename)) {
    const xml = readFileSync(configXMLFilename, 'utf8');
    try {
      const parser = new XMLParser(createXMLParserConfig());
      const json = parser.parse(xml);

      const widget = json.widget[0];
      if (widget.preference) {
        for (const pref of widget.preference) {
          config.preferences[pref['@_name']] = pref['@_value'];
        }
      }
      if (!widget.platform) return config;
      for (const platform of widget.platform) {
        if (platform['@_name'] == 'android' && platform.preference) {
          for (const pref of platform.preference) {
            config.androidPreferences[pref['@_name']] = pref['@_value'];
          }
        }

        if (platform['@_name'] == 'ios' && platform.preference) {
          for (const pref of platform.preference) {
            config.iosPreferences[pref['@_name']] = pref['@_value'];
          }
        }
      }
      if (widget.plugin) {
        for (const plugin of widget.plugin) {
          config.plugins[plugin['@_name']] = plugin['@_spec'];
        }
      }
    } catch (err) {
      // Likely a config.xml that is not cordova
      console.error(`Unable to parse config.xml`, err);
    }
  }
  return config;
}

function processAndroidXML(folder: string) {
  const androidXMLFilename = `${folder}/android/app/src/main/AndroidManifest.xml`;
  const config = undefined;
  if (!existsSync(androidXMLFilename)) {
    return config;
  }
  const xml = readFileSync(androidXMLFilename, 'utf8');
  const parser = new XMLParser(createXMLParserConfig());
  return parser.parse(xml);
}

function getAndroidManifestIntent(name: string) {
  function matches(attribute, value, array) {
    return array.find((element) => element[attribute] == value) != undefined;
  }

  console.log(androidManifest.manifest[0].application[0].activity[0]);
  for (const intent of androidManifest.manifest[0].application[0].activity[0]['intent-filter']) {
    if (matches('@_name', 'android.intent.action.VIEW', intent.action)) {
      return intent;
    }
  }
  return undefined;
}

export async function load(fn: string, project: Project, context: ExtensionContext): Promise<any> {
  let packageJsonFilename = fn;
  if (lstatSync(fn).isDirectory()) {
    packageJsonFilename = fn + '/package.json';
    cordovaConfig = processConfigXML(fn);
    androidManifest = processAndroidXML(fn);
  }
  exState.hasPackageJson = existsSync(packageJsonFilename);
  if (!exState.hasPackageJson) {
    error('package.json', 'This folder does not contain an Ionic application (its missing package.json)');
    allDependencies = [];
    packageFile = {};
    return undefined;
  }
  project.modified = statSync(packageJsonFilename).mtime;
  try {
    packageFile = JSON.parse(readFileSync(packageJsonFilename, 'utf8'));
  } catch (err) {
    throw new Error(`The package.json is malformed: ` + err);
  }
  project.name = packageFile.name;
  if (!project.name) {
    project.name = project.monoRepo?.name;
  }
  if (!project.name) {
    project.name = 'unnamed';
  }
  project.workspaces = packageFile.workspaces;
  if (!project.yarnVersion) {
    if (project.packageManager == PackageManager.yarn) {
      project.yarnVersion = await getYarnVersion(packageFile.packageManager, project.folder);
    }
  }
  allDependencies = {
    ...packageFile.dependencies,
    ...packageFile.devDependencies,
  };

  // Its a capacitor project only if its a dependency and not a dev dependency
  project.isCapacitor = !!(
    packageFile.dependencies &&
    (packageFile.dependencies['@capacitor/core'] ||
      packageFile.dependencies['@capacitor/ios'] ||
      packageFile.dependencies['@capacitor/android'])
  );

  project.isCordova = !!(allDependencies['cordova-ios'] || allDependencies['cordova-android'] || packageFile.cordova);

  return await processPackages(fn, allDependencies, packageFile.devDependencies, context, project);
}

export const checkMinVersion = (library: string, minVersion: string, reason?: string, url?: string): Tip => {
  const v = coerce(allDependencies[library]);
  if (v && lt(v, minVersion)) {
    const tip = writeMinVersionError(library, v.version, minVersion, reason).setRelatedDependency(library);
    tip.url = url;
    return tip;
  }
};

export const warnMinVersion = (library: string, minVersion: string, reason?: string, url?: string): Tip => {
  const v = coerce(allDependencies[library]);
  if (v && lt(v, minVersion)) {
    const tip = writeMinVersionWarning(library, v.version, minVersion, reason, url).setRelatedDependency(library);
    tip.url = url;
    return tip;
  }
};

export function exists(library: string) {
  return !!allDependencies[library];
}

export function matchingBeginingWith(start: string) {
  const result = [];
  for (const library of Object.keys(allDependencies)) {
    if (library.startsWith(start)) {
      result.push(library);
    }
  }
  return result;
}

export function remotePackages(): Array<string> {
  const result = [];
  for (const library of Object.keys(allDependencies)) {
    if (allDependencies[library]?.startsWith('git')) {
      result.push(library);
    }
  }
  return result;
}

export function browsersList(): Array<string> {
  try {
    return JSON.parse(JSON.stringify(packageFile.browserslist));
  } catch {
    return [];
  }
}

export function deprecatedPackages(packages: any): Array<any> {
  const result = [];
  if (!packages) return result;
  for (const library of Object.keys(packages)) {
    if (packages[library].deprecated) {
      result.push({ name: library, message: packages[library].deprecated });
    }
  }
  return result;
}

export function checkCordovaAndroidPreference(project: Project, preference: string, value: string | boolean): Tip {
  if (!cordovaConfig) {
    return;
  }
  if (!equals(cordovaConfig.androidPreferences[preference], value)) {
    const tip = error(
      'config.xml',
      `The android preference ${preference} should be ${value}. Add <preference name="${preference}" value="${value}" /> to <platform name="android"> in config.xml`,
    ).setAfterClickAction('Fix config.xml', AddCordovaAndroidPreference, project.folder, preference, value);
    return tip;
  }
}

function AddCordovaAndroidPreference(folder: string, preference: string, value: string | boolean): Promise<void> {
  const configXMLFilename = `${folder}/config.xml`;
  if (!existsSync(configXMLFilename)) return;
  const txt = readFileSync(configXMLFilename, 'utf8');
  let newtxt = txt;
  // Quick and dirty insertion of the preference or replace of value
  if (newtxt.includes(`<preference name="${preference}"`)) {
    newtxt = setStringIn(txt, `<preference name="${preference}" value="`, '"', `${value}`);
  } else {
    newtxt = txt.replace(
      `<platform name="android">`,
      `<platform name="android">\n        <preference name="${preference}" value="${value}" />`,
    );
  }
  writeFileSync(configXMLFilename, newtxt);
  window.showInformationMessage(`config.xml has been updated to include the ${preference} preference`, 'OK');
}

async function getYarnVersion(packageManager: string, folder: string): Promise<string> {
  if (packageManager) {
    return packageManager.replace('yarn@', '');
  }
  const v = await getRunOutput('yarn --version', folder, undefined, true, true);
  return v ? v.replace('\n', '') : '';
  return packageManager;
}

export function checkAndroidManifest() {
  error('Not Implemented', 'Not implemented yet');
  const intent = getAndroidManifestIntent('android.intent.action.VIEW');
  console.error('WOW');
  console.log(intent);
  return true;
}

export function checkCordovaAndroidPreferenceMinimum(preference, minVersion): Tip {
  if (!cordovaConfig) {
    return;
  }
  const v = coerce(cordovaConfig.androidPreferences[preference]);
  if (!v || lt(v, minVersion)) {
    return error(
      'config.xml',
      `The android preference ${preference} should be at a minimum ${minVersion}. Add <preference name="${preference}" value="${minVersion}" /> to <platform name="android"> in config.xml`,
    );
  }
}

function equals(value: any, expected: any | Array<any>) {
  if (value == expected) {
    return true;
  }
  if (expected instanceof Array && expected.includes(value)) {
    return true;
  }
  return false;
}

export function checkCordovaIosPreference(preference: string, value: any, preferredValue: number): Tip {
  if (!cordovaConfig) {
    return;
  }
  if (!equals(cordovaConfig.iosPreferences[preference], value)) {
    if (preferredValue) {
      return error(
        'config.xml',
        `The ios preference ${preference} cannot be ${cordovaConfig.iosPreferences[preference]}. Add <preference name="${preference}" value="${preferredValue}" /> to <platform name="ios"> in config.xml`,
      );
    } else {
      return error(
        'config.xml',
        `The ios preference ${preference} should be ${value}. Add <preference name="${preference}" value="${value}" /> to <platform name="ios"> in config.xml`,
      );
    }
  }
}

export function getPackageVersion(library: string): any {
  return coerce(allDependencies[library]);
}

export function isGreaterOrEqual(library: string, minVersion: string): boolean {
  const v = coerce(allDependencies[library]);
  return v && gte(v, minVersion);
}

export function isVersionGreaterOrEqual(version: string, minVersion: string): boolean {
  const v = coerce(version);
  return v && gte(v, minVersion);
}

export function startsWith(library: string, version: string): boolean {
  const v = allDependencies[library];
  return v && v.startsWith(version);
}

export function isLessOrEqual(library: string, minVersion: string): boolean {
  const v = coerce(allDependencies[library]);
  return v && lte(v, minVersion);
}

export function isLess(library: string, minVersion: string): boolean {
  const v = coerce(allDependencies[library]);
  return v && lt(v, minVersion);
}

export function checkConsistentVersions(lib1: string, lib2: string): Tip {
  const v1 = coerce(allDependencies[lib1]);
  const v2 = coerce(allDependencies[lib2]);

  if (v1 && v2 && compare(v1, v2)) {
    if (v1.major === v2.major) {
      return writeConsistentVersionWarning(lib1, v1.version, lib2, v2.version);
    } else {
      return writeConsistentVersionError(lib1, v1.version, lib2, v2.version);
    }
  }
}

export function notRequiredPlugin(name: string, message?: string): Tip {
  if (exists(name)) {
    const msg = message ? '. ' + message : '';
    return new Tip(
      name,
      `Not required with Capacitor${msg}`,
      TipType.Comment,
      `The plugin ${name} is not required with Capacitor${msg}`,
      npmUninstall(name),
      'Uninstall',
      `${name} was uninstalled`,
    ).canIgnore();
  }
}

export function replacementPlugin(name: string, replacement: string, url?: string, tipType?: TipType): Tip {
  if (exists(name)) {
    const reason = replacement.startsWith('@capacitor/')
      ? ' as it has official support from the Capacitor team.'
      : ' as it offers equivalent functionality.';
    return new Tip(
      name,
      `Replace with ${replacement}${url ? ' (' + url + ')' : ''}`,
      tipType ? tipType : TipType.Idea,
      `Optional Recommendation: The plugin ${name} could be replaced with ${replacement}${reason} Replacing the plugin will require manual refactoring in your code.`,
      npmInstall(replacement) + ' && ' + npmUninstall(name),
      'Replace Plugin',
      `${name} replaced with ${replacement}`,
      url,
    ).canIgnore();
  }
}

export function incompatibleReplacementPlugin(name: string, replacement: string, url?: string): Tip {
  if (exists(name)) {
    return new Tip(
      name,
      `Replace with ${replacement}${url ? ' (' + url + ')' : ''}`,
      TipType.Comment,
      `The plugin ${name} is incompatible with Capacitor and must be replaced with ${replacement}${
        url ? ' (' + url + ')' : ''
      }`,
      npmInstall(replacement) + ' && ' + npmUninstall(name),
      'Replace Plugin',
      `${name} replaced with ${replacement}`,
      url,
    ).canIgnore();
  }
}

export function incompatiblePlugin(name: string, url?: string): Tip {
  if (exists(name)) {
    const isUrl = url?.startsWith('http');
    const msg = isUrl ? `See ${url}` : url ? url : '';
    const tip = new Tip(
      name,
      `Incompatible with Capacitor. ${msg}`,
      TipType.Error,
      `The plugin ${name} is incompatible with Capacitor. ${msg}`,
      Command.NoOp,
      'OK',
    )
      .canIgnore()
      .setRelatedDependency(name);
    if (isUrl) {
      tip.url = url;
    } else {
      tip.command = Command.NoOp;
      tip.url = `https://www.npmjs.com/package/${name}`;
    }
    return tip;
  }
}

export function reviewPlugin(name: string): Tip {
  if (exists(name)) {
    return new Tip(
      name,
      `Test for Capacitor compatibility.`,
      TipType.Warning,
      `The plugin ${name} requires testing for Capacitor compatibility.`,
    );
  }
}

export function warnIfNotUsing(name: string): Tip {
  if (!allDependencies[name]) {
    return new Tip(name, `package is not using ${name}`);
  }
}

/**
 * Returns a list of all packages used in the project
 * @returns Array
 */
export function getAllPackageNames(): Array<string> {
  return Object.keys(allDependencies);
}
