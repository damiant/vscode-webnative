import { vi } from 'vitest';

// Mock the vscode module before any imports
vi.mock('vscode', () => {
  return {
    window: {
      showErrorMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showInputBox: vi.fn(),
      showQuickPick: vi.fn(),
      activeTextEditor: null,
      withProgress: vi.fn(),
    },
    commands: {
      executeCommand: vi.fn(),
    },
    workspace: {
      onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
      workspaceFolders: [],
    },
    Position: class Position {
      constructor(
        public line: number,
        public character: number,
      ) {}
    },
    Selection: class Selection {
      constructor(
        public start: any,
        public end: any,
      ) {}
    },
    Uri: class Uri {
      static parse(value: string) {
        return { fsPath: value };
      }
    },
    ProgressLocation: {
      Notification: 15,
    },
    Disposable: class Disposable {
      dispose() {}
    },
    TreeItem: class TreeItem {
      constructor(
        public label?: string,
        public collapsibleState?: number,
      ) {}
    },
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
      Expanded: 2,
    },
    CancellationToken: class CancellationToken {
      isCancellationRequested = false;
    },
    TextDocument: class TextDocument {
      fileName = '';
    },
    CodeActionKind: {
      QuickFix: 'quickfix',
    },
  };
});
