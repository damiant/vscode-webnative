/**
 * Node/NPM command utilities for MCP server
 * Adapted from ../../../src/node-commands.ts
 */

import { existsSync } from 'fs';

import { MonoRepoType } from './monorepo.js';
import { PackageManager } from './package-manager.js';
import { Project } from './project.js';

export enum PMOperation {
  install = 'install',
  installAll = 'installAll',
  run = 'run',
  uninstall = 'uninstall',
  update = 'update',
}

/**
 * Get the install all dependencies command
 */
export function npmInstallAllCommand(project: Project): string {
  switch (project.repoType) {
    case MonoRepoType.folder:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return `cd ${project.projectFolder()} && ${pm(project, PMOperation.installAll)}`;
    default:
      return pm(project, PMOperation.installAll);
  }
}

/**
 * Get the install command for a package
 */
export function npmInstallCommand(project: Project, packageName: string, isDev = false): string {
  const devArg = isDev ? saveDevArgument(project) : '';
  const args = devArg ? ` ${devArg}` : '';

  switch (project.repoType) {
    case MonoRepoType.bun:
    case MonoRepoType.folder:
    case MonoRepoType.lerna:
    case MonoRepoType.npm:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
      if (project.repoType === MonoRepoType.npm) {
        return `${pm(project, PMOperation.install, packageName)}${args} --workspace=${project.monoRepo?.name || '.'}`;
      }
      return `cd ${project.projectFolder()} && ${pm(project, PMOperation.install, packageName)}${args}`;
    default:
      return `${pm(project, PMOperation.install, packageName)}${args}`;
  }
}

/**
 * Get the uninstall command for a package
 */
export function npmUninstallCommand(project: Project, packageName: string): string {
  switch (project.repoType) {
    case MonoRepoType.bun:
    case MonoRepoType.folder:
    case MonoRepoType.lerna:
    case MonoRepoType.npm:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
      if (project.repoType === MonoRepoType.npm) {
        return `${pm(project, PMOperation.uninstall, packageName)} --workspace=${project.monoRepo?.name || '.'}`;
      }
      return `cd ${project.projectFolder()} && ${pm(project, PMOperation.uninstall, packageName)}`;
    default:
      return pm(project, PMOperation.uninstall, packageName);
  }
}

/**
 * Get the npx command prefix
 */
export function npxCommand(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.bun:
      return 'bunx';
    case PackageManager.pnpm:
      return 'pnpm exec';
    case PackageManager.yarn:
      return 'yarn exec';
    default:
      return 'npx';
  }
}

/**
 * Check if node_modules needs to be installed and return preflight command
 */
export function preflightNPMCheck(project: Project): string {
  const nmf = project.getNodeModulesFolder();
  return !existsSync(nmf) ? npmInstallAllCommand(project) + ' && ' : '';
}

function bun(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.install:
      return `bun install ${name} --save-exact`;
    case PMOperation.installAll:
      return 'bun install';
    case PMOperation.run:
      return `bun run ${name}`;
    case PMOperation.uninstall:
      return `bun uninstall ${name}`;
    case PMOperation.update:
      return `bun update`;
  }
}

function npm(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.install:
      return `npm install ${name} --save-exact`;
    case PMOperation.installAll:
      return 'npm install';
    case PMOperation.run:
      return `npm run ${name}`;
    case PMOperation.uninstall:
      return `npm uninstall ${name}`;
    case PMOperation.update:
      return `npm update`;
  }
}

function pm(project: Project, operation: PMOperation, name?: string): string {
  switch (project.packageManager) {
    case PackageManager.bun:
      return bun(operation, name);
    case PackageManager.npm:
      return npm(operation, name);
    case PackageManager.pnpm:
      return pnpm(operation, name);
    case PackageManager.yarn:
      return yarn(operation, name);
    default:
      return npm(operation, name);
  }
}

function pnpm(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.install:
      return `pnpm add ${name} --save-exact`;
    case PMOperation.installAll:
      return 'pnpm install';
    case PMOperation.run:
      return `pnpm ${name}`;
    case PMOperation.uninstall:
      return `pnpm remove ${name}`;
    case PMOperation.update:
      return `pnpm update`;
  }
}

/**
 * Get dev dependency argument for package manager
 */
function saveDevArgument(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.yarn:
      return '--dev';
    default:
      return '--save-dev';
  }
}

function yarn(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.install:
      return `yarn add ${name} --exact`;
    case PMOperation.installAll:
      return 'yarn install';
    case PMOperation.run:
      return `yarn run ${name}`;
    case PMOperation.uninstall:
      return `yarn remove ${name}`;
    case PMOperation.update:
      return `yarn update`;
  }
}
