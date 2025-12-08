/**
 * Project class for MCP server
 * Adapted from ../../../src/project.ts
 */

import { existsSync } from 'fs';
import { join } from 'path';

import { exists, getAllDependencies, loadPackageJson } from './analyzer.js';
import {
  detectFrameworkType,
  detectMonoRepoType,
  FrameworkType,
  getFolderBasedProjects,
  getNpmWorkspaceProjects,
  MonoRepoProject,
  MonoRepoType,
} from './monorepo.js';
import { PackageManager } from './package-manager.js';
import { Tip } from './tip.js';

export class Project {
  public folder: string;
  public frameworkType: FrameworkType = 'unknown';
  public isCapacitor: boolean = false;
  public isCapacitorPlugin: boolean = false;
  public isCordova: boolean = false;
  public monoRepo?: MonoRepoProject;
  public name: string;
  public packageManager: PackageManager = PackageManager.npm;
  public repoType: MonoRepoType = MonoRepoType.none;
  public tips: Tip[] = [];
  public workspaces: string[] = [];
  public yarnVersion?: string;

  constructor(folder: string) {
    this.folder = folder;
    this.name = 'unnamed';
  }

  /**
   * Add a tip to the project
   */
  public addTip(tip: Tip | undefined): void {
    if (tip) {
      this.tips.push(tip);
    }
  }

  /**
   * Clear all tips
   */
  public clearTips(): void {
    this.tips = [];
  }

  /**
   * Get node_modules folder location
   */
  public getNodeModulesFolder(): string {
    let nmf = join(this.folder, 'node_modules');
    if (this.monoRepo && !this.monoRepo.nodeModulesAtRoot) {
      nmf = join(this.monoRepo.folder, 'node_modules');
    }
    return nmf;
  }

  /**
   * Get project summary
   */
  public getSummary() {
    return {
      folder: this.folder,
      frameworkType: this.frameworkType,
      isCapacitor: this.isCapacitor,
      isCapacitorPlugin: this.isCapacitorPlugin,
      isCordova: this.isCordova,
      monoRepo: this.monoRepo
        ? {
            folder: this.monoRepo.folder,
            name: this.monoRepo.name,
          }
        : undefined,
      name: this.name,
      packageManager: PackageManager[this.packageManager],
      platforms: {
        android: this.hasCapacitorProject('android'),
        ios: this.hasCapacitorProject('ios'),
      },
      projectFolder: this.projectFolder(),
      repoType: MonoRepoType[this.repoType],
      workspaces: this.workspaces,
    };
  }

  /**
   * Get all tips for this project
   */
  public getTips(): Tip[] {
    return this.tips;
  }

  /**
   * Check if any Capacitor project exists
   */
  public hasACapacitorProject(): boolean {
    return this.hasCapacitorProject('ios') || this.hasCapacitorProject('android');
  }

  /**
   * Check if a Capacitor platform is installed and project folder exists
   */
  public hasCapacitorProject(platform: 'android' | 'ios'): boolean {
    return exists(`@capacitor/${platform}`) && existsSync(join(this.projectFolder(), platform));
  }

  /**
   * Check if using Yarn v1
   */
  public isYarnV1(): boolean {
    return this.yarnVersion?.startsWith('1.') || false;
  }

  /**
   * Load and analyze the project
   */
  public async load(): Promise<void> {
    // Load package.json
    const packageFile = loadPackageJson(this.folder);
    const allDeps = getAllDependencies();

    this.name = (packageFile.name as string) || 'unnamed';
    this.workspaces = (packageFile.workspaces as string[]) || [];

    // Detect if Capacitor or Cordova
    this.isCapacitor = !!(
      packageFile.dependencies &&
      (allDeps['@capacitor/core'] || allDeps['@capacitor/ios'] || allDeps['@capacitor/android'])
    );

    this.isCordova = !!(allDeps['cordova-ios'] || allDeps['cordova-android'] || packageFile.cordova);

    // Detect package manager
    this.packageManager = this.detectPackageManager();

    // Detect Yarn version
    if (this.packageManager === PackageManager.yarn && packageFile.packageManager) {
      const pkgMgr = packageFile.packageManager as string;
      if (pkgMgr.startsWith('yarn@')) {
        this.yarnVersion = pkgMgr.substring(5);
      }
    }

    // Detect monorepo type
    this.repoType = detectMonoRepoType(this.folder, this.packageManager);

    // Detect framework
    this.frameworkType = detectFrameworkType(this.folder);

    // Load monorepo projects if applicable
    if (this.repoType !== MonoRepoType.none) {
      await this.loadMonoRepoProjects();
    }
  }

  /**
   * Get the project folder (handles monorepos)
   */
  public projectFolder(): string {
    if (this.repoType === MonoRepoType.none) {
      return this.folder;
    }
    return this.monoRepo ? this.monoRepo.folder : this.folder;
  }

  /**
   * Detect package manager from lock files
   */
  private detectPackageManager(): PackageManager {
    if (existsSync(join(this.folder, 'pnpm-lock.yaml'))) {
      return PackageManager.pnpm;
    }
    if (existsSync(join(this.folder, 'yarn.lock'))) {
      return PackageManager.yarn;
    }
    if (existsSync(join(this.folder, 'bun.lockb'))) {
      return PackageManager.bun;
    }
    return PackageManager.npm;
  }

  /**
   * Load monorepo projects
   */
  private async loadMonoRepoProjects(): Promise<void> {
    let projects: MonoRepoProject[] = [];

    switch (this.repoType) {
      case MonoRepoType.bun:
      case MonoRepoType.npm:
      case MonoRepoType.yarn:
        projects = getNpmWorkspaceProjects(this.folder, this.workspaces);
        break;
      case MonoRepoType.folder:
        projects = getFolderBasedProjects(this.folder);
        break;
      // Add other monorepo types as needed
    }

    if (projects.length > 0) {
      this.monoRepo = projects[0]; // Default to first project
    }
  }
}
