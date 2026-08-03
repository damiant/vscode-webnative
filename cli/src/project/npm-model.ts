// Used for the data than comes from npm list --json
export interface NpmPackage {
  version: string;
  name: string;
  dependencies: object;
}

export interface NpmDependency {
  version: string;
  resolved: string;
}

// Used from npm outdated --json
export interface NpmOutdatedDependency {
  current: string;
  wanted: string;
  latest: string;
  dependent: string;
  location: string;
}

export enum PackageType {
  Dependency = 'Dependency',
  CapacitorPlugin = 'Capacitor Plugin',
  CordovaPlugin = 'Plugin',
}

export enum PackageVersion {
  Unknown = 'Unknown',
  Custom = '[custom]',
}
