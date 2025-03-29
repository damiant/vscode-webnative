import { vscode } from './vscode';

export enum MessageType {
  setMobile = 'setMobile',
  setWeb = 'setWeb',
}

export function sendMessage(command: MessageType, value: string) {
  vscode.postMessage({ command, text: value });
}
