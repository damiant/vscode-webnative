/**
 * Package analysis utilities
 * Adapted from ../../../src/analyzer.ts
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { coerce, compare, gte, lt, lte } from 'semver';

let packageFile: Record<string, unknown>;
let allDependencies: Record<string, string> = {};

export interface VersionCheckResult {
  currentVersion: string;
  library: string;
  reason?: string;
  requiredVersion: string;
  satisfies: boolean;
}

export function checkConsistentVersions(
  library1: string,
  library2: string,
): {
  consistent: boolean;
  library1: string;
  library2: string;
  version1?: string;
  version2?: string;
} {
  const v1 = coerce(allDependencies[library1]);
  const v2 = coerce(allDependencies[library2]);

  if (!v1 || !v2) {
    return {
      consistent: true,
      library1,
      library2,
    };
  }

  return {
    consistent: compare(v1, v2) === 0,
    library1,
    library2,
    version1: v1.version,
    version2: v2.version,
  };
}

export function checkMinVersion(library: string, minVersion: string, reason?: string): undefined | VersionCheckResult {
  const v = coerce(allDependencies[library]);
  if (!v) return undefined;

  const satisfies = !lt(v, minVersion);
  return {
    currentVersion: v.version,
    library,
    reason,
    requiredVersion: minVersion,
    satisfies,
  };
}

export function deprecatedPackages(): string[] {
  // List of known deprecated packages
  const deprecated = [
    '@ionic/ng-toolkit',
    'cordova-plugin-camera',
    'cordova-plugin-media',
    'cordova-plugin-file',
    'cordova-plugin-media-capture',
  ];

  return deprecated.filter((pkg) => exists(pkg));
}

export function exists(library: string): boolean {
  return !!allDependencies[library];
}

export function getAllDependencies(): Record<string, string> {
  return allDependencies;
}

export function getPackageFile(): Record<string, unknown> {
  return packageFile;
}

export function getPackageVersion(library: string): string | undefined {
  return allDependencies[library];
}

export function isGreaterOrEqual(library: string, version: string): boolean {
  const v = coerce(allDependencies[library]);
  if (!v) return false;
  return gte(v, version);
}

export function isLess(library: string, version: string): boolean {
  const v = coerce(allDependencies[library]);
  if (!v) return false;
  return lt(v, version);
}

export function isLessOrEqual(library: string, version: string): boolean {
  const v = coerce(allDependencies[library]);
  if (!v) return false;
  return lte(v, version);
}

export function isVersionGreaterOrEqual(version1: string, version2: string): boolean {
  const v1 = coerce(version1);
  const v2 = coerce(version2);
  if (!v1 || !v2) return false;
  return gte(v1, v2);
}

export function loadPackageJson(folder: string): Record<string, unknown> {
  const packageJsonFilename = join(folder, 'package.json');

  if (!existsSync(packageJsonFilename)) {
    throw new Error('package.json not found in: ' + folder);
  }

  try {
    packageFile = JSON.parse(readFileSync(packageJsonFilename, 'utf8'));
  } catch (err) {
    throw new Error(`The package.json is malformed: ${err}`);
  }

  allDependencies = {
    ...(packageFile.dependencies as Record<string, string>),
    ...(packageFile.devDependencies as Record<string, string>),
  };

  return packageFile;
}

export function matchingBeginingWith(start: string): string[] {
  const result: string[] = [];
  for (const library of Object.keys(allDependencies)) {
    if (library.startsWith(start)) {
      result.push(library);
    }
  }
  return result;
}

export function remotePackages(): string[] {
  const result: string[] = [];
  for (const library of Object.keys(allDependencies)) {
    if (allDependencies[library]?.startsWith('git') || allDependencies[library]?.startsWith('http')) {
      result.push(library);
    }
  }
  return result;
}

export function startsWith(library: string, prefix: string): boolean {
  return exists(library) && allDependencies[library].startsWith(prefix);
}
