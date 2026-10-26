import { expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
// Imported first so that the shared state of the extension is initialized before the migration rules
import '../src/project';
import {
  ioniconsUpdate,
  ionic8Browsers,
  ionic9Browsers,
  ionicFramework,
  ionicFrameworkVersion,
  ionicMigrationFor,
  ionicMigrations,
  ionicPackagesToUpdate,
  maxIonicVersion,
  migrateAutocorrectAttributes,
  migrateIonBackButtonImports,
  migrateLegacyPickerElements,
  removeIonicCssTildePrefix,
  unmetIonicRequirement,
} from '../src/rules-ionic-migrate';

/** Creates a temporary project with the given files, where the keys are relative to the project folder. */
function withProject(files: Record<string, string>, test: (folder: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'ionic-migrate-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      const file = join(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    test(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('ionicFrameworkVersion uses the first Ionic Framework package of the project', () => {
  expect(ionicFrameworkVersion({ '@ionic/angular': '7.8.6' })?.version).toBe('7.8.6');
  expect(ionicFrameworkVersion({ '@ionic/react': '7.0.0', '@ionic/vue': '7.5.0' })?.version).toBe('7.0.0');
  // @ionic/angular is the first package of the list, so it wins when more than one is installed
  expect(ionicFrameworkVersion({ '@ionic/react': '8.0.0', '@ionic/angular': '6.0.0' })?.version).toBe('6.0.0');
  expect(ionicFrameworkVersion({ ionicons: '7.1.0' })).toBeUndefined();
  expect(ionicFrameworkVersion({})).toBeUndefined();
});

test('ionicMigrations upgrades one major version at a time up to the maximum version', () => {
  expect(ionicMigrations.map((migration) => `${migration.from}->${migration.to}`)).toEqual(['7->8', '8->9']);
  expect(maxIonicVersion).toBe('9');
  expect(ionicMigrationFor(7)?.to).toBe('8');
  expect(ionicMigrationFor(8)?.to).toBe('9');
  expect(ionicMigrationFor(9)).toBeUndefined();
});

test('ionicFramework identifies the framework of the installed Ionic packages', () => {
  expect(ionicFramework({ '@ionic/angular': '9.0.0' })).toBe('angular');
  expect(ionicFramework({ '@ionic/react': '9.0.0' })).toBe('react');
  expect(ionicFramework({ '@ionic/vue': '9.0.0' })).toBe('vue');
  expect(ionicFramework({ ionicons: '8.0.0' })).toBeUndefined();
});

test('ionicPackagesToUpdate updates the installed Ionic packages to the latest major', () => {
  expect(ionicPackagesToUpdate(['@ionic/angular', '@ionic/angular-server', 'react'], 21)).toEqual([
    { dep: '@ionic/angular', version: maxIonicVersion },
    { dep: '@ionic/angular-server', version: maxIonicVersion },
  ]);
  expect(ionicPackagesToUpdate(['@ionic/vue', '@ionic/vue-router'], 0)).toEqual([
    { dep: '@ionic/vue', version: '9' },
    { dep: '@ionic/vue-router', version: '9' },
  ]);
});

test('ionicPackagesToUpdate uses version 8 when the Ionic 8 migration is requested', () => {
  const migration = ionicMigrationFor(7);
  expect(ionicPackagesToUpdate(['@ionic/react', '@ionic/react-router'], 18, migration)).toEqual([
    { dep: '@ionic/react', version: '8' },
    { dep: '@ionic/react-router', version: '8' },
  ]);
});

test('ionicPackagesToUpdate keeps @ionic/angular-toolkit on v10 for Angular 16 and uses v11 for Angular 17', () => {
  const migration = ionicMigrationFor(7);
  expect(ionicPackagesToUpdate(['@ionic/angular', '@ionic/angular-toolkit'], 16, migration)).toEqual([
    { dep: '@ionic/angular', version: '8' },
    { dep: '@ionic/angular-toolkit', version: '10' },
  ]);
  expect(ionicPackagesToUpdate(['@ionic/angular', '@ionic/angular-toolkit'], 17, migration)).toEqual([
    { dep: '@ionic/angular', version: '8' },
    { dep: '@ionic/angular-toolkit', version: '11' },
  ]);
});

test('ionicPackagesToUpdate matches @ionic/angular-toolkit to the installed Angular version for Ionic 9', () => {
  const migration = ionicMigrationFor(8);
  const toolkitFor = (angularMajor: number) =>
    ionicPackagesToUpdate(['@ionic/angular-toolkit'], angularMajor, migration)[0].version;
  expect(toolkitFor(18)).toBe('12.1.1');
  expect(toolkitFor(19)).toBe('12.2.0');
  expect(toolkitFor(20)).toBe('12.3.0');
  expect(toolkitFor(21)).toBe('13');
  expect(toolkitFor(22)).toBe('13');
});

test('ionicPackagesToUpdate ignores packages that are not installed', () => {
  expect(ionicPackagesToUpdate(['@ionic/core'], 21)).toEqual([{ dep: '@ionic/core', version: '9' }]);
  expect(ionicPackagesToUpdate(['react', 'vue', 'ionicons'], 21)).toEqual([]);
});

test('unmetIonicRequirement reports the frameworks below the Ionic 8 minimum', () => {
  const migration = ionicMigrationFor(7);
  expect(unmetIonicRequirement({ '@ionic/angular': '7.8.6', '@angular/core': '15.2.0' }, migration)).toEqual({
    dep: '@angular/core',
    version: '16.0.0',
    name: 'Angular 16',
  });
  expect(unmetIonicRequirement({ '@ionic/angular': '7.8.6', '@angular/core': '16.0.0' }, migration)).toBeUndefined();
  expect(unmetIonicRequirement({ '@ionic/react': '7.8.6', react: '16.14.0' }, migration)).toEqual({
    dep: 'react',
    version: '17.0.0',
    name: 'React 17',
  });
  expect(unmetIonicRequirement({ '@ionic/vue': '7.8.6', vue: '3.0.5' }, migration)).toEqual({
    dep: 'vue',
    version: '3.0.6',
    name: 'Vue 3.0.6',
  });
});

test('unmetIonicRequirement reports the frameworks below the Ionic 9 minimum', () => {
  expect(unmetIonicRequirement({ '@ionic/angular': '8.8.6', '@angular/core': '17.3.0' })).toEqual({
    dep: '@angular/core',
    version: '18.0.0',
    name: 'Angular 18',
  });
  expect(unmetIonicRequirement({ '@ionic/angular': '8.8.6', '@angular/core': '18.0.0' })).toBeUndefined();
  expect(unmetIonicRequirement({ '@ionic/react': '8.8.6', react: '17.0.2' })).toEqual({
    dep: 'react',
    version: '18.0.0',
    name: 'React 18',
  });
  expect(unmetIonicRequirement({ '@ionic/vue': '8.8.6', vue: '3.4.0' })).toEqual({
    dep: 'vue',
    version: '3.5.0',
    name: 'Vue 3.5',
  });
  expect(unmetIonicRequirement({ '@ionic/react': '8.8.6', react: '18.2.0', typescript: '5.3.3' })).toEqual({
    dep: 'typescript',
    version: '5.4.0',
    name: 'TypeScript 5.4',
  });
});

test('ioniconsUpdate updates IonIcons to the version that the migration needs', () => {
  expect(ioniconsUpdate('6.0.3', ionicMigrationFor(7))).toBe('ionicons@7');
  expect(ioniconsUpdate('7.0.0', ionicMigrationFor(7))).toBeUndefined();
  expect(ioniconsUpdate('7.4.0')).toBe('ionicons@8');
  expect(ioniconsUpdate('8.0.0')).toBeUndefined();
  expect(ioniconsUpdate('8.1.0')).toBeUndefined();
  expect(ioniconsUpdate(undefined)).toBeUndefined();
});

test('the browser lists match the browser support of Ionic 8 and Ionic 9', () => {
  expect(ionic8Browsers).toEqual([
    'Chrome >=89',
    'ChromeAndroid >=89',
    'Firefox >=75',
    'Edge >=89',
    'Safari >=15',
    'iOS >=15',
  ]);
  expect(ionic9Browsers).toEqual([
    'Chrome >=89',
    'ChromeAndroid >=89',
    'Firefox >=75',
    'Edge >=89',
    'Safari >=16',
    'iOS >=16',
  ]);
});

test('migrateIonBackButtonImports renames the removed delegate class in the source files', () => {
  withProject(
    {
      'src/app/detail.component.ts':
        "import { IonBackButtonDelegate } from '@ionic/angular';\n\nexport class DetailComponent {\n  constructor(private backButton: IonBackButtonDelegate) {}\n}\n",
      'src/app/app.component.ts': 'export class AppComponent {}\n',
      // Files below node_modules are not part of the project source
      'src/app/node_modules/dependency/index.ts': 'export type Delegate = IonBackButtonDelegate;\n',
    },
    (root) => {
      expect(migrateIonBackButtonImports(root)).toEqual([join('src', 'app', 'detail.component.ts')]);
      const updated = readFileSync(join(root, 'src/app/detail.component.ts'), 'utf8');
      expect(updated).not.toContain('IonBackButtonDelegate');
      expect(updated).toContain("import { IonBackButton } from '@ionic/angular';");
      expect(updated).toContain('private backButton: IonBackButton');
      expect(readFileSync(join(root, 'src/app/node_modules/dependency/index.ts'), 'utf8')).toContain(
        'IonBackButtonDelegate',
      );

      // The second run finds nothing to rename
      expect(migrateIonBackButtonImports(root)).toEqual([]);
    },
  );
});

test('migrateLegacyPickerElements renames the removed picker components', () => {
  withProject(
    {
      'src/app/picker.page.html':
        '<ion-picker-legacy [columns]="columns"></ion-picker-legacy>\n<ion-picker-legacy-column></ion-picker-legacy-column>\n',
      'src/app/detail.page.ts':
        "export class DetailPage {\n  template = '<ion-picker-legacy-column></ion-picker-legacy-column>';\n}\n",
      'src/app/vue.page.vue': '<template><ion-picker-legacy></ion-picker-legacy></template>\n',
      'src/app/node_modules/legacy/readme.html': '<ion-picker-legacy></ion-picker-legacy>\n',
    },
    (root) => {
      expect(migrateLegacyPickerElements(root).sort()).toEqual(
        [
          join('src', 'app', 'detail.page.ts'),
          join('src', 'app', 'picker.page.html'),
          join('src', 'app', 'vue.page.vue'),
        ].sort(),
      );
      const picker = readFileSync(join(root, 'src/app/picker.page.html'), 'utf8');
      expect(picker).toContain('<ion-picker [columns]="columns"></ion-picker>');
      expect(picker).toContain('<ion-picker-column></ion-picker-column>');
      expect(readFileSync(join(root, 'src/app/node_modules/legacy/readme.html'), 'utf8')).toContain(
        'ion-picker-legacy',
      );

      // The second run finds nothing to rename
      expect(migrateLegacyPickerElements(root)).toEqual([]);
    },
  );
});

test('migrateAutocorrectAttributes removes the off value and converts on to true', () => {
  withProject(
    {
      'src/app/form.page.html':
        '<ion-input autocorrect="off"></ion-input>\n' +
        '<ion-searchbar autocorrect=\'off\' placeholder="Search"></ion-searchbar>\n' +
        '<ion-input autocorrect="on"></ion-input>\n' +
        '<ion-textarea autocorrect="off"></ion-textarea>\n',
      'src/app/form.component.tsx': '<IonInput autocorrect="off" />\n',
    },
    (root) => {
      expect(migrateAutocorrectAttributes(root).sort()).toEqual(
        [join('src', 'app', 'form.component.tsx'), join('src', 'app', 'form.page.html')].sort(),
      );
      const html = readFileSync(join(root, 'src/app/form.page.html'), 'utf8');
      expect(html).toContain('<ion-input></ion-input>');
      expect(html).toContain('<ion-searchbar placeholder="Search"></ion-searchbar>');
      expect(html).toContain('<ion-input autocorrect="true"></ion-input>');
      // autocorrect is not a boolean property of ion-textarea
      expect(html).toContain('<ion-textarea autocorrect="off"></ion-textarea>');
      expect(readFileSync(join(root, 'src/app/form.component.tsx'), 'utf8')).toBe('<IonInput autocorrect={false} />\n');

      // The second run finds nothing to change
      expect(migrateAutocorrectAttributes(root)).toEqual([]);
    },
  );
});

test('removeIonicCssTildePrefix removes the webpack loader prefix from the Ionic CSS imports', () => {
  withProject(
    {
      'src/global.scss': "@import '~@ionic/angular/css/core.css';\n@import '~@ionic/angular/css/normalize.css';\n",
      'src/theme/variables.css': "@import url('~@ionic/angular/css/palettes/dark.always.css');\n",
      'src/app/app.css': '.example { color: red; }\n',
    },
    (root) => {
      expect(removeIonicCssTildePrefix(root).sort()).toEqual(
        [join('src', 'global.scss'), join('src', 'theme', 'variables.css')].sort(),
      );
      expect(readFileSync(join(root, 'src/global.scss'), 'utf8')).toBe(
        "@import '@ionic/angular/css/core.css';\n@import '@ionic/angular/css/normalize.css';\n",
      );
      expect(readFileSync(join(root, 'src/theme/variables.css'), 'utf8')).toBe(
        "@import url('@ionic/angular/css/palettes/dark.always.css');\n",
      );
      expect(removeIonicCssTildePrefix(root)).toEqual([]);
    },
  );
});

test('the source fixes tolerate a project without a src folder', () => {
  withProject({ 'package.json': '{}' }, (root) => {
    expect(migrateIonBackButtonImports(root)).toEqual([]);
    expect(migrateLegacyPickerElements(root)).toEqual([]);
    expect(migrateAutocorrectAttributes(root)).toEqual([]);
    expect(removeIonicCssTildePrefix(root)).toEqual([]);
  });
});
