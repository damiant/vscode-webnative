import { QuickPickItem, window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { showOutput, write } from './logging';
import { ai, ChatRequest } from './ai-chat';
import { setSetting, WorkspaceSetting } from './workspace-state';
import { basename } from 'path';
import { existsSync } from 'fs';
import { describeProject } from './ai-project-info';
import { getAllFilenames } from './ai-tool-read-folder';

export async function chat(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  const chatting = true;
  let prompt: string | undefined;
  while (chatting) {
    let activeFile = window.activeTextEditor?.document.uri.fsPath;
    if (!existsSync(activeFile)) {
      activeFile = undefined;
    }
    const activeFileName = activeFile ? basename(activeFile) : 'your project';
    const title = `How would you like to modify ${activeFileName}?`;
    if (!prompt) {
      prompt = await window.showInputBox({
        title,
        placeHolder: `Changes will be done on your ${describeProject()} by AI`,
        ignoreFocusOut: true,
      });
      if (!prompt) return undefined;
      write(`> ${prompt}`);

      const files = [];
      window.visibleTextEditors.forEach((editor) => {
        if (existsSync(editor.document.uri.fsPath)) {
          files.push(editor.document.uri.fsPath);
        }
      });
      if (files.length === 0) {
        const otherFiles = getAllFilenames(project.projectFolder(), ['node_modules', 'dist', 'www']);
        files.push(...otherFiles);
      }

      const request: ChatRequest = {
        prompt,
        activeFile,
        files,
      };
      await ai(request, project.projectFolder());
    }
    prompt = undefined;
  }
}

// Not used yet
export async function chatModel(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  const models: any[] = [];
  const items: QuickPickItem[] = models.map((model) => {
    return { label: model.name, description: model.description };
  });
  const result = await window.showQuickPick(items, {
    placeHolder: 'Select an AI Model',
    canPickMany: false,
  });
  if (!result) return;
  const model = models.find((m) => m.name == result.label);
  setSetting(WorkspaceSetting.aiModel, model.id);
}
