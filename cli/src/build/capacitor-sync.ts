import { Project } from '../project/project';
import { MonoRepoType } from '../project/monorepo';
import { getBuildConfigurationArgs } from './build-configuration';
import { CommandResult, finalizeCommand } from './command-result';
import { npx, preflightNPMCheck } from './node-commands';
import { useIonicCLI } from './capacitor-run';

/**
 * Creates the capacitor sync command
 */
export function capacitorSync(project: Project, buildConfiguration?: string, useMode?: boolean): CommandResult {
  const preop = preflightNPMCheck(project);
  const ionicCLI = useIonicCLI(project);
  switch (project.repoType) {
    case MonoRepoType.none:
      return finalizeCommand(
        project,
        preop +
          (ionicCLI
            ? ionicCLISync(project, buildConfiguration, useMode)
            : capCLISync(project, buildConfiguration, useMode)),
      );
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
    case MonoRepoType.lerna:
    case MonoRepoType.yarn:
    case MonoRepoType.bun:
    case MonoRepoType.npm:
      return finalizeCommand(
        project,
        preop +
          (ionicCLI
            ? ionicCLISync(project, buildConfiguration, useMode)
            : capCLISync(project, buildConfiguration, useMode)),
      );
    case MonoRepoType.nx:
      return finalizeCommand(project, preop + nxSync(project, buildConfiguration, useMode));
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function capCLISync(project: Project, buildConfiguration?: string, useMode?: boolean): string {
  if (project.analyzer.isGreaterOrEqual('@capacitor/cli', '4.1.0')) {
    return `${npx(project)} cap sync --inline`;
  }
  return `${npx(project)} cap sync${getBuildConfigurationArgs(buildConfiguration, undefined, useMode)}`;
}

function ionicCLISync(project: Project, buildConfiguration?: string, useMode?: boolean): string {
  return `${npx(project)} ionic cap sync --inline${getBuildConfigurationArgs(buildConfiguration, undefined, useMode)}`;
}

function nxSync(project: Project, buildConfiguration?: string, useMode?: boolean): string {
  if (project.monoRepo.isNXStandalone) {
    return capCLISync(project, buildConfiguration, useMode);
  }
  return `${npx(project)} nx sync ${project.monoRepo.name}${getBuildConfigurationArgs(buildConfiguration, undefined, useMode)}`;
}
