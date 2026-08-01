import { CapacitorPlatform } from '../project/capacitor-platform';
import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { CommandResult, finalizeCommand } from './command-result';
import { npx } from './node-commands';
import { useIonicCLI } from './capacitor-run';

/**
 * Add a Capacitor Platform
 */
export function capacitorAdd(project: Project, platform: CapacitorPlatform): CommandResult {
  const ionic = useIonicCLI(project) ? 'ionic ' : '';
  switch (project.repoType) {
    case MonoRepoType.none:
      return finalizeCommand(project, `${npx(project)} ${ionic}cap add ${platform}`);
    case MonoRepoType.npm:
    case MonoRepoType.bun:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
      return finalizeCommand(project, `${npx(project)} ${ionic}cap add ${platform}`);
    case MonoRepoType.nx:
      return finalizeCommand(project, nxAdd(project, platform));
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function nxAdd(project: Project, platform: CapacitorPlatform): string {
  return `${npx(project)} nx run ${project.monoRepo.name}:add:${platform}`;
}
