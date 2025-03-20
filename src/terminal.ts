import { window } from 'vscode';

export function runInTerminal(cmd: string) {
  const terminal = window.createTerminal('Vibe');

  // Send command to the terminal
  terminal.show(); // Make sure the terminal is visible
  terminal.sendText(cmd);
}
