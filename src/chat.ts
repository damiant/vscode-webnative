import { QuickPickItem, window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { ai, ChatRequest } from './ai-chat';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { basename } from 'path';
import { existsSync } from 'fs';
import { describeProject } from './ai-project-info';
import { getAllFilenames } from './ai-tool-read-folder';
import { getModels, Model } from './ai-openrouter';

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

      let files = [];
      window.visibleTextEditors.forEach((editor) => {
        if (existsSync(editor.document.uri.fsPath)) {
          files.push(editor.document.uri.fsPath);
        }
      });
      if (files.length === 0) {
        const otherFiles = getAllFilenames(project.projectFolder(), ['node_modules', 'dist', 'www']);
        files.push(...otherFiles);
        files = files.filter((file) => file !== activeFile);
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
  let models: Model[] = await getModels();
  models.sort((a, b) => a.name.localeCompare(b.name));
  const currentModel = getSetting(WorkspaceSetting.aiModel);
  const items: QuickPickItem[] = models.map((model) => {
    // {hourly: 0, input: 0, output: 0, base: 0, finetune: 0}
    const price =
      model.pricing.prompt == '0' &&
      model.pricing.completion == '0' &&
      model.pricing.image == '0' &&
      model.pricing.request == '0' &&
      model.pricing.input_cache_read == '0' &&
      model.pricing.input_cache_write == '0' &&
      model.pricing.web_search == '0' &&
      model.pricing.internal_reasoning == '0'
        ? 'Free'
        : `Paid in:${model.pricing.prompt} out:${model.pricing.completion}`;

    return { label: labelFor(model), description: `(${price})`, picked: model.id == currentModel };
  });
  const result = await window.showQuickPick(items, {
    placeHolder: 'Select an AI Model',
    canPickMany: false,
  });
  if (!result) return;
  const model = models.find((m) => labelFor(m) == result.label);
  setSetting(WorkspaceSetting.aiModel, model.id);
}

function labelFor(model: Model): string {
  let icon = '$(file-binary)';
  if (model.architecture.input_modalities.includes('image')) {
    icon = '$(eye)';
  }

  return `${icon} ${model.name}`;
}
