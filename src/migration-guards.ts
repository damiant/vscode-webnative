import { existsSync } from 'fs';
import { join } from 'path';
import { commands, window } from 'vscode';
import { CommandName, InternalCommand } from './command-name';
import { npmInstallAll } from './node-commands';
import { removeNodeModules, runCommands } from './advanced-actions';
import { writeError } from './logging';
import { Project, inspectProject } from './project';
import { exState } from './tree-provider';
import { getRunOutput } from './utilities';

/**
 * Guards shared by the migrations that change the dependencies of a project (Angular, Ionic).
 * They stop a migration that cannot be run cleanly or that cannot be reverted.
 */

/**
 * Warns when the git repository has uncommitted changes so that the migration can be reverted.
 * @returns true when the migration can continue
 */
export async function confirmGitClean(project: Project): Promise<boolean> {
  if (!(await isGitDirty(project.folder))) {
    return true;
  }
  const result = await window.showWarningMessage(
    'Your git repository has uncommitted changes. Commit or stash them before migrating.',
    'Continue Anyway',
    'Cancel',
  );
  return result == 'Continue Anyway';
}

/**
 * Reinstalls node_modules when it is out of sync with package.json, which stops the package
 * manager commands of a migration from running.
 * @returns true when the dependencies are valid
 */
export async function ensureValidDependencies(project: Project): Promise<boolean> {
  const projectFolder = project.projectFolder();
  if (!existsSync(join(projectFolder, 'node_modules'))) {
    return true;
  }
  if (!(await hasInvalidDependencies(projectFolder))) {
    return true;
  }
  const result = await window.showWarningMessage(
    'node_modules is out of sync with package.json, which prevents the migration from running. Reinstall dependencies first?',
    'Reinstall',
    'Cancel',
  );
  if (result != 'Reinstall') {
    return false;
  }
  const repaired = await runCommands(
    [`${InternalCommand.cwd}${removeNodeModules()}`, `${InternalCommand.cwd}${npmInstallAll()}`],
    'Repairing node_modules',
    project,
  );
  if (!repaired) {
    return false;
  }
  if (await hasInvalidDependencies(projectFolder)) {
    writeError('Dependencies are still invalid after reinstall. Fix package.json and try again.');
    return false;
  }
  return true;
}

/**
 * Inspects the project again and refreshes the tree after a migration changed package.json.
 */
export async function refreshProject(project: Project): Promise<void> {
  if (exState.context) {
    await inspectProject(exState.rootFolder, exState.context, project.monoRepo?.name);
    await commands.executeCommand(CommandName.Refresh);
  }
}

async function isGitDirty(folder: string): Promise<boolean> {
  try {
    const status = await getRunOutput('git status --porcelain', folder, undefined, true);
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

async function hasInvalidDependencies(folder: string): Promise<boolean> {
  try {
    await getRunOutput('npm ls --depth=0', folder, undefined, true);
    return false;
  } catch {
    return true;
  }
}
