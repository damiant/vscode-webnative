import * as globule from 'globule';

import { MonoRepoProject } from './monorepo';
import { Project } from './project';
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';

export function getLernaWorkspaces(project: Project): Array<MonoRepoProject> {
  const lernaFile = join(project.folder, 'lerna.json');
  if (!existsSync(lernaFile)) {
    return [];
  }

  try {
    const json = readFileSync(lernaFile, { encoding: 'utf8' });
    const lerna = JSON.parse(json);
    const list = [];
    for (const folder of lerna.packages) {
      list.push(folder);
    }
    const folders = globule.find({ src: list, srcBase: project.folder });
    const repos: Array<MonoRepoProject> = [];
    for (const folder of folders) {
      repos.push({ folder: join(project.folder, folder), name: basename(folder) });
    }
    return repos;
  } catch (err) {
    console.error(err);
    return [];
  }
}
