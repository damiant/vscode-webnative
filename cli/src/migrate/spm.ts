import { existsSync } from 'fs';
import { join } from 'path';
import { npx } from '../build/node-commands';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { Project } from '../project/project';

export interface SpmMigrationPlan {
  command: string;
  docs: string;
}

export function planSpmMigration(project: Project): SpmMigrationPlan {
  if (!project.hasCapacitorProject(CapacitorPlatform.ios)) {
    throw new WnError('NOT_APPLICABLE', 'This project does not have an iOS Capacitor platform.', {
      exitCode: ExitCode.CommandFailed,
    });
  }
  const podfile = join(project.projectFolder(), 'ios', 'App', 'Podfile');
  if (!existsSync(podfile)) {
    throw new WnError('NOT_APPLICABLE', 'No Podfile found — this iOS project may already use SPM.', {
      exitCode: ExitCode.CommandFailed,
    });
  }
  return {
    command: `${npx(project)} cap spm-migration-assistant`,
    docs: 'https://capacitorjs.com/docs/ios/spm',
  };
}
