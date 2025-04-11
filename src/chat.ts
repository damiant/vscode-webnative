import { QuickPickItem, window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { showOutput, write } from './logging';
import { ai, getModels, Model } from './chat-ai';
import { setSetting, WorkspaceSetting } from './workspace-state';

export async function chat(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  let chatting = true;
  let prompt: string | undefined;
  while (chatting) {
    const title = `How would you like to modify your project?`;
    if (!prompt) {
      prompt = await window.showInputBox({
        title,
        placeHolder: 'Enter prompt (eg "Create a component called Pricing Page")',
        ignoreFocusOut: true,
      });
      if (!prompt) return undefined;
      write(`> ${prompt}`);
      showOutput();
      await ai(prompt);
    }
    prompt = undefined;
  }
}

export async function chatModel(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  const models: Model[] = await getModels();
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
