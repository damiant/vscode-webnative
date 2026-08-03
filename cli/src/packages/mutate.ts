import {
  addCommand,
  commandContext,
  installForceArgument,
  npmInstall,
  npmInstallAll,
  npmUninstall,
  npmUpdate,
  PackageManager,
  saveDevArgument,
} from '../build/node-commands';
import { Project } from '../project/project';

export interface MutateOptions {
  dev?: boolean;
  force?: boolean;
  exact?: boolean;
  frozenLockfile?: boolean;
}

export function addPackageCommand(project: Project, name: string, options: MutateOptions = {}): string {
  const ctx = commandContext(project);
  const args: string[] = [];
  if (options.dev) args.push(saveDevArgument(project.packageManager));
  if (options.force) args.push(installForceArgument(project.packageManager));
  return npmInstall(name, ctx, ...args);
}

export function removePackageCommand(project: Project, name: string): string {
  return npmUninstall(name, commandContext(project));
}

export function upgradePackageCommand(project: Project, spec: string, options: MutateOptions = {}): string {
  const ctx = commandContext(project);
  const args: string[] = [];
  if (options.force) args.push(installForceArgument(project.packageManager));
  return npmInstall(spec, ctx, ...args);
}

export function installAllCommand(project: Project, options: MutateOptions = {}): string {
  const ctx = commandContext(project);
  if (options.frozenLockfile) {
    switch (project.packageManager) {
      case PackageManager.pnpm:
        return `${addCommand(ctx).replace('add', 'install')} --frozen-lockfile`;
      case PackageManager.yarn:
        return project.isYarnV1() ? 'yarn install --frozen-lockfile' : 'yarn install --immutable';
      case PackageManager.bun:
        return 'bun install --frozen-lockfile';
      default:
        return 'npm ci';
    }
  }
  return npmInstallAll(ctx);
}

export function updateAllCommand(project: Project): string {
  return npmUpdate(commandContext(project));
}

export function packageManagerName(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.npm:
      return 'npm';
    case PackageManager.pnpm:
      return 'pnpm';
    case PackageManager.yarn:
      return 'yarn';
    case PackageManager.bun:
      return 'bun';
    default:
      return 'npm';
  }
}

export function buildUpgradeSpec(name: string, version?: string, latest?: boolean): string {
  if (latest) return name;
  if (version) return `${name}@${version}`;
  return name;
}
