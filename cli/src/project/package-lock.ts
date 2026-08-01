import { join } from 'path';
import { Project } from './project';
import { PackageManager } from '../build/node-commands';
import { existsSync, readFileSync } from 'fs';
import { NpmPackage } from './npm-model';

export function hasPackageLock(project: Project): boolean {
  return existsSync(join(project.projectFolder(), 'package-lock.json'));
}

export function getVersionsFromPackageLock(project: Project): NpmPackage | undefined {
  if (project.packageManager != PackageManager.npm) return undefined;
  const lockFile = join(project.projectFolder(), 'package-lock.json');
  if (!existsSync(lockFile)) return undefined;
  const txt = readFileSync(lockFile, { encoding: 'utf8' });
  const data = JSON.parse(txt);
  const result: Record<string, { version: string }> = {};
  try {
    const packages = data.packages[''];
    for (const dep of [...Object.keys(packages.dependencies), ...Object.keys(packages.devDependencies)]) {
      const name = `node_modules/${dep}`;
      result[dep] = { version: data.packages[name].version };
    }
    return { name: project.name, version: '0.0.0', dependencies: result };
  } catch {
    return undefined;
  }
}
