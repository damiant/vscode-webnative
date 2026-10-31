import { afterEach, expect, test, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { TextDocument } from 'vscode';
import { Project } from 'ts-morph';

const state = vi.hoisted(() => ({ version: '9.0.0', text: '', edited: '' }));

vi.mock('../src/analyzer', async () => {
  const { coerce, gte } = await import('semver');
  return {
    isGreaterOrEqual: (library: string, minimum: string) =>
      library === '@angular/core' || gte(coerce(state.version)!, minimum),
  };
});

vi.mock('vscode', () => ({
  Uri: { file: (path: string) => ({ fsPath: path }) },
  Range: class {},
  WorkspaceEdit: class {
    replace(_uri: unknown, _range: unknown, text: string) {
      state.edited = text;
    }
  },
  workspace: {
    openTextDocument: async () => ({
      getText: () => state.text,
      lineAt: () => ({ range: { start: {}, end: {} } }),
      lineCount: 1,
    }),
    applyEdit: async () => true,
    saveAll: async () => true,
  },
}));

// Keep the import tests independent of extension activation and project state.
vi.mock('../src/utilities', () => ({
  toPascalCase: (value: string) =>
    value
      .split('-')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(''),
}));

import { autoFixAngularImports } from '../src/imports-angular';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  state.edited = '';
});

async function autoImport(version: string, existingImport = '') {
  state.version = version;
  state.text = `${existingImport}
import { Component } from '@angular/core';
@Component({ standalone: true, imports: [] })
export class ExampleComponent {}`;
  const folder = mkdtempSync(join(tmpdir(), 'ionic-imports-'));
  folders.push(folder);
  writeFileSync(join(folder, 'example.ts'), state.text);
  await autoFixAngularImports({ fileName: join(folder, 'example.html') } as TextDocument, 'ion-footer');
  return new Project({ useInMemoryFileSystem: true }).createSourceFile('example.ts', state.edited);
}

test.each([
  ['7.8.6', '@ionic/angular/standalone'],
  ['^8.7.0', '@ionic/angular/standalone'],
  ['9.0.0', '@ionic/angular'],
  ['^9.1.0', '@ionic/angular'],
  ['10.0.0', '@ionic/angular'],
])('auto-import uses the correct entry point for Ionic %s', async (version, moduleSpecifier) => {
  const source = await autoImport(version);
  expect(
    source
      .getImportDeclaration(moduleSpecifier)
      ?.getNamedImports()
      .map((item) => item.getName()),
  ).toEqual(['IonFooter']);
  expect(source.getText()).toContain('imports: [IonFooter, ');
});

test.each(['8.7.0', '9.0.0'])('auto-import extends the existing import for Ionic %s', async (version) => {
  const moduleSpecifier = version.startsWith('8') ? '@ionic/angular/standalone' : '@ionic/angular';
  const source = await autoImport(version, `import { IonHeader } from '${moduleSpecifier}';`);
  expect(
    source.getImportDeclarations().filter((item) => item.getModuleSpecifierValue() === moduleSpecifier),
  ).toHaveLength(1);
  expect(
    source
      .getImportDeclaration(moduleSpecifier)
      ?.getNamedImports()
      .map((item) => item.getName()),
  ).toEqual(['IonHeader', 'IonFooter']);
});

test('Ionic 9 does not reuse the removed standalone subpath', async () => {
  const source = await autoImport('9.0.0', "import { IonFooter } from '@ionic/angular/standalone';");
  expect(source.getImportDeclaration('@ionic/angular')?.getNamedImports()[0].getName()).toBe('IonFooter');
});

test('auto-import does not duplicate an existing Ionic 9 component import', async () => {
  await autoImport('9.0.0', "import { IonFooter } from '@ionic/angular';");
  expect(state.edited).toBe('');
});
