import { Project } from './project';
import { FrameworkType, MonoRepoType } from './monorepo';
import { exState } from './wn-tree-provider';
import { InternalCommand } from './command-name';
import { npmRun, npx, preflightNPMCheck } from './node-commands';
import { exists } from './analyzer';
import { CapacitorPlatform } from './capacitor-platform';
import { getConfigurationArgs } from './build-configuration';
import { workspace } from 'vscode';
import { error } from 'console';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { WorkspaceSection } from './workspace-state';

interface BuildOptions {
  platform?: CapacitorPlatform;
  arguments?: string;
  sourceMaps?: boolean;
}
/**
 * Creates the ionic build command
 * @param  {Project} project
 * @returns string
 */
export async function ionicBuild(project: Project, options: BuildOptions): Promise<string> {
  const preop = preflightNPMCheck(project);

  exState.projectDirty = false;

  const prod: boolean = workspace.getConfiguration(WorkspaceSection).get('buildForProduction');
  let args = options.arguments ? options.arguments : '';
  if (exState.project) {
    args += ` --project=${exState.project}`;
  }
  const additionalArgs = getConfigurationArgs(false);
  if (additionalArgs) {
    if (additionalArgs.includes('--configuration=') && args.includes('--configuration')) {
      // We've already got the configuration argument so ignore it
    } else {
      args += additionalArgs;
    }
  }
  switch (project.repoType) {
    case MonoRepoType.none:
      return `${preop}${build(prod, project, args, options.platform, options.sourceMaps)}`;
    case MonoRepoType.npm:
      return `${InternalCommand.cwd}${preop}${build(prod, project, args, options.platform)}`;
    case MonoRepoType.nx:
      return `${preop}${nxBuild(prod, project, args)}`;
    case MonoRepoType.folder:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return `${InternalCommand.cwd}${preop}${build(prod, project, args, options.platform, options.sourceMaps)}`;
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function build(
  prod: boolean,
  project: Project,
  configurationArg?: string,
  platform?: CapacitorPlatform,
  sourceMaps?: boolean,
): string {
  let cmd = `${npx(project)} ${buildCmd(project)}`;
  if (configurationArg) {
    if (cmd.includes('npm run ionic:build')) {
      // This adds -- if the command is npm run build but does not if it is something like ng build
      cmd += ' -- --';
    } else if (cmd.includes('run ')) {
      cmd += ' --';
    }
    cmd += ` ${configurationArg}`;
  } else if (prod) {
    cmd += ' --prod';
  }
  if (sourceMaps && cmd.includes('vite')) {
    cmd += ` --sourcemap true`;
  }

  if (platform || exists('@capacitor/ios') || exists('@capacitor/android')) {
    cmd += ` && ${npx(project)} cap copy`;
    if (platform) cmd += ` ${platform}`;
  }

  return cmd;
}

function buildCmd(project: Project): string {
  switch (project.frameworkType) {
    case 'angular':
    case 'angular-standalone':
      return guessBuildCommand(project) ?? 'ng build';
    case 'vue-vite':
      return guessBuildCommand(project) ?? 'vite build';
    case 'react-vite':
      return 'vite build';
    case 'react':
      return 'react-scripts build';
    case 'vue':
      return 'vue-cli-service build';
    default: {
      const cmd = guessBuildCommand(project);
      if (!cmd) {
        error('build command is unknown');
      }
      return cmd;
    }
  }
}

function guessBuildCommand(project: Project): string | undefined {
  const filename = join(project.projectFolder(), 'package.json');
  if (existsSync(filename)) {
    const packageFile = JSON.parse(readFileSync(filename, 'utf8'));
    if (packageFile.scripts['ionic:build']) {
      return npmRun('ionic:build');
    } else if (packageFile.scripts['build']) {
      return npmRun('build');
    }
  }
  return undefined;
}

function nxBuild(prod: boolean, project: Project, configurationArg?: string): string {
  let cmd = `${npx(project)} nx build ${project.monoRepo.name}`;
  if (configurationArg) {
    cmd += ` ${configurationArg}`;
  } else if (prod) {
    cmd += ' --configuration=production';
  }
  return cmd;
}
