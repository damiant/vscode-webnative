import { env, window } from 'vscode';
import { runInTerminal } from '../terminal';
import { exState } from '../wn-tree-provider';
import { extractBetween } from '../utilities';
import { chat } from '../integrations-builder';

export function autoRunClipboard() {
  window.onDidChangeWindowState(async (e) => {
    if (e.focused) {
      // Focused in this window
      const txt = await env.clipboard.readText();
      const autoRun = exState.lastAutoRun !== txt;
      const looksLikeCommand = txt.startsWith('npm ') || txt.startsWith('npx ');

      // Builder command will be like:
      // npx @builder.io/dev-tools@latest code --url "xxx" --spaceId
      if (autoRun && looksLikeCommand) {
        exState.lastAutoRun = txt;

        if (txt.includes('--url') && txt.includes('npx @builder.io/dev-tools')) {
          // Its a Figma design
          const url = extractBetween(txt, '--url "', '"');
          chat(exState.projectRef.projectFolder(), url, ' --spaceId');
        } else {
          const selection = await window.showInformationMessage(`Run "${txt}" in the terminal?`, 'Execute', 'Exit');
          if (selection == 'Execute') {
            runInTerminal(txt);
          }
        }
      }
    }
  });
}
