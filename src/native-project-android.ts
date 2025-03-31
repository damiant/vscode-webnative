import { existsSync, readFileSync } from 'fs';
import { parse } from 'fast-xml-parser';
import { join } from 'path';
import { getStringFrom } from './utils-strings';

export class AndroidProject {
  private _projectPath: string;
  constructor(projectPath: string) {
    this._projectPath = projectPath;
  }

  exists(): boolean {
    return existsSync(this._projectPath);
  }

  async parse(): Promise<void> {}

  private stringsXmlPath(): string {
    return join(this._projectPath, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  }

  // Function to get the current app name
  getDisplayName(): string {
    return this.getValueFromStringsXml('app_name');
  }

  getValueFromStringsXml(key: string): string | null {
    if (!existsSync(this.stringsXmlPath())) {
      console.error('Error: strings.xml not found.');
      return null;
    }

    try {
      const xmlData = readFileSync(this.stringsXmlPath(), 'utf-8');
      const parsedXml = parse(xmlData, { ignoreAttributes: false });

      if (parsedXml.resources && parsedXml.resources.string) {
        const appNameEntry = parsedXml.resources.string.find((s: any) => s['@_name'] === key);
        return appNameEntry ? appNameEntry['#text'] : null;
      }

      return null;
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return null;
    }
  }

  private manifestPath(): string {
    return join(this._projectPath, 'app', 'src', 'main', 'AndroidManifest.xml');
  }

  getPackageName(): string {
    return this.getValueFromStringsXml('package_name');
  }

  getVersionName(): string {
    const gradlePath = join(this._projectPath, 'app', 'build.gradle');
    if (!existsSync(gradlePath)) {
      console.error('Error: build.gradle not found.');
      return null;
    }

    try {
      const gradleData = readFileSync(gradlePath, 'utf-8');
      const match = gradleData.match(/versionName\s+"(.+?)"/);

      return match ? match[1] : null;
    } catch (error) {
      console.error('Error reading versionName:', error);
      return null;
    }
  }

  getVersionCode(): number {
    const gradlePath = join(this._projectPath, 'app', 'build.gradle');
    if (!existsSync(gradlePath)) {
      console.error('Error: build.gradle not found.');
      return null;
    }

    try {
      const gradleData = readFileSync(gradlePath, 'utf-8');
      const match = getStringFrom(gradleData, 'versionCode ', '\r\n');
      return match ? parseInt(match) : null;
    } catch (error) {
      console.error('Error reading versionName:', error);
      return null;
    }
  }
  getResource(folder: string, file: string): string {
    throw new Error('Not implemented');
  }
  async setPackageName(packageName: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async setVersionName(versionName: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async setVersionCode(versionCode: number): Promise<void> {
    throw new Error('Not implemented');
  }
}
