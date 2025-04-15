import { QuickPickItem, window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { ai } from './ai-chat';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { basename } from 'path';
import { existsSync } from 'fs';
import { describeProject } from './ai-project-info';
import { getAllFilenames } from './ai-tool-read-folder';
import { getModels, Model, Pricing } from './ai-openrouter';
import { ChatRequest } from './ai-tool';

export async function chat(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  const chatting = true;
  let prompt: string | undefined;
  let activeFile = window.activeTextEditor?.document.uri.fsPath;
  while (chatting) {
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
      for (const tabGroup of window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
          const uri = (tab.input as any).uri;
          if (uri && existsSync(uri.fsPath)) {
            files.push(uri.fsPath);
          }
        }
      }
      // window.visibleTextEditors.forEach((editor) => {
      //   if (existsSync(editor.document.uri.fsPath)) {
      //     files.push(editor.document.uri.fsPath);
      //   }
      // });
      if (!activeFile && files.length > 0) {
        activeFile = files[0];
      }
      files = files.filter((file) => file !== activeFile);
      if (files.length === 0) {
        const otherFiles = getAllFilenames(project.projectFolder(), ['node_modules', 'dist', 'www']);
        files.push(...otherFiles);
      }

      const request: ChatRequest = {
        prompt,
        activeFile,
        files,
      };
      await ai(request, project);
    }
    prompt = undefined;
  }
}

function totalPrice(price: Pricing): number {
  const total = v(price.prompt) + v(price.completion);

  return total * 1000000;
}

function v(s: string): number {
  if (!s) return 0;
  return Number(s);
}

// Not used yet
export async function chatModel(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  const models: Model[] = await getModels();
  models.map((m) => (m.ppm = totalPrice(m.pricing)));
  //models.sort((a, b) => a.name.localeCompare(b.name));
  models.sort((a, b) => a.ppm - b.ppm);
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
        ? ''
        : `$${totalPrice(model.pricing).toFixed(2)}m`;

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
