import { QuickPickItem, ThemeIcon, window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { showOutput, write } from './logging';
import { ai, apiKey, ChatRequest } from './ai-chat';
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
  let models: any[] = await getModels();
  models = models.filter((model) => availableModels().includes(model.id));
  models.sort((a, b) => a.display_name.localeCompare(b.display_name));
  const items: QuickPickItem[] = models.map((model) => {
    // {hourly: 0, input: 0, output: 0, base: 0, finetune: 0}
    const price =
      model.pricing.hourly == 0 &&
      model.pricing.input == 0 &&
      model.pricing.output == 0 &&
      model.pricing.base == 0 &&
      model.pricing.finetune == 0
        ? 'Free'
        : `Paid in:${model.pricing.input.toFixed(2)} out:${model.pricing.output.toFixed(2)}`;
    let icon = '$(file-binary)';
    if (model.type == 'embedding') {
      icon = '$(file)';
    }
    if (model.type == 'chat') {
      icon = '$(comment-discussion)';
    }
    if (model.type == 'image') {
      icon = '$(eye)';
    }
    if (model.type == 'code') {
      icon = '$(code)';
    }
    return { label: `${icon} ${model.display_name}`, description: `(${price})` };
  });
  const result = await window.showQuickPick(items, {
    placeHolder: 'Select an AI Model',
    canPickMany: false,
  });
  if (!result) return;
  const model = models.find((m) => m.display_name == result.label);
  setSetting(WorkspaceSetting.aiModel, model.id);
}

function availableModels(): string[] {
  // Only some models can use function calling
  // https://docs.together.ai/docs/function-calling#supported-models
  return [
    'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    'Qwen/Qwen2.5-7B-Instruct-Turbo',
    'Qwen/Qwen2.5-72B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  ];
}

async function getModels(): Promise<any[]> {
  const res = await fetch('https://api.together.xyz/v1/models', { headers: { Authorization: 'Bearer ' + apiKey() } });
  const list = await res.json();
  return list;
}
