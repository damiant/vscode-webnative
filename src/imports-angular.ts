import { existsSync } from 'fs';
import { Range, TextDocument, Uri, WorkspaceEdit, workspace } from 'vscode';
import { toPascalCase } from './utilities';
import { IonicComponents } from './imports-auto-fix';
import { Project } from 'ts-morph';
import { isGreaterOrEqual } from './analyzer';

export async function autoFixAngularImports(document: TextDocument, component: string): Promise<boolean> {
  // Validate that the file changed was a .html file that also has a .ts file which uses @ionic standalone
  if (!document.fileName.endsWith('.html')) return false;
  const tsFile = document.fileName.replace(new RegExp('.html$'), '.ts');
  if (!existsSync(tsFile)) return false;
  const edit = new WorkspaceEdit();
  const tsDoc = await workspace.openTextDocument(Uri.file(tsFile));

  const tsText = tsDoc.getText();

  if (!IonicComponents.includes(component)) {
    // Not a known Ionic Component
    return false;
  }
  const a19 = isGreaterOrEqual('@angular/core', '19.0.0');
  if (!a19) {
    if (!tsText.includes('standalone: true')) {
      // Doesnt include a standalone component
      console.log(`${tsFile} does not include a standalone component`);
      return false;
    }
  } else {
    if (tsText.includes('standalone: false')) {
      // Opted out of standalone components
      return false;
    }
  }
  if (tsText.includes('IonicModule')) {
    // Its got the IonicModule kitchen sink
    return false;
  }

  const project = new Project();

  const sourceFile = project.addSourceFileAtPath(Uri.file(tsFile).fsPath);
  sourceFile.replaceWithText(tsText);

  const importDeclarations = sourceFile.getImportDeclarations();
  const importName = toPascalCase(component);
  const moduleSpecifier = '@ionic/angular/standalone';

  let existsAlready = false;
  // Check if the import name already exists in the typescript file
  for (const importDeclaration of importDeclarations) {
    if (importDeclaration.getModuleSpecifier().getText().includes(moduleSpecifier)) {
      for (const named of importDeclaration.getNamedImports()) {
        if (named.getText() == importName) {
          existsAlready = true;
        }
      }
    }
  }
  if (existsAlready) return;
  let added = false;

  // Add the import
  for (const importDeclaration of importDeclarations) {
    if (!added && importDeclaration.getModuleSpecifier().getText().includes(moduleSpecifier)) {
      importDeclaration.addNamedImport(importName);
      added = true;
    }
  }

  // It wasnt added so we need to add the import declaration
  if (!added) {
    sourceFile.addImportDeclaration({
      namedImports: [importName],
      moduleSpecifier: moduleSpecifier,
    });
  }

  // Add to the imports list of the component
  const componentClass = sourceFile
    .getClasses()
    .find((classDeclaration) =>
      classDeclaration.getDecorators().some((decorator) => decorator.getText().includes('@Component')),
    );

  if (componentClass) {
    const componentDecorator = componentClass.getDecorators().find((d) => d.getText().includes('@Component'));

    if (componentDecorator) {
      const args = componentDecorator.getArguments();
      let code = args[0].getText();
      code = code.replace('imports: [', `imports: [${importName}, `);
      args[0].replaceWithText(code);
    }
  }

  edit.replace(
    Uri.file(tsFile),
    new Range(tsDoc.lineAt(0).range.start, tsDoc.lineAt(tsDoc.lineCount - 1).range.end),
    sourceFile.getText(),
  );
  await workspace.applyEdit(edit);

  // Save the changes so that refresh happens
  await workspace.saveAll();
}
