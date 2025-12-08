/**
 * Monorepo detection and utilities
 * Adapted from ../../../src/monorepo.ts
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { exists } from './analyzer.js';
import { PackageManager } from './package-manager.js';

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

export type FrameworkType = 'angular-standalone' | 'angular' | 'react-vite' | 'react' | 'unknown' | 'vue-vite' | 'vue';

export interface MonoRepoInfo {
  projects: MonoRepoProject[];
  selectedProject?: MonoRepoProject;
  type: MonoRepoType;
}

export interface MonoRepoProject {
  folder: string;
  isIonic?: boolean;
  isNXStandalone?: boolean;
  localPackageJson?: boolean;
  name: string;
  nodeModulesAtRoot?: boolean;
}

export function detectFrameworkType(folder: string): FrameworkType {
  try {
    const packageJsonPath = join(folder, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return 'unknown';
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for Angular
    if (deps['@angular/core']) {
      if (deps['@angular-devkit/build-angular']) {
        return 'angular-standalone';
      }
      return 'angular';
    }

    // Check for React
    if (deps['react']) {
      if (deps['vite']) {
        return 'react-vite';
      }
      return 'react';
    }

    // Check for Vue
    if (deps['vue']) {
      if (deps['vite']) {
        return 'vue-vite';
      }
      return 'vue';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function detectMonoRepoType(folder: string, packageManager: PackageManager): MonoRepoType {
  // Check for NX
  if (exists('@nrwl/cli') || existsSync(join(folder, 'nx.json'))) {
    return MonoRepoType.nx;
  }

  // Check for pnpm workspace
  const pnpmWorkspace = join(folder, 'pnpm-workspace.yaml');
  if (existsSync(pnpmWorkspace)) {
    return MonoRepoType.pnpm;
  }

  // Check for lerna
  const lernaJson = join(folder, 'lerna.json');
  if (existsSync(lernaJson)) {
    return MonoRepoType.lerna;
  }

  // Check for npm/yarn/bun workspaces
  try {
    const packageJsonPath = join(folder, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.workspaces && Array.isArray(packageJson.workspaces) && packageJson.workspaces.length > 0) {
        if (packageManager === PackageManager.yarn) {
          return MonoRepoType.yarn;
        } else if (packageManager === PackageManager.bun) {
          return MonoRepoType.bun;
        } else {
          return MonoRepoType.npm;
        }
      }
    }
  } catch {
    // Not a workspace
  }

  return MonoRepoType.none;
}

export function getFolderBasedProjects(folder: string): MonoRepoProject[] {
  const projects: MonoRepoProject[] = [];

  try {
    const items = readdirSync(folder);
    for (const item of items) {
      const itemPath = join(folder, item);
      const packageJsonPath = join(itemPath, 'package.json');

      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
          if (packageJson.name) {
            projects.push({
              folder: itemPath,
              localPackageJson: true,
              name: packageJson.name,
            });
          }
        } catch {
          // Skip invalid package.json
        }
      }
    }
  } catch {
    // Unable to read folder
  }

  return projects;
}

export function getNpmWorkspaceProjects(folder: string, workspaces: string[]): MonoRepoProject[] {
  const projects: MonoRepoProject[] = [];

  for (const workspace of workspaces) {
    const workspacePath = join(folder, workspace);
    const packageJsonPath = join(workspacePath, 'package.json');

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.name) {
          projects.push({
            folder: workspacePath,
            localPackageJson: true,
            name: packageJson.name,
          });
        }
      } catch {
        // Skip invalid package.json
      }
    }
  }

  return projects;
}
