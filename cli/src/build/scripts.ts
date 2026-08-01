import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { commandContext, npmRun } from './node-commands';

export interface ScriptEntry {
  name: string;
  command: string;
  description?: string;
}

function toTitleCase(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function niceName(name: string): string {
  return toTitleCase(name.replace(/-/g, ' '));
}

function readPackageJSON(folder: string): Record<string, any> {
  const filename = join(folder, 'package.json');
  if (!existsSync(filename)) return {};
  try {
    return JSON.parse(readFileSync(filename, 'utf8'));
  } catch {
    return {};
  }
}

/** List npm scripts from package.json as runnable commands. */
export function listScripts(project: Project, isWeb = false): ScriptEntry[] {
  const entries: ScriptEntry[] = [];
  const ctx = commandContext(project);
  const expand = !(
    project.analyzer.exists('@capacitor/core') ||
    project.analyzer.exists('cordova-ios') ||
    project.analyzer.exists('cordova-android') ||
    isWeb
  );

  if (!expand && !isWeb) {
    // Still return scripts when explicitly requested
  }

  addScriptsFrom(readPackageJSON(project.projectFolder()), ctx, entries);

  if (project.repoType === MonoRepoType.nx) {
    addScriptsFrom(readPackageJSON(project.folder), ctx, entries);
    addNXScripts(['build', 'test', 'lint', 'e2e'], project, entries);
  }

  return entries;
}

function addScriptsFrom(
  packages: Record<string, any>,
  ctx: ReturnType<typeof commandContext>,
  entries: ScriptEntry[],
): void {
  if (packages.scripts) {
    for (const script of Object.keys(packages.scripts)) {
      entries.push({
        name: niceName(script),
        command: npmRun(script, ctx),
        description: `Runs 'npm run ${script}' found in package.json`,
      });
    }
  }
}

function addNXScripts(names: string[], project: Project, entries: ScriptEntry[]): void {
  for (const name of names) {
    entries.push({
      name: `${project.monoRepo.name} ${name}`,
      command: `npx nx run ${project.monoRepo.name}:${name}`,
      description: `Runs nx ${name} for ${project.monoRepo.name}`,
    });
  }
}

/** Whether the project looks like a Capacitor plugin (has native platform keys in package.json). */
export function isCapacitorPlugin(project: Project): boolean {
  const packages = readPackageJSON(project.projectFolder());
  return !!(packages.capacitor?.ios || packages.capacitor?.android);
}
