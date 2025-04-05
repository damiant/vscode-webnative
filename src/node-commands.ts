import { window, commands } from 'vscode';
import { CommandName, InternalCommand } from './command-name';
import { exState } from './wn-tree-provider';
import { getMonoRepoFolder, MonoRepoType } from './monorepo';
import { Project } from './project';
import { getRunOutput, showProgress } from './utilities';
import { existsSync } from 'fs';
import { ExtensionSetting, GlobalSetting, getExtSetting, getGlobalSetting, setGlobalSetting } from './workspace-state';
import { exists, isVersionGreaterOrEqual } from './analyzer';
import { hasPackageLock } from './package-lock';

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

export function outdatedCommand(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.yarn: {
      if (project.isYarnV1()) {
        return 'yarn outdated --json';
      }
      // Uses https://github.com/mskelton/yarn-plugin-outdated
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

export function saveDevArgument(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.yarn:
      return '--dev';
    default:
      return '--save-dev';
  }
}

export function installForceArgument(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.yarn:
      return '';
    default:
      return '--force';
  }
}

export function npmInstall(name: string, ...args): string {
  const argList = args.join(' ').trim();

  switch (exState.repoType) {
    case MonoRepoType.npm:
      return `${pm(PMOperation.install, name)} ${argList} --workspace=${getMonoRepoFolder(
        exState.workspace,
        undefined,
      )}`;
    case MonoRepoType.yarn:
    case MonoRepoType.folder:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return InternalCommand.cwd + `${pm(PMOperation.install, name)} ${notForce(argList)}`;
    default:
      return `${pm(PMOperation.install, name)} ${notForce(argList)}`;
  }
}

function notForce(args: string): string {
  if (exState.packageManager !== PackageManager.yarn) return args;
  return args.replace('--force', '');
}

// The package manager add command (without arguments)
export function addCommand(): string {
  const a = pm(PMOperation.install, '*');
  return a.replace('*', '').replace('--save-exact', '').replace('--exact', '').trim();
}

/**
 * Check to see if we have node modules installed and return a command to prepend to any operations we may do
 * @param  {Project} project
 * @returns string
 */
export function preflightNPMCheck(project: Project): string {
  const nmf = project.getNodeModulesFolder();
  const preop = !existsSync(nmf) && !project.isModernYarn() ? npmInstallAll() + ' && ' : '';

  // If not set then set to a default value to prevent failrue
  if (!process.env.ANDROID_SDK_ROOT && !process.env.ANDROID_HOME && process.platform !== 'win32') {
    process.env.ANDROID_HOME = `~/Library/Android/sdk`;
    //preop = preop + 'export ANDROID_HOME=~/Library/Android/sdk && ';
  }

  return preop;
}

export async function getPackageManagers(): Promise<string[]> {
  const result = [];
  if (isVersionGreaterOrEqual(await getVersion('npm -v'), '0.0.0')) {
    result.push('npm');
  }
  if (isVersionGreaterOrEqual(await getVersion('pnpm -v'), '0.0.0')) {
    result.push('pnpm');
  }
  if (isVersionGreaterOrEqual(await getVersion('yarn -v'), '0.0.0')) {
    result.push('yarn');
  }
  if (isVersionGreaterOrEqual(await getVersion('bun -v'), '0.0.0')) {
    result.push('bun');
  }
  return result;
}

async function getVersion(cmd: string): Promise<string> {
  return await getRunOutput(cmd, '', undefined, true, true);
}
export async function suggestInstallAll(project: Project) {
  if (!exState || !exState.hasPackageJson) {
    return;
  }

  exState.hasNodeModulesNotified = true;

  if (project.isModernYarn()) {
    return;
  }
  const res = getExtSetting(ExtensionSetting.packageManager);

  if (!res || res == '') {
    if (getGlobalSetting(GlobalSetting.suggestNPMInstall) == 'no') return;

    const isNpm = hasPackageLock(project);
    let message = `Would you like to install node modules for this project?`;
    const options = [];
    let noMessage = 'no';
    if (!isNpm) {
      const list = await getPackageManagers();
      for (const pm of list) {
        options.push(pm);
      }
      if (options.length > 1) {
        message = `Which package manager should be used to install dependencies?`;
        noMessage = 'None of these';
      }
    } else {
      options.push('Yes');
    }
    const res = await window.showInformationMessage(message, ...options, noMessage, 'Never');
    if (res == 'Never') {
      setGlobalSetting(GlobalSetting.suggestNPMInstall, 'no');
      return;
    }
    if (!res || res == noMessage) return;
  }
  if (res == 'npm') {
    exState.repoType = MonoRepoType.npm;
    exState.packageManager = PackageManager.npm;
  }
  if (res == 'pnpm') {
    exState.repoType = MonoRepoType.pnpm;
    exState.packageManager = PackageManager.pnpm;
  }
  if (res == 'yarn') {
    exState.repoType = MonoRepoType.yarn;
    exState.packageManager = PackageManager.yarn;
  }
  if (res == 'bun') {
    exState.packageManager = PackageManager.bun;
  }
  showProgress(`Installing dependencies with ${res}....`, async () => {
    await project.runAtRoot(npmInstallAll());
    exState.view.reveal(undefined, { focus: true, expand: true });
    commands.executeCommand(CommandName.Refresh);
  });
}

export function npmInstallAll(): string {
  switch (exState.repoType) {
    case MonoRepoType.pnpm:
    case MonoRepoType.lerna:
    case MonoRepoType.folder:
      return InternalCommand.cwd + pm(PMOperation.installAll);
    default:
      return pm(PMOperation.installAll);
  }
}

export function npmUpdate(): string {
  switch (exState.repoType) {
    case MonoRepoType.pnpm:
    case MonoRepoType.lerna:
    case MonoRepoType.folder:
      return InternalCommand.cwd + pm(PMOperation.update);
    default:
      return pm(PMOperation.update);
  }
}

function pm(operation: PMOperation, name?: string): string {
  switch (exState.packageManager) {
    case PackageManager.npm:
      return npm(operation, name);
    case PackageManager.yarn:
      return yarn(operation, name);
    case PackageManager.pnpm:
      return pnpm(operation, name);
    case PackageManager.bun:
      return bun(operation, name);
    default:
      window.showErrorMessage('Unknown package manager');
  }
}

function yarn(operation: PMOperation, name?: string): string {
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

function npm(operation: PMOperation, name?: string): string {
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
      return `npm update`;
  }
}

function pnpm(operation: PMOperation, name?: string): string {
  switch (operation) {
    case PMOperation.installAll:
      return 'pnpm install';
    case PMOperation.install:
      return `pnpm add ${name}  --save-exact`;
    case PMOperation.uninstall:
      return `pnpm remove ${name}`;
    case PMOperation.run:
      return `pnpm ${name}`;
    case PMOperation.update:
      return `pnpm update`;
  }
}

function bun(operation: PMOperation, name?: string): string {
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
      return `bun update`;
  }
}

interface NpxOptions {
  forceNpx?: boolean; // Will force to use npx instead of the package manager default
}

export function npx(project: Project, options?: NpxOptions): string {
  switch (project.packageManager) {
    case PackageManager.bun:
      return `${InternalCommand.cwd}bunx`;
    case PackageManager.pnpm:
      return `${InternalCommand.cwd}pnpm exec`;
    case PackageManager.yarn:
      if (options?.forceNpx && !project.isModernYarn()) {
        return `${InternalCommand.cwd}npx`;
      }
      if (exists('@yarnpkg/pnpify')) {
        return `${InternalCommand.cwd}yarn pnpify`;
      }
      return `${InternalCommand.cwd}yarn exec`;
    default:
      return `${InternalCommand.cwd}npx`;
  }
}

export function npmUninstall(name: string): string {
  switch (exState.repoType) {
    case MonoRepoType.npm:
      return `${pm(PMOperation.uninstall, name)} --workspace=${getMonoRepoFolder(exState.workspace, undefined)}`;
    case MonoRepoType.folder:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return `${InternalCommand.cwd}${pm(PMOperation.uninstall, name)}`;
    default:
      return pm(PMOperation.uninstall, name);
  }
}

export function npmRun(name: string): string {
  switch (exState.repoType) {
    case MonoRepoType.npm:
      return `${pm(PMOperation.run, name)} --workspace=${getMonoRepoFolder(exState.workspace, undefined)}`;
    case MonoRepoType.folder:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return `${InternalCommand.cwd}${pm(PMOperation.run, name)}`;
    default:
      return pm(PMOperation.run, name);
  }
}
