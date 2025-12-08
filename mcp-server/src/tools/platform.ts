/**
 * MCP Tools for platform management (build, sync, add)
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

import { exists } from '../shared/analyzer.js';
import { MonoRepoType } from '../shared/monorepo.js';
import { npxCommand, preflightNPMCheck } from '../shared/node-commands.js';
import { runCommand } from '../shared/process.js';
import { Project } from '../shared/project.js';

export const addPlatformSchema = z.object({
  platform: z.enum(['ios', 'android']).describe('Platform to add'),
  projectPath: z.string().describe('Path to the project folder'),
});

export const buildProjectSchema = z.object({
  arguments: z.string().optional().describe('Additional build arguments'),
  buildConfiguration: z.string().optional().describe('Build configuration (e.g., "production", "development")'),
  projectPath: z.string().describe('Path to the project folder'),
  sourceMaps: z.boolean().optional().describe('Enable source maps for debugging'),
});

export const syncProjectSchema = z.object({
  buildConfiguration: z.string().optional().describe('Build configuration (e.g., "production")'),
  projectPath: z.string().describe('Path to the project folder'),
});

interface BuildOptions {
  arguments?: string;
  buildConfiguration?: string;
  sourceMaps?: boolean;
}

/**
 * Add iOS or Android platform to a Capacitor project
 */
export async function addPlatform(args: z.infer<typeof addPlatformSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const command = capacitorAddCommand(project, args.platform);
    const result = await runCommand(command, { cwd: project.projectFolder() });

    return JSON.stringify(
      {
        command,
        data: {
          output: result.output,
          platform: args.platform,
          projectPath: args.projectPath,
        },
        message: result.success ? `Platform ${args.platform} added successfully` : `Failed to add ${args.platform}`,
        success: result.success,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to add platform',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Build the web project for production or development
 */
export async function buildProject(args: z.infer<typeof buildProjectSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const command = await buildCommand(project, {
      arguments: args.arguments,
      buildConfiguration: args.buildConfiguration,
      sourceMaps: args.sourceMaps,
    });
    const result = await runCommand(command, { cwd: project.projectFolder(), timeout: 300000 });

    return JSON.stringify(
      {
        command,
        data: {
          output: result.output,
          projectPath: args.projectPath,
        },
        message: result.success ? 'Project built successfully' : 'Build failed',
        success: result.success,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to build project',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Sync web assets and native dependencies with Capacitor platforms
 */
export async function syncProject(args: z.infer<typeof syncProjectSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const command = await capacitorSyncCommand(project, args.buildConfiguration);
    const result = await runCommand(command, { cwd: project.projectFolder() });

    return JSON.stringify(
      {
        command,
        data: {
          output: result.output,
          projectPath: args.projectPath,
        },
        message: result.success ? 'Project synced successfully' : 'Sync failed',
        success: result.success,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to sync project',
        success: false,
      },
      null,
      2,
    );
  }
}

// Helper functions adapted from VS Code extension

function buildCmd(project: Project): string {
  switch (project.frameworkType) {
    case 'angular':
    case 'angular-standalone':
      return guessBuildCommand(project) ?? 'ng build';
    case 'react':
      return 'react-scripts build';
    case 'react-vite':
      return 'vite build';
    case 'vue':
      return 'vue-cli-service build';
    case 'vue-vite':
      return guessBuildCommand(project) ?? 'vite build';
    default: {
      const cmd = guessBuildCommand(project);
      if (!cmd) {
        throw new Error('Build command is unknown for this project type');
      }
      return cmd;
    }
  }
}

async function buildCommand(project: Project, options: BuildOptions): Promise<string> {
  const preop = preflightNPMCheck(project);
  let args = options.arguments || '';

  if (options.buildConfiguration) {
    if (!args.includes('--configuration')) {
      args += ` --configuration=${options.buildConfiguration}`;
    }
  }

  switch (project.repoType) {
    case MonoRepoType.bun:
    case MonoRepoType.folder:
    case MonoRepoType.lerna:
    case MonoRepoType.none:
    case MonoRepoType.npm:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
      if (project.repoType === MonoRepoType.none) {
        return `${preop}${runBuild(project, args, options.sourceMaps)}`;
      }
      return `cd ${project.projectFolder()} && ${preop}${runBuild(project, args, options.sourceMaps)}`;
    case MonoRepoType.nx:
      return `${preop}${nxBuild(project, args)}`;
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function capacitorAddCommand(project: Project, platform: string): string {
  const ionic = useIonicCLI() ? 'ionic ' : '';
  switch (project.repoType) {
    case MonoRepoType.bun:
    case MonoRepoType.folder:
    case MonoRepoType.lerna:
    case MonoRepoType.none:
    case MonoRepoType.npm:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
      if (project.repoType === MonoRepoType.none) {
        return `${npxCommand(project)} ${ionic}cap add ${platform}`;
      }
      return `cd ${project.projectFolder()} && ${npxCommand(project)} ${ionic}cap add ${platform}`;
    case MonoRepoType.nx:
      return nxAdd(project, platform);
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

async function capacitorSyncCommand(project: Project, buildConfiguration?: string): Promise<string> {
  const preop = preflightNPMCheck(project);
  const buildArgs = buildConfiguration ? ` --configuration=${buildConfiguration}` : '';
  const ionicCLI = useIonicCLI();
  const capSync = (p: Project, args: string) => `${npxCommand(p)} cap sync --inline${args}`;

  switch (project.repoType) {
    case MonoRepoType.bun:
    case MonoRepoType.folder:
    case MonoRepoType.lerna:
    case MonoRepoType.none:
    case MonoRepoType.npm:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
      if (project.repoType === MonoRepoType.none) {
        return preop + (ionicCLI ? ionicCLISync(project, buildArgs) : capSync(project, buildArgs));
      }
      return (
        `cd ${project.projectFolder()} && ` +
        preop +
        (ionicCLI ? ionicCLISync(project, buildArgs) : capSync(project, buildArgs))
      );
    case MonoRepoType.nx:
      return preop + nxSync(project, buildArgs);
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function guessBuildCommand(project: Project): string | undefined {
  const filename = join(project.projectFolder(), 'package.json');
  if (existsSync(filename)) {
    const packageFile = JSON.parse(readFileSync(filename, 'utf8'));
    if (packageFile.scripts?.['ionic:build']) {
      return 'npm run ionic:build';
    } else if (packageFile.scripts?.['build']) {
      return 'npm run build';
    }
  }
  return undefined;
}

function ionicCLISync(project: Project, buildArgs: string): string {
  return `${npxCommand(project)} ionic cap sync --inline${buildArgs}`;
}

function nxAdd(project: Project, platform: string): string {
  return `${npxCommand(project)} nx run ${project.monoRepo?.name}:add:${platform}`;
}

function nxBuild(project: Project, configurationArg?: string): string {
  let cmd = `${npxCommand(project)} nx build ${project.monoRepo?.name}`;
  if (configurationArg) {
    cmd += ` ${configurationArg}`;
  }
  return cmd;
}

function nxSync(project: Project, buildArgs: string): string {
  if (project.monoRepo?.isNXStandalone) {
    return `${npxCommand(project)} cap sync --inline${buildArgs}`;
  }
  return `${npxCommand(project)} nx sync ${project.monoRepo?.name}${buildArgs}`;
}

function runBuild(project: Project, configurationArg?: string, sourceMaps?: boolean): string {
  let cmd = `${npxCommand(project)} ${buildCmd(project)}`;

  if (configurationArg) {
    if (cmd.includes('npm run ionic:build') || cmd.includes('run ')) {
      cmd += ' --';
    }
    cmd += ` ${configurationArg}`;
  }

  if (sourceMaps && cmd.includes('vite')) {
    cmd += ` --sourcemap inline`;
  }

  if (exists('@capacitor/ios') || exists('@capacitor/android')) {
    cmd += ` && ${npxCommand(project)} cap copy`;
  }

  return cmd;
}

function useIonicCLI(): boolean {
  // Check if Ionic CLI should be used (simplified version)
  return exists('@ionic/angular') || exists('@ionic/react') || exists('@ionic/vue');
}
