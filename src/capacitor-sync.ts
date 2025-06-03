import { Project } from './project';
import { MonoRepoType } from './monorepo';
import { isGreaterOrEqual } from './analyzer';
import { InternalCommand } from './command-name';
import { npx, preflightNPMCheck } from './node-commands';
import { useIonicCLI } from './capacitor-run';
import { getBuildConfigurationArgs } from './build-configuration';

/**
 * Creates the capacitor sync command
 * @param  {Project} project
 * @returns string
 */
export async function capacitorSync(project: Project): Promise<string> {
  const preop = preflightNPMCheck(project);

  const ionicCLI = useIonicCLI();
  switch (project.repoType) {
    case MonoRepoType.none:
      return preop + (ionicCLI ? ionicCLISync(project) : capCLISync(project));
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
    case MonoRepoType.lerna:
    case MonoRepoType.yarn:
    case MonoRepoType.bun:
    case MonoRepoType.npm:
      return InternalCommand.cwd + preop + (ionicCLI ? ionicCLISync(project) : capCLISync(project));
    case MonoRepoType.nx:
      return preop + nxSync(project);
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function capCLISync(project: Project): string {
  if (isGreaterOrEqual('@capacitor/cli', '4.1.0')) {
    return `${npx(project)} cap sync --inline`;
  }
  return `${npx(project)} cap sync${getBuildConfigurationArgs()}`;
}

function ionicCLISync(project: Project): string {
  return `${npx(project)} ionic cap sync --inline${getBuildConfigurationArgs()}`;
}

function nxSync(project: Project): string {
  if (project.monoRepo.isNXStandalone) {
    return capCLISync(project);
  }
  return `${npx(project)} nx sync ${project.monoRepo.name}${getBuildConfigurationArgs()}`;
}
