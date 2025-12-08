/**
 * Package manager types and utilities
 * Adapted from ../../../src/node-commands.ts
 */

export enum PackageManager {
  npm,
  yarn,
  pnpm,
  bun,
}

export enum PMOperation {
  install,
  installAll,
  uninstall,
  update,
  run,
}

export function addCommand(packageManager: PackageManager): string {
  const a = pm(packageManager, PMOperation.install, '*');
  return a.replace('*', '').replace('--save-exact', '').replace('--exact', '').trim();
}

export function installForceArgument(packageManager: PackageManager): string {
  switch (packageManager) {
    case PackageManager.yarn:
      return '';
    default:
      return '--force';
  }
}

export function npmInstallAllCommand(packageManager: PackageManager): string {
  return pm(packageManager, PMOperation.installAll, '');
}

export function npmInstallCommand(packageManager: PackageManager, name: string, args: string[] = []): string {
  const argList = args.join(' ').trim();
  return `${pm(packageManager, PMOperation.install, name)} ${argList}`;
}

export function npmUninstallCommand(packageManager: PackageManager, name: string): string {
  return pm(packageManager, PMOperation.uninstall, name);
}

export function npxCommand(cmd: string): string {
  return `npx ${cmd}`;
}

export function saveDevArgument(packageManager: PackageManager): string {
  switch (packageManager) {
    case PackageManager.yarn:
      return '--dev';
    default:
      return '--save-dev';
  }
}

function bunPM(operation: PMOperation, name: string): string {
  switch (operation) {
    case PMOperation.install:
      return `bun add ${name}`;
    case PMOperation.installAll:
      return 'bun install';
    case PMOperation.run:
      return `bun run ${name}`;
    case PMOperation.uninstall:
      return `bun remove ${name}`;
    case PMOperation.update:
      return `bun update ${name}`;
  }
}

function npmPM(operation: PMOperation, name: string): string {
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
      return `npm update ${name}`;
  }
}

function pm(packageManager: PackageManager, operation: PMOperation, name: string): string {
  switch (packageManager) {
    case PackageManager.bun:
      return bunPM(operation, name);
    case PackageManager.pnpm:
      return pnpmPM(operation, name);
    case PackageManager.yarn:
      return yarnPM(operation, name);
    default:
      return npmPM(operation, name);
  }
}

function pnpmPM(operation: PMOperation, name: string): string {
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
      return `pnpm update ${name}`;
  }
}

function yarnPM(operation: PMOperation, name: string): string {
  switch (operation) {
    case PMOperation.install:
      return `yarn add ${name} --exact`;
    case PMOperation.installAll:
      return 'yarn';
    case PMOperation.run:
      return `yarn ${name}`;
    case PMOperation.uninstall:
      return `yarn remove ${name}`;
    case PMOperation.update:
      return `yarn upgrade ${name}`;
  }
}
