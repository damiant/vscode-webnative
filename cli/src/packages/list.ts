import { coerce } from 'semver';
import { fixYarnV1Outdated } from '../project/monorepo';
import { NpmOutdatedDependency } from '../project/npm-model';
import { PackageType } from '../project/npm-model';
import { Project } from '../project/project';
import { listCommand, outdatedCommand } from '../build/node-commands';
import { stripJsonPrefix } from '../commands/helpers';

export interface ListedPackage {
  name: string;
  current: string;
  wanted?: string;
  latest?: string;
  type: 'dependency' | 'devDependency';
  deprecated?: boolean;
  depType?: string;
}

export interface ListedPlugin extends ListedPackage {
  ios?: boolean;
  android?: boolean;
}

export type RunCallback = (command: string, folder: string) => Promise<string>;

export async function listPackages(
  project: Project,
  run: RunCallback,
  options: { outdated?: boolean; plugins?: boolean } = {},
): Promise<{ packages: ListedPackage[]; plugins: ListedPlugin[] }> {
  const folder = project.projectFolder();
  const deps = project.analyzer.getAllDependencies();
  const devDeps = project.analyzer.getPackageFile().devDependencies ?? {};
  const packages: ListedPackage[] = [];
  const plugins: ListedPlugin[] = [];

  let outdated: Record<string, NpmOutdatedDependency> = {};
  if (options.outdated) {
    outdated = await fetchOutdated(project, folder, run);
  }

  for (const name of Object.keys(deps).sort()) {
    const current = project.analyzer.getPackageVersion(name)?.version ?? deps[name];
    const recent = outdated[name];
    const entry: ListedPackage = {
      name,
      current: recent?.current ?? `${current}`,
      wanted: recent?.wanted,
      latest: recent?.latest,
      type: name in devDeps ? 'devDependency' : 'dependency',
      depType: classifyDepType(name, project),
    };
    if (options.plugins && isPlugin(name, project)) {
      plugins.push({
        ...entry,
        ios: name.startsWith('@capacitor/') || name.includes('cordova'),
        android: name.startsWith('@capacitor/') || name.includes('cordova'),
      });
    } else {
      packages.push(entry);
    }
  }

  return { packages, plugins };
}

async function fetchOutdated(
  project: Project,
  folder: string,
  run: RunCallback,
): Promise<Record<string, NpmOutdatedDependency>> {
  try {
    let data = await run(outdatedCommand(project), folder);
    if (project.isYarnV1()) data = fixYarnV1Outdated(data, project.packageManager);
    return JSON.parse(stripJsonPrefix(data, '{'));
  } catch {
    return {};
  }
}

function classifyDepType(name: string, project: Project): string {
  if (name.startsWith('@capacitor/') && !['@capacitor/core', '@capacitor/cli'].includes(name)) {
    return PackageType.CapacitorPlugin;
  }
  if (project.isCordova && (name.startsWith('cordova-') || name.startsWith('@ionic-native/'))) {
    return PackageType.CordovaPlugin;
  }
  return PackageType.Dependency;
}

function isPlugin(name: string, project: Project): boolean {
  const type = classifyDepType(name, project);
  return type === PackageType.CapacitorPlugin || type === PackageType.CordovaPlugin;
}

export function isOutdated(entry: ListedPackage): boolean {
  if (!entry.wanted && !entry.latest) return false;
  const current = coerce(entry.current);
  const wanted = coerce(entry.wanted ?? entry.latest);
  if (!current || !wanted) return false;
  return wanted.major > current.major || wanted.minor > current.minor || wanted.patch > current.patch;
}
