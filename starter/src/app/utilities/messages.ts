import { vscode } from './vscode';

export enum MessageType {
  getTemplates = 'getTemplates',
  createProject = 'createProject',
  getProjectsFolder = 'getProjectsFolder',
  chooseFolder = 'chooseFolder',
  creatingProject = 'creatingProject',
  openUrl = 'openUrl',
}

export function sendMessage(command: MessageType, value: string) {
  vscode.postMessage({ command, text: value });
}
