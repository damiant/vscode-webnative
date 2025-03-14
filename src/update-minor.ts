import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { clearOutput, writeError, writeIonic, writeWarning } from './logging';
import { PackageManager, npmInstall, npmInstallAll, outdatedCommand } from './node-commands';
import { NpmOutdatedDependency } from './npm-model';
import { Project } from './project';
import { getRunOutput, run, RunResults, showProgress } from './utilities';

import { fixYarnV1Outdated } from './monorepo';
import { OutputChannel, window } from 'vscode';
import { QueueFunction } from './tip';

export async function updateMinorDependencies(
  queueFunction: QueueFunction,
  project: Project,
  packages: object,
): Promise<void> {
  const channel = clearOutput();
  try {
    writeIonic(`Checking for minor updates for ${Object.keys(packages).length} dependencies`);
    const pkg = { dependencies: {}, name: 'tmp', license: 'MIT' };
    for (const library of Object.keys(packages).sort()) {
      pkg.dependencies[library] = `^${packages[library].version}`;
    }
    const tmpDir = mkdtempSync(join(tmpdir(), 'vscode.ionic.ext'));
    const tmpFile = join(tmpDir, 'package.json');
    writeFileSync(tmpFile, JSON.stringify(pkg, undefined, 2));
    let count = 0;
    let updates = [];
    await showProgress('Checking dependencies....', async () => {
      if (project.packageManager == PackageManager.yarn && project.isYarnV1()) {
        updates = await addForYarn(packages, tmpDir, channel);
      } else {
        updates = await addForPackageManager(project, packages, tmpDir, channel);
      }
      count = updates.length;

      rmSync(tmpFile);
    });

    if (count == 0) {
      const msg = 'All dependencies are on the latest minor update.';
      writeIonic(msg);
      window.showInformationMessage(msg, 'OK');
      return;
    }
    const result = await window.showInformationMessage(`Update all ${count} dependencies?`, 'Update', 'Cancel');
    if (!result || result == 'Cancel') return;

    let updated = 0;
    await showProgress('Updating Dependencies', async () => {
      queueFunction();
      for (const update of updates) {
        const cmd = npmInstall(`${update}`);
        channel.appendLine(`> ${cmd}`);
        if (!(await run2(project, cmd))) {
          channel.appendLine(`[Error] Failed to update ${update}`);
        } else {
          channel.appendLine(`Updated ${update}`);
          updated++;
        }
      }
      window.showInformationMessage(`${updated}/${count} Dependencies were updated.`, 'Ok');
    });
  } catch (error) {
    writeError(error);
  }
}

async function addForPackageManager(
  project: Project,
  packages: object,
  tmpDir: string,
  channel: OutputChannel,
): Promise<string[]> {
  let data = await getRunOutput(outdatedCommand(project), tmpDir, undefined, true);

  if (project.isYarnV1()) {
    data = fixYarnV1Outdated(data, project.packageManager);
  }
  if (project.isModernYarn()) {
    writeWarning(`This feature is not available with yarn ${project.yarnVersion}`);
    return [];
  }
  const updates = [];
  try {
    const out = JSON.parse(data);
    for (const library of Object.keys(packages).sort()) {
      const dep: NpmOutdatedDependency = out[library];
      if (dep && packages[library].version !== dep.wanted) {
        channel.appendLine(`${library} ${packages[library].version} → ${dep.wanted}`);
        updates.push(`${library}@${dep.wanted}`);
      }
    }
  } catch {
    writeError(`${outdatedCommand(project)} returned invalid json.`);
    writeError(data);
  }
  return updates;
}

async function addForYarn(packages: object, tmpDir: string, channel: OutputChannel): Promise<string[]> {
  writeIonic(`This may take a moment (as you are using yarn)`);
  await getRunOutput(npmInstallAll(), tmpDir);
  const data = await getRunOutput('yarn list --depth=0', tmpDir);
  const lines = data.split('\n');
  const updates = [];
  for (const line of lines) {
    if (line.startsWith('└─ ') || line.startsWith('├─ ')) {
      const kv = line.split('@');
      let dependency = kv[0];
      let version = kv[1];
      if (kv.length == 3) {
        dependency = `@${kv[1]}`;
        version = kv[2];
      }
      if (packages[dependency]) {
        if (packages[dependency].version !== version) {
          channel.appendLine(`${dependency} ${packages[dependency].version} → ${version}`);
          updates.push(`${dependency}@${version}`);
        }
      } else {
        // Yarn lists a lot of dependencies of dependencies even though depth is 0
      }
    }
  }
  return updates;
}

async function run2(project: Project, command: string): Promise<boolean> {
  const result: RunResults = { output: '', success: false };
  try {
    await run(project.projectFolder(), command, undefined, [], [], undefined, undefined, result, false);
    return result.success;
  } catch {
    return false;
  }
}
