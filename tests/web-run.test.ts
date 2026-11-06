import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { getServeScriptArgumentSeparator, serveCmd } from '../src/web-run';
import { PackageManager } from '../src/node-commands';
import { MonoRepoType } from '../src/monorepo';
import { exState } from '../src/tree-provider';
import { InternalCommand } from '../src/command-name';
import type { Project } from '../src/project';

const tempFolders: string[] = [];

/** Creates a temporary project folder with the given package.json scripts. */
function tempProject(scripts: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), 'web-run-'));
  tempFolders.push(folder);
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ scripts }));
  return folder;
}

/** The serve command WebNative runs, followed by the flags of a live reload run. */
function serveCommand(packageManager: PackageManager, isModernYarn: boolean): string {
  exState.packageManager = packageManager;
  exState.repoType = MonoRepoType.folder;
  const project = {
    projectFolder: () => tempProject({ start: 'ng serve' }),
    frameworkType: 'angular',
    packageManager,
    isModernYarn: () => isModernYarn,
  } as unknown as Project;
  return serveCmd(project) + '--host=0.0.0.0';
}

afterEach(() => {
  for (const folder of tempFolders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
  exState.packageManager = PackageManager.npm;
  exState.repoType = MonoRepoType.none;
});

test.each([
  ['npm', PackageManager.npm, false, `${InternalCommand.cwd}npm run start -- --host=0.0.0.0`],
  ['pnpm', PackageManager.pnpm, false, `${InternalCommand.cwd}pnpm start -- --host=0.0.0.0`],
  ['bun', PackageManager.bun, false, `${InternalCommand.cwd}bun run start -- --host=0.0.0.0`],
  ['Yarn Classic', PackageManager.yarn, false, `${InternalCommand.cwd}yarn run start -- --host=0.0.0.0`],
  ['Yarn Berry', PackageManager.yarn, true, `${InternalCommand.cwd}yarn run start --host=0.0.0.0`],
])('%s forwards the serve flags to the script once', (_name, packageManager, isModernYarn, expected) => {
  expect(serveCommand(packageManager, isModernYarn)).toBe(expected);
});

test('the separator is not added for Yarn Berry on any platform', () => {
  expect(getServeScriptArgumentSeparator(PackageManager.yarn, true)).toBe(' ');
});

test('the separator is kept for Yarn Classic', () => {
  expect(getServeScriptArgumentSeparator(PackageManager.yarn, false)).toBe(' -- ');
});

test.each([PackageManager.npm, PackageManager.pnpm, PackageManager.bun])(
  'the separator is kept for %s',
  (packageManager) => {
    expect(getServeScriptArgumentSeparator(packageManager, false)).toBe(' -- ');
  },
);
