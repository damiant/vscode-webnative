import { Project } from './project';
import { MonoRepoType } from './monorepo';
import { isGreaterOrEqual } from './analyzer';
import { CapacitorPlatform } from './capacitor-platform';
import { InternalCommand } from './command-name';
import { useIonicCLI } from './capacitor-run';
import { npx, PackageManager } from './node-commands';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Capacitor open command
 * @param  {Project} project
 * @param  {CapacitorPlatform} platform ios or android
 * @returns string
 */
export async function capacitorOpen(project: Project, platform: CapacitorPlatform): Promise<string> {
  const ionicCLI = useIonicCLI();

  if (platform == CapacitorPlatform.android) {
    checkAndroidStudioJDK(project.projectFolder());
  }
  switch (project.repoType) {
    case MonoRepoType.none:
      return ionicCLI ? ionicCLIOpen(platform, project) : capCLIOpen(platform, project);
    case MonoRepoType.folder:
    case MonoRepoType.pnpm:
    case MonoRepoType.yarn:
    case MonoRepoType.lerna:
    case MonoRepoType.npm:
      return InternalCommand.cwd + (ionicCLI ? ionicCLIOpen(platform, project) : capCLIOpen(platform, project));
    case MonoRepoType.nx:
      return nxOpen(project, platform);
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

// This will create the default files that specify the JDK version to use for a project that has never been opened in Android Studio
function checkAndroidStudioJDK(folder: string): void {
  if (isGreaterOrEqual('@capacitor/android', '5.0.0')) {
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
