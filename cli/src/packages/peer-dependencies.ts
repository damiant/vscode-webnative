import { satisfies, gt } from 'semver';
import { commandContext, installForceArgument, npmInstall, PackageManager } from '../build/node-commands';
import { replaceAll } from '../project/utilities-strings';
import { Project } from '../project/project';
import { getNpmInfo } from './npm-info';

export interface PeerReport {
  dependencies: DependencyConflict[];
  incompatible: string[];
  commands: string[];
}

export interface DependencyVersion {
  name: string;
  version: string;
}

export interface DependencyConflict {
  name: string;
  conflict?: DependencyVersion;
}

const frameworkPrefixes = ['@angular/', '@angular-devkit/'];

export type RunCallback = (command: string, folder: string) => Promise<string>;

export async function checkPeerDependencies(
  folder: string,
  project: Project,
  peerDeps: DependencyVersion[],
  ignoreDeps: string[],
  run: RunCallback,
): Promise<PeerReport> {
  if (project.packageManager !== PackageManager.npm) {
    return { dependencies: [], incompatible: [], commands: [] };
  }
  const ignores = mergeIgnoreDeps(ignoreDeps);
  const dependencies = await getDependencyConflicts(folder, peerDeps, ignores, run);
  const conflicts: string[] = [];
  const updates: string[] = [];
  const commands: string[] = [];
  const reportedErrors = new Set<string>();

  for (const dependency of dependencies) {
    if (isFrameworkPackage(dependency.name)) continue;
    const version = await findCompatibleVersion2(dependency, project, run);
    if (version === 'latest' || !version) {
      if (!version && !reportedErrors.has(dependency.name)) {
        reportedErrors.add(dependency.name);
        conflicts.push(dependency.name);
      }
    } else if (!updates.includes(`${dependency.name}@${version}`)) {
      updates.push(`${dependency.name}@${version}`);
    }
  }

  if (updates.length > 0) {
    const ctx = commandContext(project);
    commands.push(npmInstall(updates.join(' '), ctx, '--force'));
  }

  return { dependencies, incompatible: conflicts, commands };
}

function mergeIgnoreDeps(ignoreDeps: string[]): string[] {
  const ignores = [...frameworkPrefixes];
  for (const ignoreDep of ignoreDeps) {
    if (!ignores.includes(ignoreDep)) ignores.push(ignoreDep);
  }
  return ignores;
}

function isFrameworkPackage(name: string): boolean {
  return shouldIgnoreDependency(name, frameworkPrefixes);
}

function shouldIgnoreDependency(name: string, ignoreDeps: string[]): boolean {
  return ignoreDeps.some((ignoreDep) => name.startsWith(ignoreDep));
}

async function getDependencyConflicts(
  folder: string,
  peerDeps: DependencyVersion[],
  ignoreDeps: string[],
  run: RunCallback,
): Promise<DependencyConflict[]> {
  try {
    const list: DependencyConflict[] = [];
    const seen = new Set<string>();
    const data = await run('npm ls --depth=1 --long --json', folder);
    const deps = JSON.parse(data);
    for (const peerDependency of peerDeps) {
      if (shouldIgnoreDependency(peerDependency.name, ignoreDeps)) continue;
      for (const key of Object.keys(deps.dependencies ?? {})) {
        if (shouldIgnoreDependency(key, ignoreDeps)) continue;
        for (const peer of Object.keys(deps.dependencies[key].peerDependencies ?? {})) {
          const versionRange = deps.dependencies[key].peerDependencies[peer];
          if (peer === peerDependency.name && !satisfies(peerDependency.version, cleanRange(versionRange))) {
            const id = `${key}:${peerDependency.name}`;
            if (!seen.has(id)) {
              seen.add(id);
              list.push({ name: key, conflict: peerDependency });
            }
          }
        }
      }
    }
    return list;
  } catch {
    return [];
  }
}

async function getNPMInfoFor(dependency: string, folder: string, run: RunCallback): Promise<any> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${dependency}`);
    const pck = (await response.json()) as Record<string, any>;
    pck.latestVersion = pck['dist-tags']?.latest;
    return pck;
  } catch {
    const data = await run(`npm view ${dependency} --json`, folder);
    const pck = JSON.parse(data);
    pck.latestVersion = pck.version;
    pck.versions = pck.versions ?? {};
    pck.versions[pck.latestVersion] = { peerDependencies: pck.peerDependencies };
    return pck;
  }
}

function cleanRange(range: string): string {
  if (range.includes('&&')) return replaceAll(range, '&&', '');
  return range;
}

function satisfiesPeerVersion(version: string | undefined, range: string): boolean {
  if (!version) return false;
  return satisfies(version, cleanRange(range));
}

export async function findCompatibleVersion2(
  dependency: DependencyConflict,
  project: Project,
  run: RunCallback,
): Promise<string | undefined> {
  if (isFrameworkPackage(dependency.name)) return undefined;

  let best: string | undefined;
  let incompatible = false;
  try {
    const pck = await getNPMInfoFor(dependency.name, project.projectFolder(), run);
    const latestVersion = pck.latestVersion;
    for (const version of Object.keys(pck.versions ?? {})) {
      const peers = pck.versions[version]?.peerDependencies;
      if (!peers) continue;
      for (const peerDependency of Object.keys(peers)) {
        const peerVersion = peers[peerDependency];
        const current = project.analyzer.getPackageVersion(peerDependency);
        let meetsNeeds: boolean;
        if (dependency.conflict) {
          meetsNeeds =
            dependency.conflict.name === peerDependency &&
            satisfiesPeerVersion(dependency.conflict.version, peerVersion);
        } else {
          meetsNeeds = !!current && satisfiesPeerVersion(current.version, peerVersion);
        }
        if (!version.includes('-') && meetsNeeds) {
          if (!best || gt(version, best)) best = version;
        } else if (dependency.conflict) {
          if (dependency.conflict.name === peerDependency && version === latestVersion) incompatible = true;
        } else if (version === latestVersion && !best && current) {
          incompatible = true;
        }
      }
    }
    if (!best) best = incompatible ? 'latest' : latestVersion;
  } catch {
    best = undefined;
  }
  return best;
}

export async function findBestPluginVersion(
  plugin: string,
  project: Project,
  run: RunCallback,
): Promise<string | undefined> {
  const v = await findCompatibleVersion2({ name: plugin }, project, run);
  if (!v || v === 'latest') return v ? plugin : undefined;
  return `${plugin}@${v}`;
}

/** Resolve npm metadata for display (used by plugins info). */
export async function getNpmPackageView(name: string, folder: string, run: RunCallback): Promise<any> {
  try {
    const data = await run(`npm view ${name} --json`, folder);
    return JSON.parse(data);
  } catch {
    const info = await getNpmInfo(name, true);
    return info.name ? info : undefined;
  }
}
