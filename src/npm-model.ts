// Used for the data than comes from npm list --json
export interface NpmPackage {
  // Version number in the package.json
  version: string;

  // Name in package.json
  name: string;

  // This is an object with properties for each package.
  // eg { "@capacitor/project": {"version": "1.0.31", "resolved": "https://registry.npmjs.org/@capacitor/project/-/project-1.0.31.tgz"}}
  dependencies: object;
}

export interface NpmDependency {
  version: string; // Version number
  resolved: string; // URL to the package
}

// Used from npm outdated --json
export interface NpmOutdatedDependency {
  current: string; // Current version
  wanted: string;
  latest: string;
  dependent: string; // Package that depends on this
  location: string; // path to the node modules folder
}

export enum PackageType {
  Dependency = 'Dependency',
  CapacitorPlugin = 'Capacitor Plugin',
  CordovaPlugin = 'Plugin',
}

export enum PackageVersion {
  Unknown = 'Unknown',

  // Like a version that is pulled from git or local folder
  Custom = '[custom]',
}
