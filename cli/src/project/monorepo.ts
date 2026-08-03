import { getNpmWorkspaceProjects } from './monorepo-npm';
import { getNXProjects } from './monorepo-nx';
import { Project } from './project';
import { getPnpmWorkspaces } from './monorepo-pnpm';
import { PackageManager } from '../build/node-commands';
import { getLernaWorkspaces } from './monorepo-lerna';
import { join } from 'path';
import { NpmDependency, NpmOutdatedDependency } from './npm-model';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { webProjectPackages } from './web-packages';

export interface MonoRepoProject {
  name: string;
  folder: string;
  localPackageJson?: boolean;
  nodeModulesAtRoot?: boolean;
  isIonic?: boolean;
  isNXStandalone?: boolean;
}

interface MonoFolder {
  name: string;
  packageJson: string;
  path: string;
}

export enum MonoRepoType {
  none,
  nx,
  turboRepo,
  pnpm,
  lerna,
  npm,
  yarn,
  folder,
  bun,
}

export type FrameworkType = 'angular' | 'react' | 'vue' | 'react-vite' | 'vue-vite' | 'angular-standalone' | 'unknown';

/**
 * Check to see if this is a monorepo and what type.
 */
export async function checkForMonoRepo(project: Project, selectedProject?: string): Promise<void> {
  project.repoType = MonoRepoType.none;
  let projects: Array<MonoRepoProject> | undefined;
  const pw = join(project.folder, 'pnpm-workspace.yaml');
  const isPnpm = existsSync(pw);

  if (project.analyzer.exists('@nrwl/cli') || existsSync(join(project.folder, 'nx.json'))) {
    project.repoType = MonoRepoType.nx;
    projects = await getNXProjects(project);
    if (!projects) {
      projects = [];
    }
    if (projects.length == 0) {
      projects.push({ name: 'app', folder: '', nodeModulesAtRoot: true, isNXStandalone: true });
    }
  } else if (project.workspaces?.length > 0 && !isPnpm) {
    projects = getNpmWorkspaceProjects(project);
    project.repoType = MonoRepoType.npm;
    if (project.packageManager == PackageManager.yarn) {
      project.repoType = MonoRepoType.yarn;
    }
    if (project.packageManager == PackageManager.bun) {
      project.repoType = MonoRepoType.bun;
    }
  } else {
    projects = getFolderBasedProjects(project);

    if (projects?.length > 0 && !isPnpm) {
      project.repoType = MonoRepoType.folder;
    } else {
      if (isPnpm) {
        project.repoType = MonoRepoType.pnpm;
        projects = getPnpmWorkspaces(project);
      } else {
        const lerna = join(project.folder, 'lerna.json');
        if (existsSync(lerna)) {
          project.repoType = MonoRepoType.lerna;
          projects = getLernaWorkspaces(project);
        }
      }
    }
  }

  project.monoRepoProjects = projects ?? [];

  if (projects?.length > 0) {
    const found = selectedProject ? projects.find((p) => p.name == selectedProject) : undefined;
    project.monoRepo = found ? found : projects[0];

    if (!project.monoRepo) {
      project.repoType = MonoRepoType.none;
      console.error('No mono repo projects found.');
    } else {
      project.monoRepo.localPackageJson = [
        MonoRepoType.npm,
        MonoRepoType.bun,
        MonoRepoType.folder,
        MonoRepoType.yarn,
        MonoRepoType.lerna,
        MonoRepoType.pnpm,
      ].includes(project.repoType);

      project.monoRepo.nodeModulesAtRoot = [
        MonoRepoType.npm,
        MonoRepoType.bun,
        MonoRepoType.nx,
        MonoRepoType.yarn,
      ].includes(project.repoType);
    }
  }
}

export function isFolderBasedMonoRepo(rootFolder: string): Array<MonoFolder> {
  const folders = readdirSync(rootFolder, { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) => dir.name);
  const result: MonoFolder[] = [];
  for (const folder of folders) {
    const packageJson = join(rootFolder, folder, 'package.json');
    if (existsSync(packageJson)) {
      result.push({ name: folder, packageJson: packageJson, path: join(rootFolder, folder) });
    }
  }
  if (result.length == 0) {
    const configFile = join(rootFolder, 'ionic.config.json');
    if (existsSync(configFile)) {
      const json: any = readFileSync(configFile);
      const data: any = JSON.parse(json);
      if (data.projects) {
        for (const key of Object.keys(data.projects)) {
          const ionicProject = data.projects[key];
          if (ionicProject.root) {
            const packageJson = join(rootFolder, ionicProject.root, 'package.json');
            if (existsSync(packageJson)) {
              result.push({
                name: ionicProject.name,
                packageJson: packageJson,
                path: join(rootFolder, ionicProject.root),
              });
            }
          } else {
            const packageJson = join(rootFolder, 'package.json');
            if (existsSync(packageJson)) {
              result.push({ name: ionicProject.name, packageJson: packageJson, path: join(rootFolder) });
            }
          }
        }
      }
    }
  }
  return result;
}

export function getMonoRepoFolder(name: string, defaultFolder: string, projects: MonoRepoProject[]): string {
  const found = projects.find((repo) => repo.name == name);
  if (!found) {
    return defaultFolder;
  }
  return found?.folder;
}

export function getPackageJSONFilename(
  rootFolder: string,
  repoType: MonoRepoType,
  workspaceName: string,
  projects: MonoRepoProject[],
): string {
  return join(getLocalFolder(rootFolder, repoType, workspaceName, projects), 'package.json');
}

export function getLocalFolder(
  rootFolder: string,
  repoType: MonoRepoType,
  workspaceName: string,
  projects: MonoRepoProject[],
): string {
  switch (repoType) {
    case MonoRepoType.npm:
    case MonoRepoType.bun:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.folder:
      return getMonoRepoFolder(workspaceName, rootFolder, projects);
  }
  return rootFolder;
}

function getFolderBasedProjects(prj: Project): Array<MonoRepoProject> {
  const projects = isFolderBasedMonoRepo(prj.folder);
  let result: Array<MonoRepoProject> = [];
  let likelyFolderBasedMonoRepo = false;
  let exampleFolder = '';

  for (const project of projects) {
    const folderType = checkFolder(project.packageJson);
    if (folderType != FolderType.unknown) {
      result.push({ name: project.name, folder: project.path, isIonic: folderType == FolderType.isKnownWebProject });
    }
    if (folderType == FolderType.isKnownWebProject) {
      exampleFolder = project.path;
      likelyFolderBasedMonoRepo = true;
    }
  }

  let subFolderWarning = false;

  const rootFolderType = checkFolder(join(prj.folder, 'package.json'));
  if (rootFolderType == FolderType.isKnownWebProject) {
    if (projects.length == 0 || prj.folder == projects[0].path) {
      // Sub folder is the root folder (eg ionic multi-app without a root)
    } else {
      if (!subFolderWarning && exampleFolder != '') {
        console.error(
          `This folder has Capacitor/Ionic dependencies but there are subfolders that do too which will be ignored (eg ${exampleFolder})`,
        );
        subFolderWarning = true;
      }

      return [];
    }
  }
  result = result.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));
  if (rootFolderType == FolderType.hasDependencies) {
    result.unshift({ name: 'root', folder: prj.folder, isIonic: false });
  }
  return result;
}

export function fixYarnV1Outdated(data: string, packageManager: PackageManager): string {
  if (packageManager !== PackageManager.yarn) {
    return data;
  }
  const tmp = data.split('\n');
  if (tmp.length > 1) {
    return parseYarnFormat(tmp[1]);
  }
  return data;
}

export function fixYarnOutdated(data: string): string | undefined {
  if (data.startsWith(`Usage Error: Couldn't find a script named "outdated"`)) {
    return undefined;
  }
  const items = JSON.parse(data);
  const result: Record<string, NpmOutdatedDependency> = {};
  for (const item of items) {
    const dep: NpmOutdatedDependency = {
      current: item.current,
      wanted: item.latest,
      latest: item.latest,
      dependent: '',
      location: '',
    };
    result[item.name] = dep;
  }
  return JSON.stringify(result);
}

export function fixModernYarnList(data: string): string {
  const items = data.split('\n');
  if (items.length > 1) {
    const result: { dependencies: Record<string, NpmDependency> } = { dependencies: {} };
    for (const item of items) {
      if (item === '') break;

      const info = JSON.parse(item);
      const ldx = info.value.lastIndexOf('@');
      const name = info.value.substring(0, ldx);
      const dep: NpmDependency = {
        version: info.children.Version,
        resolved: '',
      };
      result.dependencies[name] = dep;
    }
    return JSON.stringify(result);
  }
  return data;
}

function parseYarnFormat(data: string): string {
  try {
    const out = JSON.parse(data);
    const result: Record<string, NpmOutdatedDependency> = {};
    if (out.data.body) {
      for (const item of out.data.body) {
        const dep: NpmOutdatedDependency = {
          current: item[1],
          wanted: item[2],
          latest: item[3],
          dependent: '',
          location: '',
        };
        result[item[0]] = dep;
      }
    }
    return JSON.stringify(result);
  } catch {
    return data;
  }
}

enum FolderType {
  hasDependencies,
  isKnownWebProject,
  unknown,
}

function checkFolder(filename: string): FolderType {
  try {
    if (!existsSync(filename)) {
      return FolderType.unknown;
    }
    const pck = JSON.parse(readFileSync(filename, 'utf8'));
    let isKnownWebProject = false;

    const packages = [...webProjectPackages, '@capacitor/core', '@capacitor/ios', '@capacitor/android'];
    for (const pkg of packages) {
      if (pck.dependencies?.[pkg]) {
        isKnownWebProject = true;
        break;
      }
      if (pck.devDependencies?.[pkg]) {
        isKnownWebProject = true;
        break;
      }
    }

    return isKnownWebProject
      ? FolderType.isKnownWebProject
      : pck.dependencies || pck.devDependencies
        ? FolderType.hasDependencies
        : FolderType.unknown;
  } catch {
    return FolderType.unknown;
  }
}
