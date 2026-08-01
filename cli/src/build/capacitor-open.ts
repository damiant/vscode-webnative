import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { CommandResult, finalizeCommand } from './command-result';
import { npx } from './node-commands';
import { useIonicCLI } from './capacitor-run';

/**
 * Capacitor open command
 */
export function capacitorOpen(project: Project, platform: CapacitorPlatform): CommandResult {
  const ionicCLI = useIonicCLI(project);

  if (platform === CapacitorPlatform.android) {
    checkAndroidStudioJDK(project.projectFolder(), project);
  }
  switch (project.repoType) {
    case MonoRepoType.none:
      return finalizeCommand(project, ionicCLI ? ionicCLIOpen(platform, project) : capCLIOpen(platform, project));
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.bun:
    case MonoRepoType.npm:
      return finalizeCommand(project, ionicCLI ? ionicCLIOpen(platform, project) : capCLIOpen(platform, project));
    case MonoRepoType.nx:
      return finalizeCommand(project, nxOpen(project, platform));
    default:
      throw new Error('Unsupported Monorepo type');
  }
}

function capCLIOpen(platform: CapacitorPlatform, project: Project): string {
  return `${npx(project)} cap open ${platform}`;
}

function ionicCLIOpen(platform: CapacitorPlatform, project: Project): string {
  return `${npx(project)} ionic cap open ${platform}`;
}

function nxOpen(project: Project, platform: CapacitorPlatform): string {
  if (project.monoRepo.isNXStandalone) {
    return capCLIOpen(platform, project);
  }
  return `${npx(project)} nx run ${project.monoRepo.name}:open:${platform}`;
}

function checkAndroidStudioJDK(folder: string, project: Project): void {
  if (project.analyzer.isGreaterOrEqual('@capacitor/android', '5.0.0')) {
    if (existsSync(join(folder, 'android'))) {
      const ideaFolder = join(folder, 'android', '.idea');
      if (!existsSync(ideaFolder)) {
        mkdirSync(ideaFolder);
        writeFileSync(
          join(ideaFolder, 'compiler.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>
        <project version="4">
          <component name="CompilerConfiguration">
            <bytecodeTargetLevel target="17" />
          </component>
        </project>`,
        );
      }
    }
  }
}
