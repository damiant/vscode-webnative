import { Analyzer } from './analyzer';
import { checkForMonoRepo, FrameworkType, MonoRepoProject, MonoRepoType } from './monorepo';
import { CapacitorPlatform } from './capacitor-platform';
import { PackageManager } from '../build/node-commands';
import { getCapacitorConfigDistFolder } from './capacitor-config-file';
import { join } from 'path';
import { existsSync } from 'fs';
import { getIonicConfig } from './ionic-config';

/** Minimal project surface for command builders that only need folder resolution. */
export interface ProjectLike {
  repoType: MonoRepoType;
  projectFolder(): string;
}

export class Project implements ProjectLike {
  name: string;
  type: string = undefined;
  isCapacitor: boolean;
  isCordova: boolean;
  workspaces: Array<string>;
  folder: string;
  modified: Date;
  repoType: MonoRepoType;
  packageManager: PackageManager;
  frameworkType: FrameworkType;
  monoRepo: MonoRepoProject;
  monoRepoProjects: MonoRepoProject[] = [];
  isCapacitorPlugin: boolean;
  yarnVersion: string;
  analyzer: Analyzer = new Analyzer();

  constructor(_name: string) {
    this.name = _name;
    this.isCapacitorPlugin = false;
  }

  public getNodeModulesFolder(): string {
    let nmf = join(this.folder, 'node_modules');
    if (this.monoRepo && !this.monoRepo?.nodeModulesAtRoot) {
      nmf = join(this.monoRepo.folder, 'node_modules');
    }
    return nmf;
  }

  public hasCapacitorProject(platform: CapacitorPlatform): boolean {
    return this.analyzer.exists(`@capacitor/${platform}`) && existsSync(join(this.projectFolder(), platform));
  }

  public hasACapacitorProject(): boolean {
    return this.hasCapacitorProject(CapacitorPlatform.ios) || this.hasCapacitorProject(CapacitorPlatform.android);
  }

  public isYarnV1(): boolean {
    return this.yarnVersion?.startsWith('1.');
  }

  public projectFolder(): string {
    if (this.repoType == undefined) {
      return this.folder;
    }
    switch (this.repoType) {
      case MonoRepoType.none:
        return this.folder;
      case MonoRepoType.bun:
      case MonoRepoType.npm:
      case MonoRepoType.yarn:
      case MonoRepoType.lerna:
      case MonoRepoType.pnpm:
      case MonoRepoType.folder:
        return this.monoRepo ? this.monoRepo.folder : this.folder;
      case MonoRepoType.nx:
        return this.monoRepo ? this.monoRepo.folder : this.folder;
      default:
        return join(this.folder, this.monoRepo.folder);
    }
  }

  public isModernYarn(): boolean {
    const result = !!this.yarnVersion;
    if (result && this.yarnVersion.startsWith('pnpm@')) {
      return false;
    }
    if (this.isYarnV1()) {
      return false;
    }
    if (!result && this.packageManager == PackageManager.yarn) {
      return true;
    }
    return result;
  }

  public fileExists(filename: string): boolean {
    return existsSync(join(this.projectFolder(), filename));
  }

  public getDistFolder(): string {
    return getCapacitorConfigDistFolder(this.projectFolder());
  }
}

export function guessFramework(project: Project): void {
  const config = getIonicConfig(project.projectFolder());
  project.frameworkType = config.type as FrameworkType;
  if (project.frameworkType && project.frameworkType !== 'unknown') return;
  if (project.analyzer.exists('@vue/cli-service')) {
    project.frameworkType = 'vue';
  } else if (project.analyzer.exists('@angular/core')) {
    project.frameworkType = 'angular';
  } else if (project.analyzer.exists('@angular/cli')) {
    project.frameworkType = 'angular-standalone';
  } else if (project.analyzer.exists('@ionic/angular')) {
    project.frameworkType = 'angular-standalone';
  } else if (project.analyzer.exists('react-scripts')) {
    project.frameworkType = 'react';
  } else if (project.analyzer.exists('vite') && !project.analyzer.exists('@remix-run/react')) {
    if (project.analyzer.exists('react')) {
      project.frameworkType = 'react-vite';
    }
    if (project.analyzer.exists('vue')) {
      project.frameworkType = 'vue-vite';
    }
  }
}

export function getPackageManager(folder: string, monoRepoType?: MonoRepoType): PackageManager {
  const yarnLock = join(folder, 'yarn.lock');
  const pnpmLock = join(folder, 'pnpm-lock.yaml');
  const bunLockb = join(folder, 'bun.lockb');
  const bunLock = join(folder, 'bun.lock');
  if (existsSync(yarnLock)) {
    return PackageManager.yarn;
  } else if (existsSync(pnpmLock) || monoRepoType == MonoRepoType.pnpm) {
    return PackageManager.pnpm;
  } else if (existsSync(bunLockb)) {
    return PackageManager.bun;
  } else if (existsSync(bunLock)) {
    return PackageManager.bun;
  }

  if (monoRepoType == MonoRepoType.yarn) {
    const packageLock = join(folder, 'package-lock.json');
    if (!existsSync(packageLock)) {
      return PackageManager.yarn;
    }
  }
  if (monoRepoType == MonoRepoType.bun) {
    const packageLock = join(folder, 'package-lock.json');
    if (!existsSync(packageLock)) {
      return PackageManager.bun;
    }
  }
  return PackageManager.npm;
}
