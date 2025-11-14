import { Disposable, TextDocument, window, workspace, FileSystemWatcher } from 'vscode';
import { exState } from '../wn-tree-provider';
import { autoFixOtherImports } from '../imports-icons';
import { clearRefreshCache } from '../process-packages';

let packageJsonWatcher: FileSystemWatcher | undefined;
let refreshTimeout: NodeJS.Timeout | undefined;

export function trackProjectChange(): Disposable[] {
  const disposables: Disposable[] = [];

  disposables.push(
    workspace.onDidSaveTextDocument((document: TextDocument) => {
      exState.projectDirty = true;
      if (document.fileName.endsWith('.html')) {
        autoFixOtherImports(document);
      }
      // Refresh when package.json is saved
      if (document.fileName.endsWith('package.json')) {
        refreshTreeView();
      }
    }),
  );

  disposables.push(
    window.onDidChangeVisibleTextEditors((e: Array<any>) => {
      let outputIsFocused = false;
      for (const d of e) {
        if ((d as any)?.document?.uri?.scheme == 'output') {
          outputIsFocused = true;
        }
      }
      exState.outputIsFocused = outputIsFocused;
    }),
  );

  // Watch for package.json changes (for external changes like integrating dev tools from terminal)
  const workspaceFolders = workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const pattern = '**/package.json';
    packageJsonWatcher = workspace.createFileSystemWatcher(pattern);

    packageJsonWatcher.onDidChange(() => {
      refreshTreeView();
    });

    packageJsonWatcher.onDidCreate(() => {
      refreshTreeView();
    });

    packageJsonWatcher.onDidDelete(() => {
      refreshTreeView();
    });

    disposables.push(packageJsonWatcher);
  }

  // Return a disposable that cleans up the timeout on disposal
  disposables.push({
    dispose: () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = undefined;
      }
    },
  });

  return disposables;
}

function refreshTreeView() {
  // Clear any pending refresh to debounce rapid changes
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  // Use a small delay to avoid multiple rapid refreshes
  refreshTimeout = setTimeout(() => {
    if (exState.view && exState.context) {
      clearRefreshCache(exState.context);
      if (exState.view && (exState.view as any).treeDataProvider) {
        (exState.view as any).treeDataProvider.refresh();
      }
    }
  }, 300);
}
