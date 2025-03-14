import * as globule from 'globule';

import { MonoRepoProject } from './monorepo';
import { Project } from './project';
import { basename, join } from 'path';

/**
 * Get mono repo project list when using npm workspaces
 * @param  {Project} project
 * @returns Array of Mono Repo Projects
 */
export function getNpmWorkspaceProjects(project: Project): Array<MonoRepoProject> {
  const result: Array<MonoRepoProject> = [];
  const folders = globule.find({ src: project.workspaces, srcBase: project.folder });
  for (const folder of folders) {
    result.push({ name: basename(folder), folder: join(project.folder, folder) });
  }
  return result;
}
