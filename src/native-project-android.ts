import { existsSync } from 'fs';

export class AndroidProject {
  private _projectPath: string;
  constructor(projectPath: string) {
    this._projectPath = projectPath;
  }

  exists(): boolean {
    return existsSync(this._projectPath);
  }

  async parse(): Promise<void> {}

  getPackageName(): string {
    throw new Error('Not implemented');
  }
  getVersionName(): string {
    throw new Error('Not implemented');
  }
  getVersionCode(): number {
    throw new Error('Not implemented');
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
