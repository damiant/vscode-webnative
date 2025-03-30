export class IosProject {
  private _projectPath: string;

  constructor(projectPath: string) {
    this._projectPath = projectPath;
  }

  exists(): boolean {
    // TODO
    return true;
  }

  getAppTarget(): AppTarget {
    throw new Error('Not implemented');
  }

  getBundleId(target: string): string {
    throw new Error('Not implemented');
  }

  async getDisplayName(target: string): Promise<string> {
    throw new Error('Not implemented');
  }
  getBuildConfigurations(target: string): BuildConfiguration[] {
    throw new Error('Not implemented');
  }
  getVersion(target: string, buildConfig: string): string {
    throw new Error('Not implemented');
  }
  async getBuild(target: string, buildConfig: string): Promise<number> {
    throw new Error('Not implemented');
  }

  setBundleId(target: string, buildConfig: string, bundleId: string): void {
    throw new Error('Not implemented');
  }

  setVersion(target: string, buildConfig: string, version: string): void {
    throw new Error('Not implemented');
  }

  async setBuild(target: string, buildConfig: string, build: number): Promise<void> {
    throw new Error('Not implemented');
  }

  async setDisplayName(target: string, buildConfig: string, displayName: string): Promise<void> {
    throw new Error('Not implemented');
  }
}

export interface BuildConfiguration {
  name: string;
}

export interface AppTarget {
  name: string;
}
