import { getMonoRepoFolder, MonoRepoType, MonoRepoProject } from '../project/monorepo';
import { Project } from '../project/project';
import { existsSync } from 'fs';
import { InternalCommand } from './command-name';

export enum PackageManager {
  npm,
  yarn,
  pnpm,
  bun,
}

enum PMOperation {
  install,
  installAll,
  uninstall,
  update,
  run,
}

export interface PackageCommandContext {
  packageManager: PackageManager;
  repoType: MonoRepoType;
  workspaceName?: string;
  monoRepoProjects?: MonoRepoProject[];
}

export function outdatedCommand(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.yarn: {
      if (project.isYarnV1()) {
        return 'yarn outdated --json';
      }
      return 'yarn outdated --format=json';
    }
    case PackageManager.bun:
      return 'npm outdated --json';
    case PackageManager.pnpm:
      return 'pnpm outdated --json';
    default:
      return 'npm outdated --json';
  }
}

export function listCommand(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.yarn:
      return project.isYarnV1() ? 'yarn list --json' : 'yarn info --json';
    case PackageManager.pnpm:
      return 'pnpm list --json';
    case PackageManager.bun:
      return 'npm list --json';
    default:
      return 'npm list --json';
  }
}

export function saveDevArgument(packageManager: PackageManager): string {
  switch (packageManager) {
    case PackageManager.yarn:
      return '--dev';
    default:
      return '--save-dev';
  }
}

export function installForceArgument(packageManager: PackageManager): string {
  switch (packageManager) {
    case PackageManager.yarn:
      return '';
    default:
      return '--force';
  }
}

export function npmInstall(name: string, ctx: PackageCommandContext, ...args: string[]): string {
  const argList = args.join(' ').trim();

  switch (ctx.repoType) {
    case MonoRepoType.npm:
      return `${pm(PMOperation.install, ctx, name)} ${argList} --workspace=${getMonoRepoFolder(
        ctx.workspaceName ?? '',
        '',
        ctx.monoRepoProjects ?? [],
      )}`;
    case MonoRepoType.bun:
    case MonoRepoType.yarn:
    case MonoRepoType.folder:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return InternalCommand.cwd + `${pm(PMOperation.install, ctx, name)} ${notForce(ctx, argList)}`;
    default:
      return `${pm(PMOperation.install, ctx, name)} ${notForce(ctx, argList)}`;
  }
}

function notForce(ctx: PackageCommandContext, args: string): string {
  if (ctx.packageManager !== PackageManager.yarn) return args;
  return args.replace('--force', '');
}

export function addCommand(ctx: PackageCommandContext): string {
  const a = pm(PMOperation.install, ctx, '*');
  return a.replace('*', '').replace('--save-exact', '').replace('--exact', '').trim();
}

export function preflightNPMCheck(project: Project): string {
  const nmf = project.getNodeModulesFolder();
  const ctx: PackageCommandContext = {
    packageManager: project.packageManager,
    repoType: project.repoType,
    workspaceName: project.monoRepo?.name,
    monoRepoProjects: project.monoRepoProjects,
  };
  const preop = !existsSync(nmf) && !project.isModernYarn() ? npmInstallAll(ctx) + ' && ' : '';

  if (!process.env.ANDROID_SDK_ROOT && !process.env.ANDROID_HOME && process.platform !== 'win32') {
    process.env.ANDROID_HOME = `~/Library/Android/sdk`;
  }

  return preop;
}

export function npmInstallAll(ctx: PackageCommandContext): string {
  switch (ctx.repoType) {
    case MonoRepoType.pnpm:
    case MonoRepoType.lerna:
    case MonoRepoType.folder:
      return InternalCommand.cwd + pm(PMOperation.installAll, ctx);
    default:
      return pm(PMOperation.installAll, ctx);
  }
}

export function npmUpdate(ctx: PackageCommandContext): string {
  switch (ctx.repoType) {
    case MonoRepoType.pnpm:
    case MonoRepoType.lerna:
    case MonoRepoType.folder:
      return InternalCommand.cwd + pm(PMOperation.update, ctx);
    default:
      return pm(PMOperation.update, ctx);
  }
}

function pm(operation: PMOperation, ctx: PackageCommandContext, name?: string): string {
  switch (ctx.packageManager) {
    case PackageManager.npm:
      return npmPm(operation, name);
    case PackageManager.yarn:
      return yarnPm(operation, name);
    case PackageManager.pnpm:
      return pnpmPm(operation, name);
    case PackageManager.bun:
      return bunPm(operation, name);
    default:
      console.error('Unknown package manager');
      return '';
  }
}

function yarnPm(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.installAll:
      return 'yarn install';
    case PMOperation.install:
      return `yarn add ${name} --exact`;
    case PMOperation.uninstall:
      return `yarn remove ${name}`;
    case PMOperation.run:
      return `yarn run ${name}`;
    case PMOperation.update:
      return `yarn update`;
  }
}

function npmPm(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.installAll:
      return 'npm install';
    case PMOperation.install:
      return `npm install ${name} --save-exact`;
    case PMOperation.uninstall:
      return `npm uninstall ${name}`;
    case PMOperation.run:
      return `npm run ${name}`;
    case PMOperation.update:
      return 'npm update';
  }
}

function pnpmPm(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.installAll:
      return 'pnpm install';
    case PMOperation.install:
      return `pnpm add ${name}  --save-exact`;
    case PMOperation.uninstall:
      return `pnpm remove ${name}`;
    case PMOperation.update:
      return 'pnpm update';
  }
}

function bunPm(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.installAll:
      return 'bun install';
    case PMOperation.install:
      return `bun install ${name}  --save-exact`;
    case PMOperation.uninstall:
      return `bun uninstall ${name}`;
    case PMOperation.run:
      return `bun run ${name}`;
    case PMOperation.update:
      return 'bun update';
  }
}

interface NpxOptions {
  forceNpx?: boolean;
}

export function npx(project: Project, options?: NpxOptions): string {
  switch (project.packageManager) {
    case PackageManager.bun:
      return `${InternalCommand.cwd}bunx`;
    case PackageManager.pnpm:
      return options?.forceNpx ? `${InternalCommand.cwd}npx` : `${InternalCommand.cwd}pnpm exec`;
    case PackageManager.yarn:
      if (options?.forceNpx && !project.isModernYarn()) {
        return `${InternalCommand.cwd}npx`;
      }
      if (project.analyzer.exists('@yarnpkg/pnpify')) {
        return `${InternalCommand.cwd}yarn pnpify`;
      }
      return `${InternalCommand.cwd}yarn exec`;
    default:
      return `${InternalCommand.cwd}npx`;
  }
}

export function npmUninstall(name: string, ctx: PackageCommandContext): string {
  switch (ctx.repoType) {
    case MonoRepoType.npm:
      return `${pm(PMOperation.uninstall, ctx, name)} --workspace=${getMonoRepoFolder(
        ctx.workspaceName ?? '',
        '',
        ctx.monoRepoProjects ?? [],
      )}`;
    case MonoRepoType.bun:
    case MonoRepoType.folder:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return `${InternalCommand.cwd}${pm(PMOperation.uninstall, ctx, name)}`;
    default:
      return pm(PMOperation.uninstall, ctx, name);
  }
}

export function npmRun(name: string, ctx: PackageCommandContext): string {
  switch (ctx.repoType) {
    case MonoRepoType.npm:
      return `${pm(PMOperation.run, ctx, name)} --workspace=${getMonoRepoFolder(
        ctx.workspaceName ?? '',
        '',
        ctx.monoRepoProjects ?? [],
      )}`;
    case MonoRepoType.bun:
    case MonoRepoType.folder:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return `${InternalCommand.cwd}${pm(PMOperation.run, ctx, name)}`;
    default:
      return pm(PMOperation.run, ctx, name);
  }
}

/** Build a PackageCommandContext from a Project instance. */
export function commandContext(project: Project): PackageCommandContext {
  return {
    packageManager: project.packageManager,
    repoType: project.repoType,
    workspaceName: project.monoRepo?.name,
    monoRepoProjects: project.monoRepoProjects,
  };
}
