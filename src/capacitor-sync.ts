import { Project } from './project';
import { MonoRepoType } from './monorepo';
import { exists, isGreaterOrEqual } from './analyzer';
import { InternalCommand } from './command-name';
import { npx, PackageManager, preflightNPMCheck } from './node-commands';
import { getConfigurationArgs } from './build-configuration';
import { useIonicCLI } from './capacitor-run';

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
  return `${npx(project)} cap sync${getConfigurationArgs()}`;
}

function ionicCLISync(project: Project): string {
  return `${npx(project)} ionic cap sync --inline${getConfigurationArgs()}`;
}

function nxSync(project: Project): string {
  if (project.monoRepo.isNXStandalone) {
    return capCLISync(project);
  }
  return `${npx(project)} nx sync ${project.monoRepo.name}${getConfigurationArgs()}`;
}
