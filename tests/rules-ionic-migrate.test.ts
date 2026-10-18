import { expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
// Imported first so that the shared state of the extension is initialized before the migration rules
import '../src/project';
import {
  ioniconsUpdate,
  ionic8Browsers,
  ionicFrameworkVersion,
  ionicPackagesToUpdate,
  maxIonicVersion,
  migrateIonBackButtonImports,
  unmetIonicRequirement,
} from '../src/rules-ionic-migrate';

test('ionicFrameworkVersion uses the first Ionic Framework package of the project', () => {
  expect(ionicFrameworkVersion({ '@ionic/angular': '7.8.6' })?.version).toBe('7.8.6');
  expect(ionicFrameworkVersion({ '@ionic/react': '7.0.0', '@ionic/vue': '7.5.0' })?.version).toBe('7.0.0');
  // @ionic/angular is the first package of the list, so it wins when more than one is installed
  expect(ionicFrameworkVersion({ '@ionic/react': '8.0.0', '@ionic/angular': '6.0.0' })?.version).toBe('6.0.0');
  expect(ionicFrameworkVersion({ ionicons: '7.1.0' })).toBeUndefined();
  expect(ionicFrameworkVersion({})).toBeUndefined();
});

test('ionicPackagesToUpdate updates the installed Ionic packages to the latest major', () => {
  expect(ionicPackagesToUpdate(['@ionic/angular', '@ionic/angular-server', 'react'], 17)).toEqual([
    { dep: '@ionic/angular', version: maxIonicVersion },
    { dep: '@ionic/angular-server', version: maxIonicVersion },
  ]);
  expect(ionicPackagesToUpdate(['@ionic/vue', '@ionic/vue-router'], 0)).toEqual([
    { dep: '@ionic/vue', version: maxIonicVersion },
    { dep: '@ionic/vue-router', version: maxIonicVersion },
  ]);
});

test('ionicPackagesToUpdate keeps @ionic/angular-toolkit on v10 for Angular 16 and uses v11 for Angular 17', () => {
  expect(ionicPackagesToUpdate(['@ionic/angular', '@ionic/angular-toolkit'], 16)).toEqual([
    { dep: '@ionic/angular', version: maxIonicVersion },
    { dep: '@ionic/angular-toolkit', version: '10' },
  ]);
  expect(ionicPackagesToUpdate(['@ionic/angular', '@ionic/angular-toolkit'], 17)).toEqual([
    { dep: '@ionic/angular', version: maxIonicVersion },
    { dep: '@ionic/angular-toolkit', version: '11' },
  ]);
});

test('ionicPackagesToUpdate ignores packages that are not installed', () => {
  expect(ionicPackagesToUpdate(['@ionic/core'], 17)).toEqual([{ dep: '@ionic/core', version: maxIonicVersion }]);
  expect(ionicPackagesToUpdate(['react', 'vue', 'ionicons'], 17)).toEqual([]);
});

test('unmetIonicRequirement reports the frameworks below the Ionic 8 minimum', () => {
  expect(unmetIonicRequirement({ '@ionic/angular': '7.8.6', '@angular/core': '15.2.0' })).toEqual({
    dep: '@angular/core',
    version: '16.0.0',
    name: 'Angular 16',
  });
  expect(unmetIonicRequirement({ '@ionic/angular': '7.8.6', '@angular/core': '16.0.0' })).toBeUndefined();
  expect(unmetIonicRequirement({ '@ionic/react': '7.8.6', react: '16.14.0' })).toEqual({
    dep: 'react',
    version: '17.0.0',
    name: 'React 17',
  });
  expect(unmetIonicRequirement({ '@ionic/react': '7.8.6', react: '18.2.0' })).toBeUndefined();
  expect(unmetIonicRequirement({ '@ionic/vue': '7.8.6', vue: '3.0.5' })).toEqual({
    dep: 'vue',
    version: '3.0.6',
    name: 'Vue 3.0.6',
  });
  expect(unmetIonicRequirement({ '@ionic/vue': '7.8.6', vue: '3.4.0' })).toBeUndefined();
  expect(unmetIonicRequirement({ '@ionic/angular': '7.8.6' })).toBeUndefined();
});

test('ioniconsUpdate updates IonIcons only when it is below version 7', () => {
  expect(ioniconsUpdate('6.0.3')).toBe('ionicons@7');
  expect(ioniconsUpdate('7.0.0')).toBeUndefined();
  expect(ioniconsUpdate('7.4.0')).toBeUndefined();
  expect(ioniconsUpdate(undefined)).toBeUndefined();
});

test('ionic8Browsers matches the browser support of Ionic 8', () => {
  expect(ionic8Browsers).toEqual([
    'Chrome >=89',
    'ChromeAndroid >=89',
    'Firefox >=75',
    'Edge >=89',
    'Safari >=15',
    'iOS >=15',
  ]);
});

test('migrateIonBackButtonImports renames the removed delegate class in the source files', () => {
  const root = mkdtempSync(join(tmpdir(), 'ionic-migrate-'));
  try {
    const app = join(root, 'src', 'app');
    mkdirSync(app, { recursive: true });
    const component = join(app, 'detail.component.ts');
    writeFileSync(
      component,
      "import { IonBackButtonDelegate } from '@ionic/angular';\n\nexport class DetailComponent {\n  constructor(private backButton: IonBackButtonDelegate) {}\n}\n",
    );
    writeFileSync(join(app, 'app.component.ts'), 'export class AppComponent {}\n');
    // Files below node_modules are not part of the project source
    const dependency = join(app, 'node_modules', 'dependency');
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(dependency, 'index.ts'), 'export type Delegate = IonBackButtonDelegate;\n');

    expect(migrateIonBackButtonImports(root)).toEqual([join('src', 'app', 'detail.component.ts')]);
    const updated = readFileSync(component, 'utf8');
    expect(updated).not.toContain('IonBackButtonDelegate');
    expect(updated).toContain("import { IonBackButton } from '@ionic/angular';");
    expect(updated).toContain('private backButton: IonBackButton');
    expect(readFileSync(join(dependency, 'index.ts'), 'utf8')).toContain('IonBackButtonDelegate');

    // The second run finds nothing to rename
    expect(migrateIonBackButtonImports(root)).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('migrateIonBackButtonImports tolerates a project without a src folder', () => {
  const root = mkdtempSync(join(tmpdir(), 'ionic-migrate-empty-'));
  try {
    expect(migrateIonBackButtonImports(root)).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
