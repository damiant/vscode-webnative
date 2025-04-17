import { apiKey } from './ai-utils';
import { writeError } from './logging';

// See https://openrouter.ai/docs/api-reference/list-available-models
export interface Model {
  id: string;
  name: string;
  description: string;
  pricing: Pricing;
  context_length: number;
  architecture: Architecture;
  ppm: number;
}

interface Architecture {
  input_modalities: string[];
  output_modalities: string[];
}

export interface Pricing {
  prompt: string;
  completion: string;
  image: string;
  request: string;
  input_cache_read: string;
  input_cache_write: string;
  web_search: string;
  internal_reasoning: string;
}

export interface AIBody {
  model: string;
  stream: boolean;
  messages: Message[];
  tools?: Tool[];
}

export interface Message {
  tool_calls?: ToolCall[];
  role: string;
  toolCallId?: string; // OpenRouter
  //tool_call_id?: string; // Open AI's property
  name?: string;
  content: string | ToolResult[];
}

interface Tool {
  type: string; // eg function
  function: Function;
}

interface ToolResult {
  type: string; // eg tool_result
  tool_use_id: string;
  content: string;
}

interface Function {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: {
      [key: string]: {
        type: string;
        description: string;
      };
    };
    required: string[];
  };
}

export interface AIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  error?: {
    message: string;
    type: string;
    param: string;
    code: string;
    metadata?: any;
  };
}

interface ToolCall {
  id: string;
  index: number;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface Choice {
  index: number;
  message: Message;
  finish_reason: string;

  delta?: {
    content?: string;
  };
}

export async function completions(body: AIBody): Promise<AIResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey(),
      'HTTP-Referer': 'https://webnative.dev', // Optional. Site URL for rankings on openrouter.ai.
      'X-Title': 'WebNative', // Optional. Site title for rankings on openrouter.ai.
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return json;
  } catch (e) {
    writeError(`Error: ${text}`);
    return undefined;
  }
}

export async function getModels(): Promise<Model[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: 'Bearer ' + apiKey() } });
  const list = await res.json();
  return list.data;
}
