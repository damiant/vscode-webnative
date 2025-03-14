import { ionicState } from './wn-tree-provider';
import { satisfies, gt } from 'semver';
import { write, writeError, writeWarning } from './logging';
import { PackageManager, npmInstall } from './node-commands';
import { getRunOutput, httpRequest, replaceAll } from './utilities';
import { getPackageVersion } from './analyzer';

export interface PeerReport {
  // Dependencies that do not meet peer dependency requirements
  dependencies: DependencyConflict[];
  // Dependencies that do not have a version that can be updated to
  incompatible: string[];

  // Set of command to run to upgrade dependendencies that do not meet peer deps
  commands: string[];
}

export interface DependencyVersion {
  name: string;
  version: string;
}

export interface DependencyConflict {
  name: string;
  conflict: DependencyVersion;
}

/**
 * Check project for dependencies that do not meet peer dependency requirements
 * @param {string} peerDependency (eg @capacitor/core)
 * @param {string} minVersion (eg 5.0.0)
 * @returns {Promise<PeerReport>}
 */
export async function checkPeerDependencies(
  folder: string,
  peerDeps: DependencyVersion[],
  ignoreDeps: string[],
): Promise<PeerReport> {
  if (ionicState.packageManager != PackageManager.npm) return { dependencies: [], incompatible: [], commands: [] };
  const dependencies = await getDependencyConflicts(folder, peerDeps, ignoreDeps);
  const conflicts = [];
  const updates: string[] = [];
  const commands = [];
  for (const dependency of dependencies) {
    const version = await findCompatibleVersion2(dependency);
    if (version == 'latest') {
      conflicts.push(dependency);
    } else {
      const v = version ?? 'unsure';
      write(`${dependency.name} will be updated to ${v}`);
      const cmd = `${dependency.name}@${v}`;
      if (updates.indexOf(cmd) == -1) {
        updates.push(cmd);
      }
    }
  }

  if (updates.length > 0) {
    commands.push(npmInstall(updates.join(' '), '--force'));
  }

  return { dependencies, incompatible: conflicts, commands };
}

async function getDependencyConflicts(
  folder: string,
  peerDeps: DependencyVersion[],
  ignoreDeps: string[],
): Promise<DependencyConflict[]> {
  try {
    const list: DependencyConflict[] = [];
    const data = await getRunOutput(`npm ls --depth=1 --long --json`, folder, undefined, true, true);
    const deps = JSON.parse(data);
    for (const peerDependency of peerDeps) {
      for (const key of Object.keys(deps.dependencies)) {
        for (const peer of Object.keys(deps.dependencies[key].peerDependencies)) {
          const versionRange = deps.dependencies[key].peerDependencies[peer];
          if (peer == peerDependency.name) {
            if (!satisfies(peerDependency.version, cleanRange(versionRange))) {
              // Migration will update capacitor plugins so leave them out
              let ignore = false;
              for (const ignoreDep of ignoreDeps) {
                if (key.startsWith(ignoreDep)) {
                  ignore = true;
                }
              }
              if (!ignore) {
                list.push({ name: key, conflict: peerDependency });
              }
            }
          }
        }
      }
    }
    return list;
  } catch (error) {
    writeWarning(`Unable to check for dependencies that may need updating after migration.`);
    return [];
  }
}

async function getNPMInfoFor(dependency: string): Promise<any> {
  try {
    const pck = (await httpRequest('GET', 'registry.npmjs.org', `/${dependency}`)) as any;
    pck.latestVersion = pck['dist-tags']?.latest;
    return pck;
  } catch (error) {
    // This can happen if the package is not public
    const data = await getRunOutput(`npm view ${dependency} --json`, ionicState.rootFolder, undefined, true);
    const pck = JSON.parse(data);
    pck.latestVersion = pck.version;
    pck.versions[pck.latestVersion] = { peerDependencies: pck.peerDependencies };

    // NOTE: We're only looking at the latest version in this situation. This means that if your
    // project is 2 versions behind on Capacitor that it wouldnt find the right version
    return pck;
  }
}

// The semver satisfies function chokes on "> 1.0.0 && < 2.0.0" and this will return "> 1.0.0 < 2.0.0"
function cleanRange(range: string): string {
  if (range.includes('&&')) {
    return replaceAll(range, '&&', '');
  }
  return range;
}

/**
 * Finds the latest release version of the plugin that is compatible with peer dependencies.
 * If hasPeer is supplied then it will look for a version that passes with that peer and version
 *
 */
export async function findCompatibleVersion2(dependency: DependencyConflict): Promise<string> {
  let best: string;
  let incompatible = false;
  try {
    const pck = await getNPMInfoFor(dependency.name);
    const latestVersion = pck.latestVersion;
    for (const version of Object.keys(pck.versions)) {
      if (pck.versions[version].peerDependencies) {
        for (const peerDependency of Object.keys(pck.versions[version].peerDependencies)) {
          const peerVersion = pck.versions[version].peerDependencies[peerDependency];
          const current = getPackageVersion(peerDependency);
          let meetsNeeds = satisfies(current.version, cleanRange(peerVersion));

          if (dependency.conflict) {
            if (dependency.conflict.name == peerDependency) {
              meetsNeeds = satisfies(dependency.conflict.version, cleanRange(peerVersion));
            } else {
              meetsNeeds = false;
            }
          }
          // Is it a real version (not nightly etc) and meets version and we have the package
          if (!version.includes('-') && meetsNeeds) {
            if (!best || gt(version, best)) {
              best = version;
            }
          } else {
            if (dependency.conflict) {
              if (dependency.conflict.name == peerDependency && version == latestVersion) {
                incompatible = true;
                if (!best) {
                  writeError(
                    `Your version of ${dependency.name} is not compatible with ${peerDependency} ${dependency.conflict.version}.`,
                  );

                  if (pck.bugs?.url) {
                    writeWarning(`Recommendation: File an issue with the plugin author at: ${pck.bugs.url}`);
                  }
                }
              }
            } else {
              if (version == latestVersion && !best && current) {
                writeWarning(`${dependency.name} requires ${peerDependency} ${peerVersion} but you have ${current}`);
                incompatible = true;
              }
            }
          }
        }
      }
    }
    if (!best) {
      best = incompatible ? 'latest' : latestVersion;
    }
  } catch (error) {
    writeError(`Unable to search for a version of ${dependency.name} that works in your project`);
    console.error(error);
    best = undefined;
  }
  return best;
}
