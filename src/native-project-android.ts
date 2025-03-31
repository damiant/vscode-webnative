import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, writeFileSync } from 'fs';
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
    const dir = join(this._projectPath, 'app', 'src', 'main', 'java');
    const stringsXML = this.stringsXmlPath();
    const currentPackageName = this.getPackageName();
    const gradlePath = join(this._projectPath, 'app', 'build.gradle');
    const currentFolders = currentPackageName.split('.');
    const currentPath = join(dir, ...currentFolders);
    const mainActivity = join(currentPath, 'MainActivity.java');

    if (packageName === currentPackageName) {
      return;
    }
    if (!existsSync(currentPath)) {
      throw new Error(`Path ${currentPath} does not exist.`);
      return;
    }
    if (!existsSync(mainActivity)) {
      console.error('Error: MainActivity.java not found.');
      return;
    }
    if (!existsSync(stringsXML)) {
      console.error('Error: strings.xml not found.');
      return;
    }
    if (!existsSync(gradlePath)) {
      console.error('Error: build.gradle not found.');
      return;
    }

    // Replace package name in MainActivity.java
    const data = readFileSync(mainActivity, 'utf-8');
    const newData = data.replace(new RegExp(currentPackageName, 'g'), packageName);
    writeFileSync(mainActivity, newData);

    // Replace package name in strings.xml
    const data2 = readFileSync(stringsXML, 'utf-8');
    const newData2 = data2.replace(new RegExp(currentPackageName, 'g'), packageName);
    writeFileSync(stringsXML, newData2);

    // Replace package name in Build.gradle
    const data3 = readFileSync(gradlePath, 'utf-8');
    const newData3 = data3.replace(new RegExp(currentPackageName, 'g'), packageName);
    writeFileSync(gradlePath, newData3);

    // Create new folders for the new package name
    const folders = packageName.split('.');
    let newPath = dir;
    for (const folder of folders) {
      newPath = join(newPath, folder);
      if (!existsSync(newPath)) {
        mkdirSync(newPath);
      }
    }

    // Move all files from the currentPath to the newPath
    const files = readdirSync(currentPath);
    for (const file of files) {
      const source = join(currentPath, file);
      const destination = join(newPath, file);
      renameSync(source, destination);
    }

    // Delete old path
    let count = currentFolders.length;
    let pth = currentPath;
    while (count > 0) {
      try {
        rmdirSync(pth);
        pth = pth.substring(0, pth.lastIndexOf('/'));
        count--;
      } catch {
        break;
      }
    }
  }

  async setVersionName(versionName: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async setVersionCode(versionCode: number): Promise<void> {
    throw new Error('Not implemented');
  }
}
