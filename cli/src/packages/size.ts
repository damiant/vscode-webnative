import { basename, extname, join } from 'path';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { build } from '../build/build';
import { MonoRepoType } from '../project/monorepo';
import { Project } from '../project/project';
import { stripJsonPrefix } from '../commands/helpers';

export interface FileInfo {
  name: string;
  path: string;
  type: string;
  size: number;
  bundlename: string;
  filename: string;
}

export interface SizeAnalysis {
  bundles: FileInfo[];
  assets: FileInfo[];
  groups: Record<string, { total: number; count: number; files: string[] }>;
}

export type RunCallback = (command: string, cwd: string) => Promise<string>;

export async function analyzeBundleSize(project: Project, run: RunCallback): Promise<SizeAnalysis> {
  const dist = project.getDistFolder();
  const previousValue = enableSourceMaps(project);
  try {
    let args = '';
    if (project.repoType === MonoRepoType.nx || project.frameworkType?.startsWith('angular')) {
      args = '--configuration=production';
    }
    const buildCmd = build(project, { arguments: args, sourceMaps: true });
    const cmd = typeof buildCmd === 'string' ? buildCmd : buildCmd.command;
    const cwd = typeof buildCmd === 'string' ? project.projectFolder() : buildCmd.cwd;
    const bumpSize = process.platform !== 'win32' ? 'export NODE_OPTIONS="--max-old-space-size=8192" && ' : '';
    await run(`${bumpSize}${cmd}`, cwd);

    const explorerCmd = `npx source-map-explorer "${dist}/**/*.js" --json --exclude-source-map`;
    const output = await run(explorerCmd, project.projectFolder());
    const bundles = analyzeBundles(stripJsonPrefix(output, '{'));
    const assets = analyzeAssets(dist, project.projectFolder());
    return { bundles, assets, groups: groupTotals([...bundles, ...assets]) };
  } finally {
    revertSourceMaps(project, previousValue);
  }
}

function enableSourceMaps(project: Project): string | undefined {
  let filename = join(project.folder, 'angular.json');
  if (!existsSync(filename)) filename = join(project.projectFolder(), 'project.json');
  if (!existsSync(filename)) return undefined;
  const json = readFileSync(filename, 'utf-8');
  const config = JSON.parse(json);
  const projects = config.projects ?? { app: config };
  let changeMade = false;
  for (const prj of Object.keys(projects)) {
    const cfg = projects[prj].architect ?? projects[prj].targets;
    if (cfg?.build?.configurations?.production?.sourceMap !== true) {
      cfg.build.configurations.production.sourceMap = true;
      changeMade = true;
    }
  }
  if (changeMade) {
    writeFileSync(filename, JSON.stringify(config, null, 2));
    return json;
  }
  return undefined;
}

function revertSourceMaps(project: Project, previousValue?: string): void {
  if (!previousValue) return;
  let filename = join(project.folder, 'angular.json');
  if (!existsSync(filename)) filename = join(project.projectFolder(), 'project.json');
  if (existsSync(filename)) writeFileSync(filename, previousValue, 'utf-8');
}

function analyzeBundles(json: string): FileInfo[] {
  const data = JSON.parse(json);
  const ignoreList = ['[EOLs]'];
  const files: FileInfo[] = [];
  for (const result of data.results ?? []) {
    for (const key of Object.keys(result.files ?? {})) {
      if (!ignoreList.includes(key)) {
        files.push(getInfo(key, result.files[key].size, result.bundleName));
      }
    }
  }
  return files;
}

function analyzeAssets(distFolder: string, prjFolder: string): FileInfo[] {
  const files = getAllFiles(distFolder);
  const excluded = ['.js', '.map'];
  const result: FileInfo[] = [];
  for (const file of files) {
    const ext = extname(file);
    if (excluded.includes(ext)) continue;
    result.push({
      name: basename(file),
      path: file,
      bundlename: file,
      type: assetType(ext),
      size: statSync(file).size,
      filename: file.replace(prjFolder, ''),
    });
  }
  return result;
}

function groupTotals(files: FileInfo[]): Record<string, { total: number; count: number; files: string[] }> {
  const groups: Record<string, { total: number; count: number; files: string[] }> = {};
  for (const file of files) {
    if (!groups[file.type]) groups[file.type] = { total: 0, count: 0, files: [] };
    groups[file.type].total += file.size;
    groups[file.type].count += 1;
    if (!groups[file.type].files.includes(file.bundlename)) groups[file.type].files.push(file.bundlename);
  }
  return groups;
}

function getInfo(fullname: string, size: number, bundlename: string): FileInfo {
  let name = fullname;
  let type = friendlyType(fullname);
  try {
    const url = new URL(fullname);
    name = url.pathname;
    type = friendlyType(name);
  } catch {
    if (fullname.startsWith('../node_modules')) name = fullname.replace('../node_modules', '/node_modules');
  }
  return { name: friendlyName(name), type, path: fullname, size, bundlename, filename: name };
}

function friendlyName(name: string): string {
  return name.replace(/[-_/]/g, ' ').trim() || name;
}

function friendlyType(name: string): string {
  if (name.includes('polyfills')) return 'Polyfills';
  if (name.startsWith('/node_modules/') || name.includes('node_modules')) return '3rd Party';
  if (name === '[unmapped]' || name === '[no source]') return 'Without Source Code';
  return 'Your Code';
}

function assetType(ext: string): string {
  switch (ext) {
    case '.png':
    case '.jpg':
    case '.gif':
    case '.jpeg':
      return 'Images';
    case '.svg':
      return 'Vector Images';
    case '.woff':
    case '.woff2':
    case '.eot':
    case '.ttf':
      return 'Fonts';
    case '.css':
      return 'Style Sheets';
    default:
      return 'Other';
  }
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!existsSync(dirPath)) return arrayOfFiles;
  for (const file of readdirSync(dirPath)) {
    const full = join(dirPath, file);
    if (statSync(full).isDirectory()) getAllFiles(full, arrayOfFiles);
    else arrayOfFiles.push(full);
  }
  return arrayOfFiles;
}
