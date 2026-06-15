import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { coerce } from 'semver';
import { window } from 'vscode';
import { write } from './logging';
import { DependencyVersion, PeerReport, checkPeerDependencies } from './peer-dependencies';
import { Project } from './project';
import { showProgress } from './utilities';

export interface PeerCleanupOptions {
  ignoreDeps?: string[];
}

export async function peerDependencyCleanup(project: Project, options?: PeerCleanupOptions): Promise<void> {
  const projectFolder = project.projectFolder();
  const list = getDependencyVersionsFromPackageJson(projectFolder);
  if (list.length == 0) {
    return;
  }

  let report: PeerReport;
  await showProgress(`Checking dependencies in your project...`, async () => {
    report = await checkPeerDependencies(projectFolder, list, options?.ignoreDeps ?? []);
  });
  //write(JSON.stringify(report, undefined, 2));
  if (report.commands.length == 0) {
    write(`There are no dependency conflicts.`);
    return;
  }
  write('');
  let question = 'Would you like to fix these?';
  if (report.commands.length == 1) {
    question = `Would you like to update ${report.dependencies[0].name}?`;
  }
  if (
    (await window.showWarningMessage(
      `There ${isAre(report.commands.length)} ${report.commands.length} dependency conflict${plural(
        report.commands.length,
      )} that can be resolved. ${question}`,
      'Yes',
      'No',
    )) != 'Yes'
  ) {
    return;
  }
  for (const cmd of report.commands) {
    write(`> ${cmd}`);
    await project.run2(cmd, true);
  }
  write(`${report.commands.length} dependency conflict${plural(report.commands.length)} resolved.`);
}

function isAre(count: number): string {
  return count == 1 ? 'is' : 'are';
}

function plural(count: number): string {
  return count > 1 ? 's' : '';
}

function getDependencyVersionsFromPackageJson(folder: string): DependencyVersion[] {
  const filename = join(folder, 'package.json');
  if (!existsSync(filename)) {
    return [];
  }
  try {
    const packageJson = JSON.parse(readFileSync(filename, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const list: DependencyVersion[] = [];
    for (const name of Object.keys(dependencies)) {
      const version = coerce(dependencies[name])?.version ?? dependencies[name];
      list.push({ name, version });
    }
    return list;
  } catch {
    return [];
  }
}
