import { expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Project } from '../src/project';
import {
  collectTsconfigSearchDirs,
  fixDeprecatedTsconfigOptions,
  hasDeprecatedCompilerOptions,
  hasDeprecatedTsconfigInProject,
  joinBaseUrlPath,
  migrateCompilerOptions,
} from '../src/rules-typescript-config';

test('joinBaseUrlPath prefixes paths relative to baseUrl', () => {
  expect(joinBaseUrlPath('./src', 'app/*')).toBe('./src/app/*');
  expect(joinBaseUrlPath('.', 'src/app/*')).toBe('./src/app/*');
  expect(joinBaseUrlPath('./', 'src/app/*')).toBe('./src/app/*');
});

test('joinBaseUrlPath leaves explicit relative paths unchanged', () => {
  expect(joinBaseUrlPath('./src', './app/*')).toBe('./app/*');
  expect(joinBaseUrlPath('./src', '../lib/*')).toBe('../lib/*');
});

test('migrateCompilerOptions removes deprecated options and rewrites paths', () => {
  const compilerOptions = {
    baseUrl: './src',
    downlevelIteration: true,
    paths: {
      '@app/*': ['app/*'],
      '@lib/*': ['./lib/*'],
    },
  };

  expect(migrateCompilerOptions(compilerOptions)).toBe(true);
  expect(compilerOptions).toEqual({
    paths: {
      '@app/*': ['./src/app/*'],
      '@lib/*': ['./lib/*'],
    },
  });
});

test('migrateCompilerOptions removes baseUrl when paths are absent', () => {
  const compilerOptions = {
    baseUrl: './',
    downlevelIteration: true,
  };

  expect(migrateCompilerOptions(compilerOptions)).toBe(true);
  expect(compilerOptions).toEqual({});
});

test('hasDeprecatedCompilerOptions detects deprecated compiler options', () => {
  expect(hasDeprecatedCompilerOptions({ baseUrl: './' })).toBe(true);
  expect(hasDeprecatedCompilerOptions({ downlevelIteration: true })).toBe(true);
  expect(hasDeprecatedCompilerOptions({ paths: { '@app/*': ['./src/*'] } })).toBe(false);
});

test('collectTsconfigSearchDirs includes parent folder and repo root', () => {
  const project = {
    folder: '/repo',
    projectFolder: () => '/repo/admin-app',
  } as Project;

  expect(collectTsconfigSearchDirs(project)).toEqual(['/repo/admin-app', '/repo']);
});

test('fixDeprecatedTsconfigOptions fixes parent-folder tsconfig for subfolder projects', () => {
  const root = mkdtempSync(join(tmpdir(), 'tsconfig-subfolder-'));
  const appDir = join(root, 'admin-app');
  try {
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { baseUrl: './', downlevelIteration: true },
      }),
    );
    mkdirSync(appDir);
    writeFileSync(
      join(appDir, 'tsconfig.json'),
      JSON.stringify({
        extends: '../tsconfig.json',
        compilerOptions: { strict: true },
      }),
    );

    const project = { folder: root, projectFolder: () => appDir } as Project;
    expect(hasDeprecatedTsconfigInProject(project)).toBe(true);
    fixDeprecatedTsconfigOptions(project);
    expect(hasDeprecatedTsconfigInProject(project)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fixDeprecatedTsconfigOptions follows extends chain', () => {
  const root = mkdtempSync(join(tmpdir(), 'tsconfig-test-'));
  try {
    writeFileSync(
      join(root, 'tsconfig.base.json'),
      JSON.stringify({
        compilerOptions: { baseUrl: './', downlevelIteration: true },
      }),
    );
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: { strict: true },
      }),
    );

    const project = { folder: root, projectFolder: () => root } as Project;
    expect(hasDeprecatedTsconfigInProject(project)).toBe(true);
    fixDeprecatedTsconfigOptions(project);
    expect(hasDeprecatedTsconfigInProject(project)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
