import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { stripJsonComments } from './strip-json-comments';
import { write } from './logging';
import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { isGreaterOrEqual } from './analyzer';

interface CompilerOptions {
  baseUrl?: string;
  downlevelIteration?: boolean;
  paths?: Record<string, string[]>;
  [key: string]: unknown;
}

interface TsConfig {
  extends?: string;
  compilerOptions?: CompilerOptions;
  [key: string]: unknown;
}

interface AngularProject {
  root?: string;
  architect?: Record<string, { options?: { tsConfig?: string } }>;
}

export function joinBaseUrlPath(baseUrl: string, pathValue: string): string {
  if (pathValue.startsWith('./') || pathValue.startsWith('../')) {
    return pathValue;
  }
  const base = baseUrl.replace(/\/$/, '') || '.';
  if (base === '.' || base === './') {
    return pathValue.startsWith('.') ? pathValue : `./${pathValue}`;
  }
  const combined = `${base}/${pathValue}`.replace(/\/+/g, '/');
  return combined.startsWith('.') ? combined : `./${combined}`;
}

export function hasDeprecatedCompilerOptions(compilerOptions?: CompilerOptions): boolean {
  if (!compilerOptions) {
    return false;
  }
  return compilerOptions.baseUrl !== undefined || compilerOptions.downlevelIteration !== undefined;
}

export function migrateCompilerOptions(compilerOptions: CompilerOptions): boolean {
  let changed = false;

  if (compilerOptions.downlevelIteration !== undefined) {
    delete compilerOptions.downlevelIteration;
    changed = true;
  }

  const baseUrl = compilerOptions.baseUrl;
  if (baseUrl !== undefined) {
    if (compilerOptions.paths) {
      const newPaths: Record<string, string[]> = {};
      for (const [key, values] of Object.entries(compilerOptions.paths)) {
        newPaths[key] = values.map((value) => joinBaseUrlPath(baseUrl, value));
      }
      compilerOptions.paths = newPaths;
    }
    delete compilerOptions.baseUrl;
    changed = true;
  }

  return changed;
}

function readTsconfig(filename: string): TsConfig | undefined {
  if (!existsSync(filename)) {
    return undefined;
  }
  try {
    return JSON.parse(stripJsonComments(readFileSync(filename, 'utf8')));
  } catch {
    return undefined;
  }
}

function resolveTsconfigPath(fromFile: string, extendsPath: string): string {
  let resolved = resolve(dirname(fromFile), extendsPath);
  if (!existsSync(resolved) && !resolved.endsWith('.json')) {
    const withJson = `${resolved}.json`;
    if (existsSync(withJson)) {
      resolved = withJson;
    }
  }
  return resolved;
}

export function collectTsconfigSearchDirs(project: Project): string[] {
  const projectFolder = project.projectFolder();
  const repoRoot = project.folder;
  const dirs = [projectFolder];

  const parent = dirname(projectFolder);
  if (parent !== projectFolder && !dirs.includes(parent)) {
    dirs.push(parent);
  }

  if (repoRoot !== projectFolder && !dirs.includes(repoRoot)) {
    dirs.push(repoRoot);
  }

  return dirs;
}

function collectTsconfigFilesInDir(folder: string, files: Set<string>): void {
  if (!existsSync(folder)) {
    return;
  }
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith('tsconfig') && entry.name.endsWith('.json')) {
      files.add(join(folder, entry.name));
    }
  }
}

function collectExtendedTsconfigs(filename: string, files: Set<string>): void {
  const tsconfig = readTsconfig(filename);
  const extendsPath = tsconfig?.extends;
  if (typeof extendsPath !== 'string') {
    return;
  }
  const parent = resolveTsconfigPath(filename, extendsPath);
  if (!files.has(parent)) {
    files.add(parent);
    collectExtendedTsconfigs(parent, files);
  }
}

function findAngularJsonPaths(project: Project): string[] {
  const paths: string[] = [];
  for (const candidate of [join(project.projectFolder(), 'angular.json'), join(project.folder, 'angular.json')]) {
    if (existsSync(candidate) && !paths.includes(candidate)) {
      paths.push(candidate);
    }
  }
  return paths;
}

function collectTsconfigFromAngularJson(angularJsonPath: string, files: Set<string>, projectName?: string): void {
  const angular = readTsconfig(angularJsonPath) as { projects?: Record<string, AngularProject> } | undefined;
  if (!angular?.projects) {
    return;
  }
  const angularDir = dirname(angularJsonPath);
  const projects =
    projectName && angular.projects[projectName] ? { [projectName]: angular.projects[projectName] } : angular.projects;

  for (const prj of Object.values(projects)) {
    const projectRoot = join(angularDir, prj.root ?? '');
    for (const target of Object.values(prj.architect ?? {})) {
      const tsConfig = target.options?.tsConfig;
      if (typeof tsConfig === 'string') {
        files.add(resolve(projectRoot, tsConfig));
      }
    }
  }
}

function collectAllTsconfigFiles(project: Project): Set<string> {
  const files = new Set<string>();

  for (const folder of collectTsconfigSearchDirs(project)) {
    collectTsconfigFilesInDir(folder, files);
  }
  for (const angularJson of findAngularJsonPaths(project)) {
    collectTsconfigFromAngularJson(angularJson, files, project.monoRepo?.name);
  }

  for (const file of [...files]) {
    collectExtendedTsconfigs(file, files);
  }

  return files;
}

function fixTsconfigFile(filename: string): boolean {
  if (!existsSync(filename)) {
    return false;
  }
  const before = readFileSync(filename, 'utf8');
  const tsconfig = readTsconfig(filename);
  if (!tsconfig?.compilerOptions || !migrateCompilerOptions(tsconfig.compilerOptions)) {
    return false;
  }

  const commentMatch = before.match(/^\/\*[\s\S]*?\*\/\s*\n/);
  const header = commentMatch ? commentMatch[0] : '';
  writeFileSync(filename, `${header}${JSON.stringify(tsconfig, null, 2)}\n`);
  write(`Updated ${filename} to remove deprecated TypeScript compiler options.`);
  return true;
}

export function hasDeprecatedTsconfigInProject(project: Project): boolean {
  for (const file of collectAllTsconfigFiles(project)) {
    const tsconfig = readTsconfig(file);
    if (hasDeprecatedCompilerOptions(tsconfig?.compilerOptions)) {
      return true;
    }
  }
  return false;
}

export function fixDeprecatedTsconfigOptions(project: Project): void {
  for (const file of collectAllTsconfigFiles(project)) {
    fixTsconfigFile(file);
  }
}

export function addDeprecatedTsconfigRecommendation(project: Project): void {
  if (!isGreaterOrEqual('@angular/core', '12.0.0')) {
    return;
  }
  if (!hasDeprecatedTsconfigInProject(project)) {
    return;
  }
  project.add(
    new Tip(
      'Fix deprecated TypeScript compiler options',
      'Remove baseUrl and downlevelIteration from tsconfig files for TypeScript 5.9+ compatibility',
      TipType.Error,
    ).setQueuedAction(fixDeprecatedTsconfig, project),
  );
}

function fixDeprecatedTsconfig(queueFunction: QueueFunction, project: Project): Promise<void> {
  queueFunction();
  fixDeprecatedTsconfigOptions(project);
  return Promise.resolve();
}
