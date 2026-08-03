import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { capacitorSync } from '../build/capacitor-sync';
import { commandContext, installForceArgument, npmInstall, npmUpdate, saveDevArgument } from '../build/node-commands';
import { npx } from '../build/node-commands';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { checkPeerDependencies, RunCallback } from '../packages/peer-dependencies';
import { packageManagerName } from '../packages/mutate';
import { Project } from '../project/project';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { migration4To5 } from './versions-4-to-5';
import { migration5To6 } from './versions-5-to-6';
import { migration6To7 } from './versions-6-to-7';
import { migration7To8 } from './versions-7-to-8';

export interface CapacitorMigrationOptions {
  from: string;
  to: string;
  coreVersion: string;
  versionTitle: string;
  versionFull: string;
  changesLink: string;
  migrateInfo: string;
  androidStudioMin: string;
  androidStudioName: string;
  androidStudioReason: string;
  minJavaVersion: number;
  minPlugins: Array<{ dep: string; version: string }>;
  ignorePeerDependencies: string[];
}

export interface MigrationPlan {
  description: string;
  commands: string[];
  incompatible: string[];
  warnings: string[];
}

const ALL_MIGRATIONS = [migration4To5, migration5To6, migration6To7, migration7To8];

export function listCapacitorMigrations(project: Project): CapacitorMigrationOptions[] {
  if (!project.isCapacitor) return [];
  return ALL_MIGRATIONS.filter(
    (m) =>
      project.analyzer.isGreaterOrEqual('@capacitor/core', m.from) && project.analyzer.isLess('@capacitor/core', m.to),
  );
}

export function resolveCapacitorMigration(project: Project, targetMajor?: string): CapacitorMigrationOptions {
  const available = listCapacitorMigrations(project);
  if (available.length === 0) {
    throw new WnError('NOT_APPLICABLE', 'No Capacitor major migration applies to this project.', {
      exitCode: ExitCode.CommandFailed,
    });
  }
  if (targetMajor) {
    const match = available.find((m) => m.versionTitle === targetMajor || m.to.startsWith(`${targetMajor}.`));
    if (!match) {
      throw new WnError(
        'MISSING_INPUT',
        `Capacitor ${targetMajor} migration is not available from the current version.`,
        {
          exitCode: ExitCode.MissingInput,
          choices: available.map((m) => ({ id: m.versionTitle, name: `Capacitor ${m.versionTitle}` })),
          hint: 'Re-run with --to <major>',
        },
      );
    }
    return match;
  }
  return available[0];
}

export async function planCapacitorMigration(
  project: Project,
  options: CapacitorMigrationOptions,
  run: RunCallback,
): Promise<MigrationPlan> {
  const ctx = commandContext(project);
  const report = await checkPeerDependencies(
    project.projectFolder(),
    project,
    [{ name: '@capacitor/core', version: options.versionFull }],
    options.ignorePeerDependencies,
    run,
  );

  const commands: string[] = [...report.commands];
  for (const minVersion of options.minPlugins) {
    if (project.analyzer.exists(minVersion.dep) && project.analyzer.isLess(minVersion.dep, minVersion.version)) {
      commands.push(
        npmInstall(`${minVersion.dep}@${minVersion.version}`, ctx, installForceArgument(project.packageManager)),
      );
    }
  }

  const incompatible: string[] = [...report.incompatible];
  if (project.analyzer.exists('phonegap-plugin-barcodescanner')) {
    incompatible.push('phonegap-plugin-barcodescanner');
  }

  commands.push(
    npmInstall(
      `@capacitor/cli@${options.coreVersion}`,
      ctx,
      saveDevArgument(project.packageManager),
      installForceArgument(project.packageManager),
    ),
  );
  commands.push(`${npx(project)} cap migrate --noprompt --packagemanager=${packageManagerName(project)}`);

  return {
    description: options.migrateInfo,
    commands,
    incompatible,
    warnings: incompatible.length
      ? [`${incompatible.length} plugin(s) may be incompatible with Capacitor ${options.versionTitle}`]
      : [],
  };
}

export async function runCapacitorMigration(
  project: Project,
  plan: MigrationPlan,
  runCommand: (command: string) => Promise<string>,
): Promise<{ output: string; incompatible: string[] }> {
  let output = '';
  for (const command of plan.commands) {
    output += (await runCommand(command)) + '\n';
  }
  if (output.includes('[error] npm install failed. Try deleting node_modules')) {
    output +=
      (await runCommand(process.platform === 'win32' ? 'rmdir /s /q node_modules' : 'rm -rf node_modules')) + '\n';
    output += (await runCommand(npmUpdate(commandContext(project)))) + '\n';
  } else if (output.includes('Updating iOS native dependencies with pod install - failed!')) {
    const podfileLock = join(project.projectFolder(), 'ios', 'App', 'Podfile.lock');
    if (existsSync(podfileLock)) rmSync(podfileLock);
    const sync = capacitorSync(project);
    const syncCmd = typeof sync === 'string' ? sync : sync.command;
    output += (await runCommand(syncCmd)) + '\n';
  }
  return { output, incompatible: plan.incompatible };
}

export function listAllMigrations(project: Project): Array<{ id: string; title: string; applicable: boolean }> {
  const items: Array<{ id: string; title: string; applicable: boolean }> = [];
  for (const m of ALL_MIGRATIONS) {
    items.push({
      id: `capacitor-${m.versionTitle}`,
      title: `Migrate to Capacitor ${m.versionTitle}`,
      applicable:
        project.isCapacitor &&
        project.analyzer.isGreaterOrEqual('@capacitor/core', m.from) &&
        project.analyzer.isLess('@capacitor/core', m.to),
    });
  }
  items.push({
    id: 'angular',
    title: 'Migrate Angular to next major',
    applicable: project.analyzer.isGreaterOrEqual('@angular/core', '12.0.0'),
  });
  items.push({
    id: 'cordova',
    title: 'Convert Cordova project to Capacitor',
    applicable: project.isCordova && !project.isCapacitor,
  });
  items.push({
    id: 'spm',
    title: 'Migrate iOS from CocoaPods to Swift Package Manager',
    applicable: project.hasCapacitorProject(CapacitorPlatform.ios),
  });
  items.push({ id: 'package-manager', title: 'Convert package manager', applicable: true });
  return items;
}

function checkAndroidStudio(minVersion: string, project: Project): boolean {
  try {
    const studioFile = '/Applications/Android Studio.app/Contents/Resources/product-info.json';
    if (!existsSync(studioFile)) return true;
    const info = JSON.parse(readFileSync(studioFile, 'utf-8'));
    const v = info.buildNumber.split('.');
    const version = `${v[0]}.${v[1]}.${v[2]}`;
    return project.analyzer.isVersionGreaterOrEqual(version, minVersion);
  } catch {
    return true;
  }
}

export async function checkMigrationPreconditions(
  project: Project,
  options: CapacitorMigrationOptions,
): Promise<string[]> {
  const warnings: string[] = [];
  if (project.analyzer.exists('@capacitor/android') && !checkAndroidStudio(options.androidStudioMin, project)) {
    warnings.push(`${options.androidStudioName} is recommended for Capacitor ${options.versionTitle}`);
  }
  return warnings;
}
