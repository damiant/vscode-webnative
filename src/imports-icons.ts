import { Range, TextDocument, Uri, window, workspace, WorkspaceEdit } from 'vscode';
import { Parser } from 'htmlparser2';
import { existsSync, readFileSync } from 'fs';
import { Project } from 'ts-morph';
import { exState } from './wn-tree-provider';
import { join } from 'path';
import { writeError } from './logging';
import { exists } from './analyzer';
import { WorkspaceSection } from './workspace-state';
import { getStringFrom } from './utils-strings';

export async function autoFixOtherImports(document: TextDocument): Promise<boolean> {
  const value: string = workspace.getConfiguration(WorkspaceSection).get('autoImportIcons');
  if (value === 'no') return;

  // Look for <ion-icon name="icon-name"></ion-icon> in file.html
  // Then inspect file.ts to see if it has an import for icon-name
  // If it does not then add an import
  try {
    if (!exists('@ionic/angular')) {
      return false; // Only needed for Angular
    }
    // Load node_modules/ionicons/icons/index.d.ts and verify that the icon exists
    const availableIcons = getAvailableIcons();
    const icons: string[] = [];
    const doc = new Parser({
      onopentag(name, attributes) {
        if (name == 'ion-icon') {
          if (attributes.name) {
            if (availableIcons.includes(camelize(attributes.name))) {
              if (!icons.includes(attributes.name)) {
                icons.push(attributes.name);
              }
            } else {
              if (availableIcons.length == 0) {
                icons.push(attributes.name); // Assume available
              } else {
                writeError(`Unknown ion-icon "${attributes.name}".`);
              }
            }
          }
        }
      },
    });
    doc.write(document.getText());
    if (icons.length == 0) {
      return false; // This may not be a template with icons
    }
    const tsFile = document.fileName.replace(new RegExp('.html$'), '.ts');
    if (existsSync(tsFile)) {
      await addIconsToCode(icons, tsFile);
    }
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

async function addIconsToCode(icons: string[], tsFile: string) {
  const tsDoc = await workspace.openTextDocument(Uri.file(tsFile));
  const tsText = tsDoc.getText();
  if (!tsText.includes('standalone: true')) {
    return false;
  }
  if (tsText.includes('IonicModule')) {
    // Its got the IonicModule kitchen sink
    return false;
  }
  let changed = false;
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(Uri.file(tsFile).fsPath);
  sourceFile.replaceWithText(tsText);
  const importDeclarations = sourceFile.getImportDeclarations();
  const addIcons = importDeclarations.find((d) => d.getModuleSpecifier().getText().includes('ionicons'));
  if (!addIcons) {
    // need to add import { addIcons } from 'ionicons';
    sourceFile.addImportDeclaration({
      namedImports: ['addIcons'],
      moduleSpecifier: 'ionicons',
    });
    changed = true;
  }

  const importIcons = importDeclarations.filter((d) => d.getModuleSpecifier().getText().includes('ionicons/icons'));
  if (!importIcons) {
    for (const icon of icons) {
      sourceFile.addImportDeclaration({
        namedImports: [camelize(icon)],
        moduleSpecifier: 'ionicons/icons',
      });
      changed = true;
    }
  } else {
    for (const icon of icons) {
      const exists = importIcons.find((d) => d.getText().includes(camelize(icon)));

      if (!exists) {
        importIcons[0].addNamedImport(camelize(icon));
        changed = true;
      }
    }
  }

  const componentClass = sourceFile
    .getClasses()
    .find((classDeclaration) =>
      classDeclaration.getDecorators().some((decorator) => decorator.getText().includes('@Component')),
    );

  for (const ctr of componentClass.getConstructors()) {
    let count = 0;
    for (const st of ctr.getStatements()) {
      if (st.getText().startsWith('addIcons(')) {
        count++;
      }
    }

    if (count == 1) {
      // Only modify addIcons if one method is specified

      for (const st of ctr.getStatements()) {
        if (st.getText().startsWith('addIcons(')) {
          const list = [];
          for (const icon of icons) {
            list.push(camelize(icon));
          }
          const before = st.getText().replace(/\s/g, '');

          const existing = getStringFrom(before, '{', '}');
          const existingIcons = existing.split(',');
          for (const icon of existingIcons) {
            if (!list.includes(icon)) {
              list.push(icon);
            }
          }

          const text = camelize(list.join(','));
          const code = `addIcons({${text}});`;

          //
          st.replaceWithText(code);
          if (st.getText() != before && st.getText().length > before.length) {
            changed = true;
          }
        }
      }
    }
  }
  if (componentClass.getConstructors().length == 1) {
    const ctr = componentClass.getConstructors()[0];
    if (ctr.getStatements().length == 0 && icons.length > 0) {
      ctr.addStatements(`addIcons({${camelize(icons.join(','))}});`);
      changed = true;
    }
  }

  if (!changed) return;

  const value = workspace.getConfiguration(WorkspaceSection).get('autoImportIcons');
  if (value === '') {
    // Some developers may not want this to be auto-fixed so ask
    const choice = await window.showInformationMessage(
      'Do you want to automatically import ion-icons for this project?',
      'Yes',
      'No',
    );

    if (!choice) return;
    workspace.getConfiguration(WorkspaceSection).update('autoImportIcons', choice === 'Yes' ? 'yes' : 'no', true);

    if (choice === 'No') {
      return;
    }
  }

  const edit = new WorkspaceEdit();
  edit.replace(
    Uri.file(tsFile),
    new Range(tsDoc.lineAt(0).range.start, tsDoc.lineAt(tsDoc.lineCount - 1).range.end),
    sourceFile.getText(),
  );
  await workspace.applyEdit(edit);
  await workspace.saveAll();
}

const camelize = (s: string) => s.replace(/-./g, (x) => x[1].toUpperCase());

function getAvailableIcons(): string[] {
  if (existsSync(exState.nodeModulesFolder)) {
    //node_modules/ionicons/icons/index.d.ts
    const filename = join(exState.nodeModulesFolder, 'ionicons/icons/index.d.ts');
    const icons: string[] = [];
    if (existsSync(filename)) {
      const txt = readFileSync(filename, 'utf8');
      const lines = txt.split('\n');

      for (const line of lines) {
        const icon = line.replace('export declare var ', '').replace(': string;', '').trim();
        icons.push(icon);
      }
    }
    return icons;
  }
  return [];
}
