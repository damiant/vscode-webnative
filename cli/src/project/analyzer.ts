'use strict';

import { coerce, compare, lt, gte, lte, SemVer } from 'semver';
import { XMLParser, X2jOptions } from 'fast-xml-parser';
import { processPackages } from './process-packages';
import { Project } from './project';
import { PackageManager } from '../build/node-commands';
import { existsSync, lstatSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';

export class Analyzer {
  private packageFile: Record<string, any> = {};
  private allDependencies: Record<string, string> = {};
  private cordovaConfig: Record<string, any> | undefined;
  private androidManifest: any;
  hasPackageJson = false;

  private createXMLParserConfig(): X2jOptions {
    return {
      removeNSPrefix: true,
      isArray: () => true,
      parseTagValue: true,
      parseAttributeValue: true,
      ignoreAttributes: false,
    };
  }

  private processConfigXML(folder: string) {
    const configXMLFilename = `${folder}/config.xml`;
    const config: Record<string, any> = { preferences: {}, androidPreferences: {}, iosPreferences: {}, plugins: {} };
    if (existsSync(configXMLFilename)) {
      const xml = readFileSync(configXMLFilename, 'utf8');
      try {
        const parser = new XMLParser(this.createXMLParserConfig());
        const json = parser.parse(xml);

        const widget = json.widget[0];
        if (widget.preference) {
          for (const pref of widget.preference) {
            config.preferences[pref['@_name']] = pref['@_value'];
          }
        }
        if (!widget.platform) return config;
        for (const platform of widget.platform) {
          if (platform['@_name'] == 'android' && platform.preference) {
            for (const pref of platform.preference) {
              config.androidPreferences[pref['@_name']] = pref['@_value'];
            }
          }

          if (platform['@_name'] == 'ios' && platform.preference) {
            for (const pref of platform.preference) {
              config.iosPreferences[pref['@_name']] = pref['@_value'];
            }
          }
        }
        if (widget.plugin) {
          for (const plugin of widget.plugin) {
            config.plugins[plugin['@_name']] = plugin['@_spec'];
          }
        }
      } catch (err) {
        console.error(`Unable to parse config.xml`, err);
      }
    }
    return config;
  }

  private processAndroidXML(folder: string) {
    const androidXMLFilename = `${folder}/android/app/src/main/AndroidManifest.xml`;
    if (!existsSync(androidXMLFilename)) {
      return undefined;
    }
    const xml = readFileSync(androidXMLFilename, 'utf8');
    const parser = new XMLParser(this.createXMLParserConfig());
    return parser.parse(xml);
  }

  async load(fn: string, project: Project): Promise<Record<string, any>> {
    let packageJsonFilename = fn;
    if (lstatSync(fn).isDirectory()) {
      packageJsonFilename = fn + '/package.json';
      this.cordovaConfig = this.processConfigXML(fn);
      this.androidManifest = this.processAndroidXML(fn);
    }
    this.hasPackageJson = existsSync(packageJsonFilename);
    if (!this.hasPackageJson) {
      console.error('This folder does not contain an Ionic application (its missing package.json)');
      this.allDependencies = {};
      this.packageFile = {};
      return undefined;
    }
    project.modified = statSync(packageJsonFilename).mtime;
    try {
      this.packageFile = JSON.parse(readFileSync(packageJsonFilename, 'utf8'));
    } catch (err) {
      throw new Error(`The package.json is malformed: ` + err);
    }
    project.name = this.packageFile.name;
    if (!project.name) {
      project.name = project.monoRepo?.name;
    }
    if (!project.name) {
      project.name = 'unnamed';
    }
    project.workspaces = this.packageFile.workspaces;
    if (!project.yarnVersion) {
      if (project.packageManager == PackageManager.yarn) {
        project.yarnVersion = await this.getYarnVersion(this.packageFile.packageManager, project.folder);
      }
    }
    this.allDependencies = {
      ...this.packageFile.dependencies,
      ...this.packageFile.devDependencies,
    };

    project.isCapacitor = !!(
      this.packageFile.dependencies &&
      (this.packageFile.dependencies['@capacitor/core'] ||
        this.packageFile.dependencies['@capacitor/ios'] ||
        this.packageFile.dependencies['@capacitor/android'])
    );

    project.isCordova = !!(
      this.allDependencies['cordova-ios'] ||
      this.allDependencies['cordova-android'] ||
      this.packageFile.cordova
    );

    return await processPackages(fn, this.allDependencies, this.packageFile.devDependencies, project);
  }

  exists(library: string): boolean {
    return !!this.allDependencies[library];
  }

  matchingBeginingWith(start: string): Array<string> {
    const result: string[] = [];
    for (const library of Object.keys(this.allDependencies)) {
      if (library.startsWith(start)) {
        result.push(library);
      }
    }
    return result;
  }

  remotePackages(): Array<string> {
    const result: string[] = [];
    for (const library of Object.keys(this.allDependencies)) {
      if (this.allDependencies[library]?.startsWith('git')) {
        result.push(library);
      }
    }
    return result;
  }

  browsersList(): Array<string> {
    try {
      return JSON.parse(JSON.stringify(this.packageFile.browserslist));
    } catch {
      return [];
    }
  }

  deprecatedPackages(packages: any): Array<any> {
    const result: any[] = [];
    if (!packages) return result;
    for (const library of Object.keys(packages)) {
      if (packages[library].deprecated) {
        result.push({ name: library, message: packages[library].deprecated });
      }
    }
    return result;
  }

  getPackageVersion(library: string): SemVer | null {
    return coerce(this.allDependencies[library]);
  }

  isGreaterOrEqual(library: string, minVersion: string): boolean {
    const v = coerce(this.allDependencies[library]);
    return v != null && gte(v, minVersion);
  }

  isVersionGreaterOrEqual(version: string, minVersion: string): boolean {
    const v = coerce(version);
    return v != null && gte(v, minVersion);
  }

  startsWith(library: string, version: string): boolean {
    const v = this.allDependencies[library];
    return v != null && v.startsWith(version);
  }

  isLessOrEqual(library: string, minVersion: string): boolean {
    const v = coerce(this.allDependencies[library]);
    return v != null && lte(v, minVersion);
  }

  isLess(library: string, minVersion: string): boolean {
    const v = coerce(this.allDependencies[library]);
    return v != null && lt(v, minVersion);
  }

  checkConsistentVersions(lib1: string, lib2: string): boolean {
    const v1 = coerce(this.allDependencies[lib1]);
    const v2 = coerce(this.allDependencies[lib2]);
    if (v1 && v2 && compare(v1, v2)) {
      return v1.major !== v2.major;
    }
    return false;
  }

  getAllPackageNames(): Array<string> {
    return Object.keys(this.allDependencies);
  }

  getPackageFile(): Record<string, any> {
    return this.packageFile;
  }

  getAllDependencies(): Record<string, string> {
    return { ...this.allDependencies };
  }

  getCordovaConfig(): Record<string, any> | undefined {
    return this.cordovaConfig;
  }

  private async getYarnVersion(packageManager: string, folder: string): Promise<string> {
    if (packageManager) {
      return packageManager.replace('yarn@', '');
    }
    try {
      const v = execSync('yarn --version', { cwd: folder, encoding: 'utf8' });
      return v ? v.replace('\n', '') : '';
    } catch {
      return '';
    }
  }
}
