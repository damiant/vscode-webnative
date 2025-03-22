import { vscode } from './vscode';

export enum MessageType {
  getPlugins = 'getPlugins',
  getPlugin = 'getPlugin',
  getInstalledDeps = 'getInstalledDeps',
  chooseVersion = 'choose-version',
  init = 'init',
}

export function sendMessage(command: MessageType, value: string) {
  vscode.postMessage({ command, text: value });
}
