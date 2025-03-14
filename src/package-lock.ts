import { join } from 'path';
import { Project } from './project';
import { PackageManager } from './node-commands';
import { existsSync, readFileSync } from 'fs';
import { tEnd, tStart } from './utilities';
import { NpmPackage } from './npm-model';

export function getVersionsFromPackageLock(project: Project): NpmPackage {
  if (project.packageManager != PackageManager.npm) return undefined;
  const lockFile = join(project.projectFolder(), 'package-lock.json');
  if (!existsSync(lockFile)) return undefined;
  const command = `getVersionsFromPackageLock`;
  tStart(command);
  const txt = readFileSync(lockFile, { encoding: 'utf8' });
  const data = JSON.parse(txt);
  const result = {};
  try {
    const packages = data.packages[''];
    for (const dep of [...Object.keys(packages.dependencies), ...Object.keys(packages.devDependencies)]) {
      const name = `node_modules/${dep}`;
      result[dep] = { version: data.packages[name].version };
    }
    tEnd(command);
    return { name: project.name, version: '0.0.0', dependencies: result };
  } catch {
    return undefined;
  }
}
