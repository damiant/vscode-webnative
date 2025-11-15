import { TextDocument, window, workspace } from 'vscode';
import { exState } from '../tree-provider';
import { autoFixOtherImports } from '../imports-icons';

export function trackProjectChange() {
  workspace.onDidSaveTextDocument((document: TextDocument) => {
    exState.projectDirty = true;
    if (document.fileName.endsWith('.html')) {
      autoFixOtherImports(document);
    }
  });

  window.onDidChangeVisibleTextEditors((e: Array<any>) => {
    let outputIsFocused = false;
    for (const d of e) {
      if ((d as any)?.document?.uri?.scheme == 'output') {
        outputIsFocused = true;
      }
    }
    exState.outputIsFocused = outputIsFocused;
  });
}
