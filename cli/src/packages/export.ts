import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { coerce } from 'semver';
import { Project } from '../project/project';
import { getNpmInfo } from './npm-info';

export interface ExportPackageInfo {
  name: string;
  version: string;
  latest?: string;
  depType?: string;
  current?: boolean;
}

export interface ExportResult {
  filename: string;
  markdown: string;
  score: { good: number; total: number };
}

export async function exportProjectSummary(
  project: Project,
  packages: Record<string, ExportPackageInfo>,
): Promise<ExportResult> {
  const folder = project.projectFolder();
  let txt = '';
  let total = 0;
  let good = 0;

  for (const libType of ['Capacitor Plugin', 'Plugin', 'Dependency']) {
    txt += `## ${plural(libType)}\n\n`;
    for (const library of Object.keys(packages).sort()) {
      const pkg = packages[library];
      if (pkg.depType !== libType) continue;

      let lastReleased = 0;
      let link: string | undefined;
      let message: string | undefined;
      const isCustom = pkg.latest === '[custom]';
      let point = '🟩';

      if (!isCustom) {
        try {
          const npmInfo = await getNpmInfo(library, false);
          const keys = Object.keys(npmInfo.time ?? {});
          const modified = npmInfo.time?.[keys[keys.length - 1]];
          if (modified) lastReleased = daysAgo(new Date(modified));
          link = cleanLink(npmInfo.repository?.url);
        } catch {
          point = '🟧';
          message = 'Unable to find information on npm.';
        }
      }

      if (lastReleased > 730) {
        point = '🟥';
        message = `Unmaintained (${timePeriod(lastReleased)} since last release)`;
      } else if (lastReleased > 365) {
        point = '🟧';
        message = `May be unmaintained (${timePeriod(lastReleased)} since last release)`;
      }

      if (isCustom) {
        point = '🟧';
        message = 'Requires manual developer maintenance as it is custom / forked.';
      }

      if (!isCustom) {
        const current = coerce(pkg.version);
        const latest = coerce(pkg.latest);
        if (current && latest && latest.major - current.major >= 1) {
          point = '🟧';
          const count = latest.major - current.major;
          message = `Is behind ${count} major version${count > 1 ? 's' : ''}.`;
        }
      }

      if (library.startsWith('@ionic-native/')) {
        point = '🟧';
        message = 'Is deprecated and replaced with @awesome-cordova-plugins.';
      }

      let name = library;
      if (!isCustom) name += `@${pkg.version}`;
      if (link) name = `[${name}](${link})`;

      txt += `- ${point} ${name}`;
      if (pkg.current) txt += ` - (Latest ${pkg.latest})`;
      if (message) txt += ` - ${message}`;
      txt += '\n';

      if (point === '🟩') good++;
      total++;
    }
  }

  txt += `### Maintenance Score\n`;
  txt += `${good} out of ${total} dependencies were up to date without issues.\n\n`;
  txt += exportNamingStyles(folder);

  const filename = join(folder, 'project-summary.md');
  writeFileSync(filename, txt);
  return { filename, markdown: txt, score: { good, total } };
}

function plural(word: string): string {
  return word.endsWith('y') ? word.slice(0, -1) + 'ies' : word + 's';
}

function timePeriod(days: number): string {
  if (days < 365) return `${days} days`;
  return `${Math.round((days / 365) * 10) / 10} years`;
}

function daysAgo(d: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((Date.now() - d.getTime()) / oneDay));
}

function cleanLink(url?: string): string | undefined {
  if (!url) return undefined;
  return url
    .replace('git+ssh://git@', 'https://')
    .replace('git://github.com/', 'https://github.com/')
    .replace('git+https://', 'https://')
    .replace('git://', '');
}

function exportNamingStyles(folder: string): string {
  const filenames: string[] = [];
  const baseFolder = join(folder, 'src');
  getAllFiles(baseFolder, filenames);
  let txt = '\n\n## Nonstandard naming\n';
  txt += 'The following files and folders do not follow the standard naming convention:\n\n';
  for (const filename of filenames) {
    const name = filename.replace(baseFolder, '');
    if (name.toLowerCase() !== name) txt += `- ${name}\n`;
  }
  return txt;
}

function getAllFiles(folder: string, arrayOfFiles: string[]): void {
  if (!existsSync(folder)) return;
  for (const file of readdirSync(folder)) {
    const full = join(folder, file);
    if (statSync(full).isDirectory()) getAllFiles(full, arrayOfFiles);
    else arrayOfFiles.push(full);
  }
}

export function packagesForExport(project: Project): Record<string, ExportPackageInfo> {
  const deps = project.analyzer.getAllDependencies();
  const result: Record<string, ExportPackageInfo> = {};
  for (const [name, range] of Object.entries(deps)) {
    const version = project.analyzer.getPackageVersion(name)?.version ?? `${range}`;
    const depType = classifyPackage(name, project);
    result[name] = {
      name,
      version,
      latest: version,
      depType,
      current: true,
    };
  }
  return result;
}

function classifyPackage(name: string, project: Project): string {
  if (name.startsWith('@capacitor/') && name !== '@capacitor/core' && name !== '@capacitor/cli') {
    return 'Capacitor Plugin';
  }
  if (project.isCordova && (name.startsWith('cordova-') || name.startsWith('@ionic-native/'))) {
    return 'Plugin';
  }
  return 'Dependency';
}
