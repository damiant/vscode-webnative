import { join } from 'path';
import { existsSync } from 'fs';
import { MonoRepoType } from './monorepo';
import { PackageManager } from './node-commands';

const configuredPmMap: Record<string, PackageManager> = {
  npm: PackageManager.npm,
  pnpm: PackageManager.pnpm,
  yarn: PackageManager.yarn,
  bun: PackageManager.bun,
};

/**
 * Detect the package manager from lockfiles at the monorepo root, with optional user setting fallback.
 */
export function getPackageManager(
  monorepoRoot: string,
  monoRepoType: MonoRepoType,
  configuredPm?: string,
): PackageManager {
  const yarnLock = join(monorepoRoot, 'yarn.lock');
  const pnpmLock = join(monorepoRoot, 'pnpm-lock.yaml');
  const bunLockb = join(monorepoRoot, 'bun.lockb');
  const bunLock = join(monorepoRoot, 'bun.lock');

  if (existsSync(yarnLock)) {
    return PackageManager.yarn;
  } else if (existsSync(pnpmLock) || monoRepoType == MonoRepoType.pnpm) {
    return PackageManager.pnpm;
  } else if (existsSync(bunLockb)) {
    return PackageManager.bun;
  } else if (existsSync(bunLock)) {
    return PackageManager.bun;
  }

  if (monoRepoType == MonoRepoType.yarn) {
    const packageLock = join(monorepoRoot, 'package-lock.json');
    if (!existsSync(packageLock)) {
      return PackageManager.yarn;
    }
  }
  if (monoRepoType == MonoRepoType.bun) {
    const packageLock = join(monorepoRoot, 'package-lock.json');
    if (!existsSync(packageLock)) {
      return PackageManager.bun;
    }
  }

  if (configuredPm && configuredPmMap[configuredPm]) {
    return configuredPmMap[configuredPm];
  }

  return PackageManager.npm;
}
