import { vscode } from './vscode';

export enum MessageType {
  getPlugins = 'getPlugins',
  getPlugin = 'getPlugin',
  getInstalledDeps = 'getInstalledDeps',
  chooseVersion = 'choose-version',
}

export function sendMessage(command: MessageType, value: string) {
  vscode.postMessage({ command, text: value });
}
