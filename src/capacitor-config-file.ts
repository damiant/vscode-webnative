import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Project } from './project';
import { getStringFrom, setStringIn } from './utilities';

// Purpose: Capacitor Config File Management

export function getCapacitorConfigureFile(folder: string): string | undefined {
  const capConfigFile = getCapacitorConfigureFilename(folder);
  if (capConfigFile && existsSync(capConfigFile)) {
    return readFileSync(capConfigFile, 'utf-8');
  }
  return undefined; // not found
}

export function getCapacitorConfigureFilename(folder: string): string {
  let capConfigFile = join(folder, 'capacitor.config.ts');
  if (!existsSync(capConfigFile)) {
    // React projects may use .js
    capConfigFile = join(folder, 'capacitor.config.js');
    if (!existsSync(capConfigFile)) {
      // might be a json file
      capConfigFile = join(folder, 'capacitor.config.json');
    }
  }

  return capConfigFile;
}

/**
 * Gets the full path using a folder and the webDir property from capacitor.config.ts
 * @param  {string} folder
 * @returns string
 */
export function getCapacitorConfigDistFolder(folder: string): string {
  let result = getCapacitorConfigWebDir(folder);
  if (!result) {
    // No config file take a best guess
    if (existsSync(join(folder, 'www'))) {
      result = 'www';
    } else if (existsSync(join(folder, 'dist'))) {
      result = 'dist';
    } else if (existsSync(join(folder, 'build'))) {
      result = 'build';
    } else if (existsSync(join(folder, 'out'))) {
      result = 'out';
    }
  }
  if (!result) {
    result = 'www'; // Assume www folder
  }
  return join(folder, result);
}

export function getCapacitorConfigWebDir(folder: string): string | undefined {
  let result: string | undefined;
  const config = getCapacitorConfigureFile(folder);
  if (config) {
    result = getStringFrom(config, `webDir: '`, `'`);
    if (!result) {
      result = getStringFrom(config, `webDir: "`, `"`);
      if (!result) {
        result = getStringFrom(config, `"webDir": "`, `"`);
      }
    }
  }
  return result;
}

export interface CapKeyValue {
  key: string;
  value: string;
}

export function writeCapacitorConfig(project: Project, keyValues: CapKeyValue[]) {
  const filename = getCapacitorConfigureFilename(project.projectFolder());
  if (!filename) {
    return;
  }
  let data = readFileSync(filename, 'utf-8');

  for (const kv of keyValues) {
    data = setValueIn(data, kv.key, kv.value);
  }
  writeFileSync(filename, data);
}

export function updateCapacitorConfig(project: Project, bundleId?: string, displayName?: string) {
  const filename = getCapacitorConfigureFilename(project.projectFolder());
  if (!filename) {
    return;
  }
  let data = readFileSync(filename, 'utf-8');
  if (bundleId) {
    data = setValueIn(data, 'appId', bundleId);
  }
  if (displayName) {
    data = setValueIn(data, 'appName', displayName);
  }
  writeFileSync(filename, data);
}

function setValueIn(data: string, key: string, value: string): string {
  if (data.includes(`${key}: '`)) {
    data = setStringIn(data, `${key}: '`, `'`, value);
  } else if (data.includes(`${key}: "`)) {
    data = setStringIn(data, `${key}: "`, `"`, value);
  }
  return data;
}
