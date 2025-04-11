import Together from 'together-ai';
import { ExtensionSetting, getExtSetting, getSetting, WorkspaceSetting } from './workspace-state';
import { showOutput, write, writeError } from './logging';
import { showProgress } from './utilities';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

let _openai = undefined;

export interface Model {
  id: string;
  name: string;
  description: string;
  pricing: Pricing;
  input_modalities: string[]; // eg image, text
  output_modalities: string[]; // eg text
}

export interface Pricing {
  prompt: string;
  completion: string;
  request: string;
  image: string;
  web_search: string;
  internal_reasoning: string;
}

export function getAI(): Together {
  return new Together({ apiKey: apiKey() });
}

function apiKey() {
  const key = getExtSetting(ExtensionSetting.aiKey);
  if (!key) {
    writeError(`A key is require to use AI Chat. Set it in settings. Get your key from https://openrouter.ai/`);
    return undefined;
  }
  return key;
}

function includeFiles(folder: string, files: string[], prompts: string): any {
  const availableFiles = readdirSync(folder);
  const newContent = [];
  for (const availableFile of availableFiles) {
    if (files.includes(availableFile)) {
      const data = readFileSync(join(folder, availableFile), 'utf8');
      const file_data = `data:application/x-typescript;base64,${btoa(data)}`;
      newContent.push({
        type: 'file',
        file: {
          filename: availableFile,
          file_data: file_data,
        },
      });
      write(`Including "${availableFile}"`);
    }
  }
  newContent.push({ type: 'text', text: prompts });
  return prompts;
}

export async function ai(prompt: string, folder: string) {
  let model = getSetting(WorkspaceSetting.aiModel);
  model = 'Qwen/Qwen2.5-Coder-32B-Instruct';
  if (!model) {
    writeError(`No AI model selected. Select one in settings.`);
    return;
  }

  let completion: any;
  let content = prompt;
  content = includeFiles(join(folder, 'src'), ['main.ts'], content);
  await showProgress('Thinking...', async () => {
    completion = await getAI().chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
    });
  });
  if (completion.error) {
    writeError(completion.error.message);
  } else {
    write(`${completion.choices[0].message.content}`);
  }
}

export async function getModels(): Promise<Model[]> {
  // https://openrouter.ai/api/v1/models
  const response = await fetch('https://openrouter.ai/api/v1/models', { method: 'GET' });
  const body = await response.json();
  // see https://openrouter.ai/docs/api-reference/list-available-models/~explorer
  return body.data;
}
