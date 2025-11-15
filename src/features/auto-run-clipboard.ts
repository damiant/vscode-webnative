import { env, window } from 'vscode';
import { runInTerminal } from '../terminal';
import { exState } from '../tree-provider';
import { MonoRepoType } from '../monorepo';

export function autoRunClipboard() {
  window.onDidChangeWindowState(async (e) => {
    if (e.focused) {
      // Focused in this window
      const txt = await env.clipboard.readText();
      const autoRun = exState.lastAutoRun !== txt;
      const looksLikeCommand = txt.startsWith('npm ') || txt.startsWith('npx ');

      if (autoRun && looksLikeCommand && exState?.projectRef?.repoType == MonoRepoType.none) {
        exState.lastAutoRun = txt;

        // Ask to run the command
        const selection = await window.showInformationMessage(`Run "${txt}" in the terminal?`, 'Execute', 'Exit');
        if (selection == 'Execute') {
          runInTerminal(txt);
        }
      }
    }
  });
}
