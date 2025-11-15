import * as globule from 'globule';

import { MonoRepoProject } from './monorepo';
import { replaceAll } from './utilities';
import { Project } from './project';
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';

export function getPnpmWorkspaces(project: Project): Array<MonoRepoProject> {
  const pw = join(project.folder, 'pnpm-workspace.yaml');
  if (!existsSync(pw)) {
    return [];
  }
  const yaml = readFileSync(pw, { encoding: 'utf8' });
  try {
    const list = [];
    for (const line of yaml.split('\n')) {
      if (line.trim().startsWith('-')) {
        let folder = line.replace('-', '').trim();
        folder = replaceAll(folder, '"', '');
        folder = replaceAll(folder, `'`, '');
        list.push(folder);
        // packages/*
        // '.'
        // */**
        // '!devtool/**'
        // '!docs/**'
        // '!examples/**'
      }
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
