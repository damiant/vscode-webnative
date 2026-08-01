import { npx, npmInstall, npmUninstall, commandContext } from '../build/node-commands';
import { capacitorAdd } from '../build/capacitor-add';
import { commandString } from '../build/command-result';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { Project } from '../project/project';
import { InternalCommand } from '../build/command-name';

export interface CordovaMigrationPlan {
  integrate: string[];
  remove?: string[];
  notes: string[];
}

export function planCordovaMigration(project: Project): CordovaMigrationPlan {
  if (project.isCapacitor) {
    throw new WnError('NOT_APPLICABLE', 'This project already uses Capacitor.', { exitCode: ExitCode.CommandFailed });
  }
  if (!project.isCordova) {
    throw new WnError('NOT_APPLICABLE', 'This project is not a Cordova project.', { exitCode: ExitCode.CommandFailed });
  }

  const appId = asAppId(project.name);
  const ctx = commandContext(project);
  const integrate = [
    npmInstall('@capacitor/core@latest', ctx, '--save', '-E'),
    npmInstall('@capacitor/cli@latest', ctx, '-D', '-E'),
    npmInstall('@capacitor/app @capacitor/core @capacitor/haptics @capacitor/keyboard @capacitor/status-bar', ctx),
    `${npx(project)} capacitor init "${project.name}" "${appId}" --web-dir www`,
  ];
  return {
    integrate,
    notes: [
      'Review Cordova plugin compatibility before removing Cordova.',
      'Add native platforms with: wn native add ios / wn native add android',
      'See https://capacitorjs.com/docs/cordova/migrating-from-cordova-to-capacitor',
    ],
  };
}

export function planCordovaRemoval(project: Project): CordovaMigrationPlan {
  const ctx = commandContext(project);
  const movecmd = process.platform === 'win32' ? 'rename config.xml config.xml.bak' : 'mv config.xml config.xml.bak';
  return {
    integrate: [],
    remove: [
      npmUninstall('cordova-ios', ctx),
      npmUninstall('cordova-android', ctx),
      movecmd,
      InternalCommand.removeCordova,
    ],
    notes: ['Remove Cordova only after verifying the Capacitor app runs on all target platforms.'],
  };
}

export function planAddNativePlatforms(project: Project): string[] {
  const ctx = commandContext(project);
  const commands: string[] = [];
  if (!project.hasCapacitorProject(CapacitorPlatform.android)) {
    commands.push(npmInstall('@capacitor/android', ctx));
    commands.push(commandString(capacitorAdd(project, CapacitorPlatform.android)));
  }
  if (!project.hasCapacitorProject(CapacitorPlatform.ios)) {
    commands.push(npmInstall('@capacitor/ios', ctx));
    commands.push(commandString(capacitorAdd(project, CapacitorPlatform.ios)));
  }
  return commands;
}

function asAppId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `com.example.${slug || 'app'}`;
}
