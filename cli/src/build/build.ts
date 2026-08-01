import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { getBuildConfigurationArgs } from './build-configuration';
import { CommandResult, finalizeCommand } from './command-result';
import { commandContext, npmRun, npx, preflightNPMCheck } from './node-commands';

export interface BuildOptions {
  platform?: CapacitorPlatform;
  arguments?: string;
  sourceMaps?: boolean;
  buildForProduction?: boolean;
  projectName?: string;
  buildConfiguration?: string;
}

/**
 * Creates the ionic build command
 */
export function build(project: Project, options: BuildOptions = {}): CommandResult {
  const preop = preflightNPMCheck(project);
  const prod = options.buildForProduction ?? false;
  let args = options.arguments ?? '';
  if (options.projectName) {
    args += ` --project=${options.projectName}`;
  }
  const additionalArgs = getBuildConfigurationArgs(options.buildConfiguration);
  if (additionalArgs) {
    if (additionalArgs.includes('--configuration=') && args.includes('--configuration')) {
      // configuration already set
    } else {
      args += additionalArgs;
    }
  }
  const ctx = commandContext(project);
  switch (project.repoType) {
    case MonoRepoType.none:
      return finalizeCommand(
        project,
        `${preop}${runBuild(prod, project, ctx, args, options.platform, options.sourceMaps)}`,
      );
    case MonoRepoType.bun:
    case MonoRepoType.npm:
      return finalizeCommand(
        project,
        `${preop}${runBuild(prod, project, ctx, args, options.platform, options.sourceMaps)}`,
      );
    case MonoRepoType.nx:
      return finalizeCommand(project, `${preop}${nxBuild(prod, project, args)}`);
    case MonoRepoType.folder:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.pnpm:
      return finalizeCommand(
        project,
        `${preop}${runBuild(prod, project, ctx, args, options.platform, options.sourceMaps)}`,
      );
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function runBuild(
  prod: boolean,
  project: Project,
  ctx: ReturnType<typeof commandContext>,
  configurationArg?: string,
  platform?: CapacitorPlatform,
  sourceMaps?: boolean,
): string {
  let cmd = `${npx(project)} ${buildCmd(project, ctx)}`;
  if (configurationArg) {
    if (cmd.includes('wn:build') || cmd.includes('ionic:build')) {
      cmd += ' -- --';
    } else if (cmd.includes('run ')) {
      cmd += ' --';
    }
    cmd += ` ${configurationArg}`;
  } else if (prod) {
    cmd += ' --prod';
  }
  if (sourceMaps && cmd.includes('vite')) {
    cmd += ` --sourcemap inline`;
  }

  if (platform || project.analyzer.exists('@capacitor/ios') || project.analyzer.exists('@capacitor/android')) {
    cmd += ` && ${npx(project)} cap copy`;
    if (platform) cmd += ` ${platform}`;
  }

  return cmd;
}

function buildCmd(project: Project, ctx: ReturnType<typeof commandContext>): string {
  const guessed = guessBuildCommand(project, ctx);
  if (guessed) {
    return guessed;
  }
  switch (project.frameworkType) {
    case 'angular':
    case 'angular-standalone':
      return 'ng build';
    case 'vue-vite':
    case 'react-vite':
      return 'vite build';
    case 'react':
      return 'react-scripts build';
    case 'vue':
      return 'vue-cli-service build';
    default:
      console.error('build command is unknown');
      return '';
  }
}

function guessBuildCommand(project: Project, ctx: ReturnType<typeof commandContext>): string | undefined {
  const filename = join(project.projectFolder(), 'package.json');
  if (existsSync(filename)) {
    const packageFile = JSON.parse(readFileSync(filename, 'utf8'));
    if (packageFile.scripts?.['wn:build']) {
      return npmRun('wn:build', ctx);
    } else if (packageFile.scripts?.['ionic:build']) {
      return npmRun('ionic:build', ctx);
    } else if (packageFile.scripts?.['build']) {
      return npmRun('build', ctx);
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
