import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { capacitorSync } from '../build/capacitor-sync';
import { findBestPluginVersion } from '../packages/peer-dependencies';
import { addPackageCommand, removePackageCommand } from '../packages/mutate';
import { RunCallback } from '../packages/minor';
import { Project } from '../project/project';
import { CommandResult } from '../build/command-result';

export interface PluginInstallPlan {
  install: CommandResult;
  sync?: CommandResult;
  packageSpec: string;
}

export async function planPluginInstall(
  plugin: string,
  project: Project,
  run: RunCallback,
  version?: string,
): Promise<PluginInstallPlan> {
  let packageSpec = plugin;
  if (version) {
    packageSpec = `${plugin}@${version}`;
  } else {
    const best = await findBestPluginVersion(plugin, project, run);
    if (best) packageSpec = best;
  }
  const plan: PluginInstallPlan = {
    install: addPackageCommand(project, packageSpec, { force: true }),
    packageSpec,
  };
  if (project.isCapacitor) plan.sync = capacitorSync(project);
  return plan;
}

export function planPluginRemove(
  plugin: string,
  project: Project,
  sync = true,
): { remove: CommandResult; sync?: CommandResult } {
  const result = { remove: removePackageCommand(project, plugin) as CommandResult };
  if (sync && project.isCapacitor) return { ...result, sync: capacitorSync(project) };
  return result;
}

export function hasEnterpriseAuth(projectFolder: string): boolean {
  const npmrc = join(projectFolder, '.npmrc');
  if (!existsSync(npmrc)) return false;
  const data = readFileSync(npmrc, 'utf-8');
  return data.includes('@ionic-enterprise') && data.includes('_authToken');
}

export function enterpriseRegisterCommand(key: string): string {
  return `npx ionic enterprise register --key=${key}`;
}
