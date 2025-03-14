import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { exists } from './analyzer';
import { writeError, writeIonic } from './logging';
import { npmInstall } from './node-commands';
import { getRunOutput, showProgress } from './utilities';

export async function injectScript(folder: string, address: string, port: number): Promise<boolean> {
  if (!folder) {
    return true;
  }
  return await showProgress('Enabling Remote Logging', async () => {
    if (!exists('@ionic/remote-log')) {
      writeIonic('Installing @ionic/remote-log');
      await getRunOutput(npmInstall('@ionic/remote-log'), folder);
    }
    if (hasMainTSFile(folder)) {
      return injectRemoteLog(mainTsFile(folder), `${address}:${port}`);
    } else if (hasIndexTsxFile(folder)) {
      return injectRemoteLog(indexTsxFile(folder), `${address}:${port}`);
    }
    return false;
  });
}

export function removeScript(folder: string): boolean {
  if (!folder) return;
  if (hasMainTSFile(folder)) {
    return rejectRemoteLog(mainTsFile(folder));
  } else if (hasIndexTsxFile(folder)) {
    return rejectRemoteLog(indexTsxFile(folder));
  } else {
    return true;
  }
}

function mainTsFile(folder: string): string {
  return join(folder, 'src', 'main.ts');
}

function hasMainTSFile(folder: string): boolean {
  return existsSync(mainTsFile(folder));
}

function indexTsxFile(folder: string): string {
  return join(folder, 'src', 'index.tsx');
}

function hasIndexTsxFile(folder: string): boolean {
  return existsSync(indexTsxFile(folder));
}

function hasIndexHtml(folder: string): boolean {
  return existsSync(indexHtmlFile(folder));
}

function indexHtmlFile(folder: string): string {
  return join(folder, 'src', 'index.html');
}

function injectRemoteLog(mainTsFile: string, remoteUrl: string): boolean {
  try {
    rejectRemoteLog(mainTsFile);
    const txt = readFileSync(mainTsFile, 'utf8');
    const lines = txt.split('\n');
    lines.unshift(`import { initLogger } from '@ionic/remote-log'; // Ionic VS Code Extension`);
    lines.push(`initLogger('${remoteUrl}');  // Ionic VS Code Extension`);
    writeFileSync(mainTsFile, lines.join('\n'));
    return true;
  } catch (error) {
    writeError(error);
    return false;
  }
}

function rejectRemoteLog(mainTsFile: string) {
  try {
    const txt = readFileSync(mainTsFile, 'utf8');
    const lines = txt.split('\n');
    const update: string[] = [];
    let changed = false;
    for (const line of lines) {
      if (line.includes(`from '@ionic/remote-log'`) || line.startsWith(`initLogger(`)) {
        changed = true;
      } else {
        update.push(line);
      }
    }
    if (changed) {
      writeFileSync(mainTsFile, update.join('\n'));
    }
    return true;
  } catch (error) {
    writeError(error);
    return false;
  }
}
