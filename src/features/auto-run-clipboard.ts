import { env, window } from 'vscode';
import { runInTerminal } from '../terminal';
import { exState } from '../wn-tree-provider';

export function autoRunClipboard() {
  window.onDidChangeWindowState(async (e) => {
    if (e.focused) {
      // Focused in this window
      const txt = await env.clipboard.readText();
      const autoRun = exState.lastAutoRun !== txt;
      const looksLikeCommand = txt.startsWith('npm ') || txt.startsWith('npx ');
      if (autoRun && looksLikeCommand) {
        const selection = await window.showInformationMessage(`Run "${txt}" in the terminal?`, 'Execute', 'Exit');
        exState.lastAutoRun = txt;
        if (selection == 'Execute') {
          runInTerminal(txt);
        }
      }
    }
  });
}
