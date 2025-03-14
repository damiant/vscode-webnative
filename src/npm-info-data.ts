/**
 * This is the API response from https://registry.npmjs.org/${name}/latest or https://registry.npmjs.org/${name}
 */
export interface NpmInfo {
  _id: string;
  _rev: string;
  name: string;
  'dist-tags': DistTags;
  versions: string[] | undefined;
  time: any;
  created: string;
  maintainers: string[];
  description: string;
  homepage: string;
  keywords: string[];
  repository: Repository;
  author: { name: string; email?: string; url?: string } | string;
  bugs: Bugs;
  license: { type: string; url?: string } | string;
  readmeFilename: string;
  _cached: boolean;
  _contentLength: number;
  version: string;
  main: string;
  module: string;
  types: string;
  unpkg: string;
  scripts: any;
  devDependencies: any;
  peerDependencies: any;
  dependencies: any;
  prettier: string;
  swiftlint: string;
  gitHead: string;
  engines: any;
  _nodeVersion: string;
  _npmVersion: string;
  dist: Dist;
  cordova: CordovaInfo;
  capacitor: CapacitorInfo;
  _npmUser: string;
  directories: Directories;
  _npmOperationalInternal: NpmOperationalInternal;
  _hasShrinkwrap: boolean;
}

interface CordovaInfo {
  platforms: string[] | string;
}

interface Directories {
  unknown: any;
}

interface CapacitorInfo {
  ios: any;
  android: any;
}

interface DistTags {
  latest: string;
  next: string;
}

interface Repository {
  type: string;
  url: string;
}

interface Bugs {
  url: string;
}

interface Dist {
  integrity: string;
  shasum: string;
  tarball: string;
  fileCount: number;
  unpackedSize: number;
  signatures: Signature[];
  'npm-signature': string;
}

interface Signature {
  keyid: string;
  sig: string;
}

interface NpmOperationalInternal {
  host: string;
  tmp: string;
}

/**
 * This is the response from the npm api https://api.npmjs.org/downloads/[period]/[package]
 */
export interface NpmDownloads {
  downloads: number;
  start: string;
  end: string;
  package: string;
}
