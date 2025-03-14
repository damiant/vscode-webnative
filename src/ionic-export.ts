import { inspectProject, Project, ProjectSummary } from './project';
import { coerce } from 'semver';
import { writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { PackageInfo } from './package-info';
import { getStringFrom, plural } from './utilities';
import { Recommendation } from './recommendation';
import { ExtensionContext, window } from 'vscode';
import { QueueFunction } from './tip';
import { getNpmInfo } from './npm-info';
import { write, writeError } from './logging';

export async function ionicExport(
  queueFunction: QueueFunction,
  project: Project,
  context: ExtensionContext,
): Promise<void> {
  queueFunction();
  let folder = project.projectFolder();
  if (project.monoRepo?.nodeModulesAtRoot) {
    folder = project.folder;
  }
  const summary: ProjectSummary = await inspectProject(folder, context, undefined);
  let txt = '';
  let total = 0;
  let good = 0;
  for (const libType of ['Capacitor Plugin', 'Plugin', 'Dependency']) {
    let lastScope = '';

    txt += `## ${plural(libType)}\n\n`;

    for (const library of Object.keys(summary.packages).sort()) {
      const pkg: PackageInfo = summary.packages[library];
      if (pkg.depType == libType) {
        let lastReleased = 0;
        let link: string | undefined;
        let message: string | undefined;
        const isCustom = pkg.latest === '[custom]';
        let point = '🟩';
        if (!isCustom) {
          try {
            write(`Inspecting ${library}`);
            const npmInfo = await getNpmInfo(library, false);

            // example: released = 2016-03-17T15:16:31.913Z
            const released = npmInfo.time[pkg.version];
            const keys = Object.keys(npmInfo.time);
            const modified = npmInfo.time[keys[keys.length - 1]];
            lastReleased = daysAgo(new Date(modified));
            link = cleanLink(npmInfo.repository?.url);
          } catch (err) {
            writeError(`${library}: ${err}`);
            point = '🟧';
            message = `Unable to find information on npm.`;
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
          message = `Requires manual developer maintenance as it custom / forked.`;
        }

        if (!isCustom) {
          const current = coerce(pkg.version);
          const latest = coerce(pkg.latest);
          if (latest.major - current.major >= 1) {
            point = '🟧';
            const count = latest.major - current.major;
            message = `Is behind ${count} major version${count > 1 ? 's' : ''}.`;
          }
        }

        if (library.startsWith('@ionic-native/')) {
          point = '🟧';
          message = `Is deprecated and replaced with @awesome-cordova-plugins.`;
        }

        const scope = getStringFrom(library, '@', '/');

        let name = `${library}`;
        if (!isCustom) {
          name = name + `@${pkg.version}`;
        }
        if (link) {
          name = `[${name}](${link})`;
        }

        txt += `- ${point} ${name}`;
        txt += pkg.current ? ` - (Latest ${pkg.latest})` : ``;
        const tip = getTip(library, summary.project.groups);
        if (tip) {
          txt += ` - ${tip.message}`;
        } else if (message) {
          txt += ` - ${message}`;
        }
        txt += '\n';

        if (point == '🟩') good++;
        total++;
        lastScope = scope;
      }
    }
  }

  txt += `### Maintenance Score\n`;
  txt += `${good} out of ${total} dependencies were up to date without issues.\n\n`;

  txt += exportNamingStyles(summary.project.projectFolder());

  const filename = join(summary.project.projectFolder(), 'project-summary.md');
  writeFileSync(filename, txt);
  window.showInformationMessage(`Exported ${filename}`);
}

function timePeriod(days: number): string {
  if (days < 365) {
    return `${days} days`;
  }
  const years = days / 365.0;
  return `${Math.round(years * 10) / 10} years`;
}

function daysAgo(d: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  const today = new Date();
  return Math.round(Math.abs(((d as any) - (today as any)) / oneDay));
}

function cleanLink(url: string): string {
  url = url.replace('git+ssh://git@', 'https://');
  url = url.replace('git://github.com/', 'https://github.com/');
  url = url.replace('git+https://', 'https://');
  url = url.replace('git://', '');
  return url;
}

function exportNamingStyles(folder: string): string {
  const filenames = [];
  const baseFolder = join(folder, 'src');
  getAllFiles(baseFolder, filenames);
  let txt = '\n\n## Nonstandard naming\n';
  txt += 'The following files and folders do not follow the standard naming convention:\n\n';
  for (const filename of filenames) {
    const name = filename.replace(baseFolder, '');
    if (name.toLowerCase() != name) {
      txt += `- ${name}\n`;
    }
  }
  return txt;
}

function getAllFiles(folder: string, arrayOfFiles: Array<string>) {
  if (!existsSync(folder)) {
    return [];
  }
  const files = readdirSync(folder);
  arrayOfFiles = arrayOfFiles || [];

  for (const file of files) {
    if (statSync(join(folder, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(join(folder, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(join(folder, file));
    }
  }

  return arrayOfFiles;
}

function getTip(library: string, recommendations: Array<Recommendation>) {
  for (const parent of recommendations) {
    for (const recommendation of parent.children) {
      if (recommendation.tip?.relatedDependency == library) {
        return recommendation.tip;
      }
    }
  }
  return undefined;
}
