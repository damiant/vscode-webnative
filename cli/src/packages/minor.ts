import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { commandContext, npmInstall, outdatedCommand, PackageManager } from '../build/node-commands';
import { fixYarnV1Outdated } from '../project/monorepo';
import { NpmOutdatedDependency } from '../project/npm-model';
import { Project } from '../project/project';

export type RunCallback = (command: string, folder: string) => Promise<string>;

export interface MinorUpdate {
  name: string;
  from: string;
  to: string;
  spec: string;
}

export async function findMinorUpdates(
  project: Project,
  packages: Record<string, { version: string }>,
  run: RunCallback,
): Promise<MinorUpdate[]> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'wn-minor-'));
  const tmpFile = join(tmpDir, 'package.json');
  const pkg = { dependencies: {} as Record<string, string>, name: 'tmp', license: 'MIT' };
  for (const library of Object.keys(packages).sort()) {
    pkg.dependencies[library] = `^${packages[library].version}`;
  }
  writeFileSync(tmpFile, JSON.stringify(pkg, undefined, 2));

  try {
    if (project.packageManager === PackageManager.yarn && project.isYarnV1()) {
      return await addForYarn(packages, tmpDir, run);
    }
    return await addForPackageManager(project, packages, tmpDir, run);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function addForPackageManager(
  project: Project,
  packages: Record<string, { version: string }>,
  tmpDir: string,
  run: RunCallback,
): Promise<MinorUpdate[]> {
  if (project.isModernYarn()) return [];
  let data = await run(outdatedCommand(project), tmpDir);
  if (project.isYarnV1()) {
    data = fixYarnV1Outdated(data, project.packageManager);
  }
  const updates: MinorUpdate[] = [];
  try {
    const out = JSON.parse(data);
    for (const library of Object.keys(packages).sort()) {
      const dep: NpmOutdatedDependency = out[library];
      if (dep && packages[library].version !== dep.wanted) {
        updates.push({
          name: library,
          from: packages[library].version,
          to: dep.wanted,
          spec: `${library}@${dep.wanted}`,
        });
      }
    }
  } catch {
    throw new Error(`${outdatedCommand(project)} returned invalid json`);
  }
  return updates;
}

async function addForYarn(
  packages: Record<string, { version: string }>,
  tmpDir: string,
  run: RunCallback,
): Promise<MinorUpdate[]> {
  await run('yarn install', tmpDir);
  const data = await run('yarn list --depth=0', tmpDir);
  const updates: MinorUpdate[] = [];
  for (const line of data.split('\n')) {
    if (!line.startsWith('└─ ') && !line.startsWith('├─ ')) continue;
    const kv = line.split('@');
    let dependency = kv[0].replace(/^[├└]─\s*/, '');
    let version = kv[1];
    if (kv.length === 3) {
      dependency = `@${kv[1]}`;
      version = kv[2];
    }
    if (packages[dependency] && packages[dependency].version !== version) {
      updates.push({
        name: dependency,
        from: packages[dependency].version,
        to: version,
        spec: `${dependency}@${version}`,
      });
    }
  }
  return updates;
}

export async function applyMinorUpdates(
  project: Project,
  updates: MinorUpdate[],
  runInstall: (spec: string) => Promise<void>,
): Promise<{ updated: string[]; failed: string[] }> {
  const updated: string[] = [];
  const failed: string[] = [];
  for (const update of updates) {
    try {
      await runInstall(update.spec);
      updated.push(update.name);
    } catch {
      failed.push(update.name);
    }
  }
  return { updated, failed };
}

export function packagesFromProject(project: Project): Record<string, { version: string }> {
  const deps = project.analyzer.getAllDependencies();
  const result: Record<string, { version: string }> = {};
  for (const [name, range] of Object.entries(deps)) {
    const version = project.analyzer.getPackageVersion(name)?.version ?? `${range}`;
    result[name] = { version };
  }
  return result;
}

export function installCommand(project: Project, spec: string): string {
  return npmInstall(spec, commandContext(project));
}
