import { dirname, join } from 'path';
import { writeError } from './logging';
import { ionicState } from './wn-tree-provider';
import { MonoRepoProject } from './monorepo';
import { Project } from './project';
import { stripJsonComments } from './strip-json-comments';
import { existsSync, readFileSync, readdirSync } from 'fs';

export interface NXWorkspace {
  projects: object;
}

let nxProjectFolder: string = undefined;
/**
 * NX creates a workspace.json file containing the list of projects
 * This function returns it as a list
 * @param  {Project} project
 * @returns Array
 */
export async function getNXProjects(project: Project): Promise<Array<MonoRepoProject>> {
  // Do we return the list of projects we've already cached
  if (ionicState.projects?.length > 0 && nxProjectFolder == project.folder) {
    return ionicState.projects;
  }

  const filename = join(project.folder, 'workspace.json');
  let result: Array<MonoRepoProject> = [];
  if (existsSync(filename)) {
    result = getNXProjectFromWorkspaceJson(filename);
  } else {
    result = await getNXProjectsFromNX(project);
    if (result.length == 0) {
      result = getNXProjectsByFolder(project);
    }
  }
  nxProjectFolder = project.folder;
  return result;
}

// npx nx print-affected --type=app --all
async function getNXProjectsFromNX(project: Project): Promise<MonoRepoProject[]> {
  try {
    const result: MonoRepoProject[] = [];
    const projects = listProjects(project.folder);
    for (const prj of projects) {
      try {
        const txt = readFileSync(prj, 'utf-8');
        const p = JSON.parse(stripJsonComments(txt));
        if (p.name && p.projectType == 'application') {
          result.push({ name: p.name, folder: dirname(prj) });
        }
      } catch (err) {
        writeError(`Error in project ${prj}: ${err}`);
      }
    }
    return result;
  } catch (error) {
    console.error(error);
    return [];
  }
}

function listProjects(folder: string): string[] {
  const result = [];
  const files = readdirSync(folder, { withFileTypes: true });
  for (const file of files) {
    const skip = file.name == 'node_modules' || file.name.startsWith('.') || file.name.endsWith('.ts');
    if (!skip) {
      if (file.isDirectory()) {
        for (const prj of listProjects(join(folder, file.name))) {
          result.push(prj);
        }
      } else if (file.name.toLowerCase() == 'project.json') {
        result.push(join(folder, file.name));
      }
    }
  }
  return result;
}

function getNXProjectFromWorkspaceJson(filename: string): MonoRepoProject[] {
  const result: Array<MonoRepoProject> = [];
  const txt = readFileSync(filename, 'utf-8');
  const projects = JSON.parse(txt).projects;
  for (const prj of Object.keys(projects)) {
    let folder = projects[prj];
    if (folder?.root) {
      // NX project can be a folder or an object with a root property specifying the folder
      folder = folder.root;
    }
    result.push({ name: prj, folder: folder });
  }
  return result;
}

function getNXProjectsByFolder(project: Project): MonoRepoProject[] {
  const result: Array<MonoRepoProject> = [];
  // workspace.json is optional. Just iterate through apps folder
  const folder = join(project.folder, 'apps');
  if (existsSync(folder)) {
    const list = readdirSync(folder, { withFileTypes: true });
    for (const item of list) {
      if (item.isDirectory && !item.name.startsWith('.')) {
        result.push({ name: item.name, folder: join(folder, item.name) });
      }
    }
    return result;
  }
}
