import OpenAI from 'openai';
import { ExtensionSetting, getExtSetting, getSetting, WorkspaceSetting } from './workspace-state';
import { showOutput, write, writeError } from './logging';
import { showProgress } from './utilities';

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

function openAI() {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey(),
      defaultHeaders: {
        'HTTP-Referer': 'https://webnative.dev', // Optional. Site URL for rankings on openrouter.ai.
        'X-Title': 'WebNative.dev', // Optional. Site title for rankings on openrouter.ai.
      },
    });
  }
  return _openai;
}

function apiKey() {
  const key = getExtSetting(ExtensionSetting.openRouterKey);
  if (!key) {
    writeError(`A key is require to use AI Chat. Set it in settings. Get your key from https://openrouter.ai/`);
    return undefined;
  }
  return key;
}

export async function ai(prompt: string) {
  const model = getSetting(WorkspaceSetting.aiModel);
  if (!model) {
    writeError(`No AI model selected. Select one in settings.`);
    return;
  }
  let completion;
  await showProgress('Thinking...', async () => {
    completion = await openAI().chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt,
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
