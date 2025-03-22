import { window } from 'vscode';
import { extensionName } from './extension';

export function runInTerminal(cmd: string) {
  let terminal = window.terminals.find((t) => t.name == extensionName);
  if (!terminal) {
    terminal = window.createTerminal(extensionName);
  }

  // Send command to the terminal
  terminal.show(); // Make sure the terminal is visible
  terminal.sendText(cmd);
}
