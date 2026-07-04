import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getPackageManager } from '../src/package-manager';
import { MonoRepoType } from '../src/monorepo';
import { PackageManager } from '../src/node-commands';
import { CapacitorPlatform } from '../src/capacitor-platform';
import { Project } from '../src/project';

vi.mock('../src/process-packages', () => ({
  processPackages: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/tree-provider', () => ({
  exState: { hasPackageJson: true },
}));

describe('getPackageManager', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wn-pm-'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'root' }));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('detects pnpm from root lockfile for NX monorepo', () => {
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\n');
    const appDir = join(root, 'apps', 'my-app');
    mkdirSync(appDir, { recursive: true });

    expect(getPackageManager(root, MonoRepoType.nx)).toBe(PackageManager.pnpm);
    expect(getPackageManager(appDir, MonoRepoType.nx)).toBe(PackageManager.npm);
  });

  test('uses configured package manager when no lockfile exists', () => {
    expect(getPackageManager(root, MonoRepoType.nx, 'pnpm')).toBe(PackageManager.pnpm);
    expect(getPackageManager(root, MonoRepoType.nx)).toBe(PackageManager.npm);
  });

  test('detects yarn from root lockfile', () => {
    writeFileSync(join(root, 'yarn.lock'), '# yarn lockfile\n');
    expect(getPackageManager(root, MonoRepoType.nx)).toBe(PackageManager.yarn);
  });
});

describe('NX Capacitor detection', () => {
  let root: string;
  let appDir: string;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'wn-nx-cap-'));
    appDir = join(root, 'apps', 'my-app');
    mkdirSync(join(appDir, 'android'), { recursive: true });
    mkdirSync(join(appDir, 'ios'), { recursive: true });

    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'root',
        dependencies: { '@angular/core': '19.0.0' },
      }),
    );
    writeFileSync(
      join(appDir, 'package.json'),
      JSON.stringify({
        name: 'my-app',
        dependencies: {
          '@capacitor/android': '7.0.0',
          '@capacitor/ios': '7.0.0',
        },
      }),
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('mergeAppPackageJson exposes app capacitor deps for platform detection', async () => {
    const { load, mergeAppPackageJson, exists } = await import('../src/analyzer');
    const project = new Project('my-app');
    project.folder = root;
    project.repoType = MonoRepoType.nx;
    project.monoRepo = { name: 'my-app', folder: appDir };

    await load(root, project, {} as any);
    expect(exists('@capacitor/android')).toBe(false);

    const merged = mergeAppPackageJson(appDir, project);
    expect(merged).toBe(true);
    expect(exists('@capacitor/android')).toBe(true);
    expect(exists('@capacitor/ios')).toBe(true);
    expect(exists('@angular/core')).toBe(true);
    expect(project.hasCapacitorProject(CapacitorPlatform.android)).toBe(true);
    expect(project.hasCapacitorProject(CapacitorPlatform.ios)).toBe(true);
  });

  test('mergeAppPackageJson handles app package.json without devDependencies', async () => {
    writeFileSync(
      join(appDir, 'package.json'),
      JSON.stringify({
        name: 'my-app',
        dependencies: { '@capacitor/android': '7.0.0' },
      }),
    );

    const { load, mergeAppPackageJson, exists } = await import('../src/analyzer');
    const project = new Project('my-app');
    project.folder = root;
    project.repoType = MonoRepoType.nx;
    project.monoRepo = { name: 'my-app', folder: appDir };

    await load(root, project, {} as any);
    expect(mergeAppPackageJson(appDir, project)).toBe(true);
    expect(exists('@capacitor/android')).toBe(true);
    expect(exists('@angular/core')).toBe(true);
  });

  test('isCapacitor true when core is a devDependency at root', async () => {
    rmSync(join(appDir, 'package.json'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'root',
        devDependencies: { '@capacitor/core': '7.0.0' },
      }),
    );

    const { load } = await import('../src/analyzer');
    const project = new Project('root');
    project.folder = root;

    await load(root, project, {} as any);
    expect(project.isCapacitor).toBe(true);
  });
});
