import { exists } from './analyzer';
import { CapacitorPlatform } from './capacitor-platform';
import { useIonicCLI } from './capacitor-run';
import { InternalCommand } from './command-name';
import { MonoRepoType } from './monorepo';
import { npx } from './node-commands';
import { Project } from './project';

/**
 * Add a Capacitor Platform
 * @param  {Project} project
 * @param  {CapacitorPlatform} platform
 * @returns string
 */
export function capacitorAdd(project: Project, platform: CapacitorPlatform): string {
  const ionic = useIonicCLI() ? 'ionic ' : '';
  switch (project.repoType) {
    case MonoRepoType.none:
      return `${npx(project)} ${ionic}cap add ${platform}`;
    case MonoRepoType.npm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
      return `${InternalCommand.cwd}${npx(project)} ${ionic}cap add ${platform}`;
    case MonoRepoType.nx:
      return nxAdd(project, platform);
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function nxAdd(project: Project, platform: CapacitorPlatform): string {
  return `${npx(project)} nx run ${project.monoRepo.name}:add:${platform}`;
}
