import { coerce } from 'semver';
import { Command, Tip, TipType } from './tip';
import { Project } from './project';
import { getRunOutput, getStringFrom, setAllStringIn, stripJSON, tEnd, tStart } from './utilities';
import { NpmDependency, NpmOutdatedDependency, NpmPackage, PackageType, PackageVersion } from './npm-model';
import { listCommand, outdatedCommand, PackageManager } from './node-commands';
import {
  CapProjectCache,
  LastManifestCheck,
  PackageCacheList,
  PackageCacheModified,
  PackageCacheOutdated,
} from './context-variables';
import { join } from 'path';
import { exState } from './wn-tree-provider';
import { write, writeError, writeWarning } from './logging';
import { fixYarnV1Outdated, fixModernYarnList, fixYarnOutdated, MonoRepoType } from './monorepo';
import { ExtensionContext, window } from 'vscode';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { getVersionsFromPackageLock } from './package-lock';

export interface PluginInformation {
  androidPermissions: Array<string>;
  androidFeatures: Array<string>;
  dependentPlugins: Array<string>;
  hasHooks: boolean;
}

export function clearRefreshCache(context: ExtensionContext) {
  if (context) {
    for (const key of context.workspaceState.keys()) {
      if (key.startsWith(PackageCacheOutdated(undefined))) {
        context.workspaceState.update(key, undefined);
      }
      if (key.startsWith(PackageCacheList(undefined))) {
        context.workspaceState.update(key, undefined);
      }
      if (key.startsWith(CapProjectCache(undefined))) {
        context.workspaceState.update(key, undefined);
      }
      if (key == LastManifestCheck) {
        context.workspaceState.update(key, undefined);
      }
    }
  }

  console.log('Cached data cleared');
}

async function runListPackages(project: Project, folder: string, context: ExtensionContext): Promise<string> {
  const listOutput = getVersionsFromPackageLock(project);
  if (listOutput) {
    return JSON.stringify(listOutput);
  }
  const listCmd = listCommand(project);
  try {
    let data = await getRunOutput(listCmd, folder, undefined, true);
    if (project.isModernYarn()) {
      data = fixModernYarnList(data);
    }
    return data;
  } catch (reason) {
    write(`> ${listCmd}`);
    writeError(reason);
  }
}

export async function processPackages(
  folder: string,
  allDependencies: object,
  devDependencies: object,
  context: ExtensionContext,
  project: Project,
): Promise<any> {
  if (!lstatSync(folder).isDirectory()) {
    return {};
  }

  // npm outdated only shows dependencies and not dev dependencies if the node module isn't installed
  let outdated = '[]';
  let versions = '{}';
  try {
    const packagesModified: Date = project.modified;
    const packageModifiedLast = context.workspaceState.get(PackageCacheModified(project));
    outdated = context.workspaceState.get(PackageCacheOutdated(project));
    versions = context.workspaceState.get(PackageCacheList(project));
    const changed = packagesModified.toUTCString() != packageModifiedLast;
    if (changed) {
      exState.syncDone = [];
    }
    if (changed || !outdated || !versions) {
      const outdatedCmd = outdatedCommand(project);

      const values = await Promise.all([
        getRunOutput(outdatedCmd, folder, undefined, true, true)
          .then((data) => {
            if (project.isYarnV1()) {
              data = fixYarnV1Outdated(data, project.packageManager);
            } else if (project.isModernYarn()) {
              data = fixYarnOutdated(data, project);
            }
            outdated = data;
            context.workspaceState.update(PackageCacheOutdated(project), outdated);
          })
          .catch((reason) => {
            write(`> ${outdatedCmd}`);
            writeError(reason);
          }),
        runListPackages(project, folder, context),
        // getRunOutput(listCmd, folder, undefined, true)
        //   .then((data) => {
        //     if (project.isModernYarn()) {
        //       data = fixModernYarnList(data);
        //     }
        //     versions = data;
        //     context.workspaceState.update(PackageCacheList(project), versions);
        //   })
        //   .catch((reason) => {
        //     write(`> ${listCmd}`);
        //     writeError(reason);
        //   }),
      ]);
      versions = values[1];
      context.workspaceState.update(PackageCacheList(project), versions);

      context.workspaceState.update(PackageCacheModified(project), packagesModified.toUTCString());
    } else {
      // Use the cached value
      // But also get a copy of the latest packages for updating later
      const itsAGoodTime = false;
      if (itsAGoodTime) {
        getRunOutput(outdatedCommand(project), folder, undefined, true).then((outdatedFresh) => {
          context.workspaceState.update(PackageCacheOutdated(project), outdatedFresh);
          context.workspaceState.update(PackageCacheModified(project), packagesModified.toUTCString());
        });

        getRunOutput(listCommand(project), folder, undefined, true).then((versionsFresh) => {
          context.workspaceState.update(PackageCacheList(project), versionsFresh);
        });
      }
    }
  } catch (err) {
    outdated = '[]';
    versions = '{}';
    if (err && err.includes('401')) {
      window.showInformationMessage(
        `Unable to run '${outdatedCommand(project)}' due to authentication error. Check .npmrc`,
        'OK',
      );
    }
    if (project.isModernYarn()) {
      writeWarning(
        `Modern Yarn does not have a command to review outdated package versions. Most functionality of this extension will be disabled.`,
      );
    } else {
      writeError(`Unable to run '${outdatedCommand(project)}'. Try reinstalling node modules.`);
      console.error(err);
    }
  }

  // outdated is an array with:
  //  "@ionic-native/location-accuracy": { "wanted": "5.36.0", "latest": "5.36.0", "dependent": "cordova-old" }

  tStart('processDependencies');
  const packages = processDependencies(
    allDependencies,
    getOutdatedData(outdated),
    devDependencies,
    getListData(versions),
  );
  tEnd('processDependencies');
  tStart('inspectPackages');
  inspectPackages(project.projectFolder() ? project.projectFolder() : folder, packages);
  tEnd('inspectPackages');
  return packages;
}

function getOutdatedData(outdated: string): any {
  try {
    return JSON.parse(stripJSON(outdated, '{'));
  } catch {
    return [];
  }
}

function getListData(list: string): NpmPackage {
  try {
    return JSON.parse(list);
  } catch {
    return { name: undefined, dependencies: undefined, version: undefined };
  }
}

export function reviewPackages(packages: object, project: Project) {
  if (!packages || Object.keys(packages).length == 0) return;

  listPackages(project, 'Packages', `Your project relies on these packages.`, packages, [PackageType.Dependency]);

  listPackages(
    project,
    `Plugins`,
    `Your project relies on these Capacitor and Cordova plugins. Consider plugins which have not had updates in more than a year to be a candidate for replacement in favor of a plugin that is actively maintained.`,
    packages,
    [PackageType.CordovaPlugin, PackageType.CapacitorPlugin],
    TipType.Capacitor,
  );

  // listPackages(
  //   project,
  //   `Capacitor Plugins`,
  //   `Your project relies on these Capacitor plugins. Consider plugins which have not had updates in more than a year to be a candidate for replacement in favor of a plugin that is actively maintained.`,
  //   packages,
  //   [PackageType.CapacitorPlugin],
  //   TipType.Capacitor
  // );
}

// List any plugins that use Cordova Hooks as potential issue
export function reviewPluginsWithHooks(packages: object): Tip[] {
  const tips = [];
  // List of packages that don't need to be reported to the user because they would be dropped in a Capacitor migration
  // Using a Set for O(1) lookups instead of an array with O(n) includes() method
  const dontReportSet = new Set([
    'cordova-plugin-add-swift-support',
    'cordova-plugin-androidx',
    'cordova-plugin-androidx-adapter',
    'cordova-plugin-ionic', // Works for Capacitor
    'phonegap-plugin-push', // This has a hook for browser which is not applicable
    'cordova-plugin-push', // This has a hook for browser which is not applicable
  ]);

  if (Object.keys(packages).length == 0) return;
  for (const library of Object.keys(packages)) {
    if (
      packages[library].plugin &&
      packages[library].plugin.hasHooks &&
      !dontReportSet.has(library) && // O(1) lookup operation with Set
      !library.startsWith('@ionic-enterprise')
    ) {
      let msg = 'contains Cordova hooks that may require manual migration to use with Capacitor.';
      if (library == 'branch-cordova-sdk') {
        msg = ' can be replaced with capacitor-branch-deep-links which is compatible with Capacitor.';
      }
      tips.push(new Tip(library, msg, TipType.Warning, `${library} ${msg}`, Command.NoOp, 'OK'));
    } else {
      if (packages[library].version == PackageVersion.Custom) {
        tips.push(
          new Tip(
            library,
            `Review ${library}`,
            TipType.Warning,
            `${library} cannot be inspected to check for Capacitor compatibility as it is a custom plugin or is a remote dependency. You will need to manually test this plugin after migration to Capacitor - the good news is that most plugins will work.`,
            Command.NoOp,
            'OK',
          ),
        );
        //
      }
    }
  }
  return tips;
}

function dateDiff(d1: Date, d2: Date): string {
  let months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  months = months <= 0 ? 0 : months;
  let updated = `${months} months`;
  if (months == 0) {
    updated = 'Recent';
  }
  if (months >= 12) {
    updated = `${Math.trunc(months / 12)} years`;
  }
  return updated;
}

function olderThan(d1: Date, d2: Date, days: number): boolean {
  const diff = d2.getTime() - d1.getTime();
  return diff / (1000 * 3600 * 24) > days;
}

function markIfPlugin(folder: string): boolean {
  const pkg = join(folder, 'package.json');
  if (existsSync(pkg)) {
    try {
      const packages = JSON.parse(readFileSync(pkg, 'utf8'));
      if (packages.capacitor?.ios || packages.capacitor?.android) {
        return true;
      }
    } catch {
      console.warn(`Unable to parse ${pkg}`);
      return false;
    }
  }
  return false;
}

function markDeprecated(lockFile: string, packages) {
  const txt = readFileSync(lockFile, { encoding: 'utf8' });
  const data = JSON.parse(txt);
  if (!data.packages) {
    return;
  }
  for (const library of Object.keys(data.packages)) {
    const warning = data.packages[library].deprecated;
    if (warning) {
      const l = library.replace('node_modules/', '');
      if (packages[l]) {
        packages[l].deprecated = warning;
      }
    }
  }
}

function inspectPackages(folder: string, packages) {
  // Use package-lock.json for deprecated packages
  const lockFile = join(folder, 'package-lock.json');
  if (existsSync(lockFile)) {
    markDeprecated(lockFile, packages);
  }

  // plugins
  for (const library of Object.keys(packages)) {
    const plugin = join(folder, 'node_modules', library, 'plugin.xml');
    if (existsSync(plugin)) {
      // Cordova based
      const content = readFileSync(plugin, 'utf8');
      packages[library].depType = PackageType.CordovaPlugin;
      packages[library].plugin = processPlugin(content);
    }

    const nmFolder = folder + '/node_modules/' + library;

    let isPlugin = false;

    if (existsSync(nmFolder)) {
      isPlugin = markIfPlugin(nmFolder);

      readdirSync(nmFolder, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => {
          const hasPlugin = markIfPlugin(join(nmFolder, dirent.name));
          if (hasPlugin) {
            isPlugin = true;
          }
        });
    }

    // Look for capacitor only as well
    if (isPlugin) {
      packages[library].depType = PackageType.CapacitorPlugin;
      if (!packages[library].plugin) {
        packages[library].plugin = processPlugin('');
      }
    }
  }

  // Whether to run without inspecting every package for descriptions, updates etc
  const quick = true;

  for (const library of Object.keys(packages)) {
    // Runs a command like this to find last update and other info:
    // npm show cordova-plugin-app-version --json
    try {
      if (packages[library].version == PackageVersion.Custom) {
        packages[library].updated = PackageVersion.Unknown;
        packages[library].description = '';
        packages[library].isOld = true;
      } else {
        if (!quick) {
          const json = execSync(`npm show ${library} --json`, { cwd: folder }).toString();
          const info = JSON.parse(json);

          const modified = new Date(info.time.modified);
          packages[library].updated = dateDiff(modified, new Date(Date.now())); // "2020-12-10T08:56:06.108Z" -> 6 Months
          packages[library].isOld = olderThan(modified, new Date(Date.now()), 365);
          packages[library].url = info.repository?.url; // eg git+https://github.com/sampart/cordova-plugin-app-version.git
          packages[library].description = info.description;
          packages[library].latest = info.version;
        }
      }
    } catch (err) {
      console.log(`Unable to find latest version of ${library} on npm`, err);
      packages[library].updated = PackageVersion.Unknown;
      packages[library].description = '';
      packages[library].isOld = true;
    }
  }
}

function processPlugin(content: string): PluginInformation {
  const result = { androidPermissions: [], androidFeatures: [], dependentPlugins: [], hasHooks: false };
  if (content == '') {
    return result;
  }
  content = setAllStringIn(content, '<platform name="wp8">', '</platform>', '');
  content = setAllStringIn(content, '<platform name="blackberry10">', '</platform>', '');

  // Inspect plugin.xml in content and return plugin information { androidPermissions: ['android.permission.INTERNET']}
  for (const permission of findAll(content, '<uses-permission android:name="', '"')) {
    result.androidPermissions.push(permission);
  }
  for (const feature of findAll(content, '<uses-feature android:name="', '"')) {
    result.androidFeatures.push(feature);
  }
  for (const dependency of findAll(content, '<dependency id="', '"')) {
    result.dependentPlugins.push(dependency);
  }
  for (const hook of findAll(content, '<hook', '"')) {
    result.hasHooks = true;
  }
  return result;
}

function findAll(content, search: string, endsearch: string): Array<any> {
  const list = Array.from(content.matchAll(new RegExp(search + '(.*?)' + endsearch, 'g')));
  const result = [];
  if (!list) return result;
  for (const item of list) {
    result.push(item[1]);
  }
  return result;
}

function listPackages(
  project: Project,
  title: string,
  description: string,
  packages: object,
  depTypes: Array<string>,
  tipType?: TipType,
) {
  const count = Object.keys(packages).filter((library) => {
    return depTypes.includes(packages[library].depType);
  }).length;
  if (count == 0) return;

  if (title) {
    project.setGroup(`${count} ${title}`, description, tipType, undefined, 'packages');
  }

  let lastScope: string;
  for (const library of Object.keys(packages).sort()) {
    if (depTypes.includes(packages[library].depType)) {
      let v = `${packages[library].version}`;
      let latest;
      if (v == 'null') v = PackageVersion.Unknown;

      let url = packages[library].url;
      if (url) {
        url = url.replace('git+', '');
      }

      const scope = getStringFrom(library, '@', '/');
      if (scope != lastScope) {
        if (scope) {
          latest = undefined;
          if (scope == 'angular') {
            //
            latest = packages['@angular/core']?.latest;
          }
          project.addSubGroup(scope, latest);
          lastScope = scope;
        } else {
          project.clearSubgroup();
        }
      }
      let libraryTitle = library;
      const type = TipType.None;
      if (scope) {
        libraryTitle = library.substring(scope.length + 2);
      }
      if (v != packages[library].latest && packages[library].latest !== PackageVersion.Unknown) {
        project.upgrade(library, libraryTitle, `${v} → ${packages[library].latest}`, v, packages[library].latest, type);
      } else {
        project.package(library, libraryTitle, `${v}`, type);
      }
    }
  }
  project.clearSubgroup();
}

function processDependencies(allDependencies: object, outdated: object, devDependencies: object, list: NpmPackage) {
  const packages = {};
  for (const library of Object.keys(allDependencies)) {
    const dep: NpmDependency = list.dependencies ? list.dependencies[library] : undefined;
    let version = dep ? dep.version : `${coerce(allDependencies[library])}`;
    if (allDependencies[library]?.startsWith('git') || allDependencies[library]?.startsWith('file')) {
      version = PackageVersion.Custom;
    }
    if (allDependencies[library]?.startsWith('catalog:') || allDependencies[library]?.startsWith('workspace:')) {
      version = PackageVersion.Unknown;
    }

    const recent: NpmOutdatedDependency = outdated[library];
    const wanted = recent?.wanted;
    const latest = recent?.latest == undefined ? version : recent.latest;
    const current = recent?.current;

    const isDev = devDependencies && library in devDependencies;

    packages[library] = {
      version: version,
      current: current,
      wanted: wanted,
      latest: latest,
      isDevDependency: isDev,
      depType: PackageType.Dependency,
    };

    // Set to version found in package lock
    allDependencies[library] = version;
  }
  return packages;
}
