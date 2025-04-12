import Together from 'together-ai';
import { ExtensionSetting, getExtSetting, getSetting, WorkspaceSetting } from './workspace-state';
import { write, writeAppend, writeError } from './logging';
import { showProgress } from './utilities';
import { softwareArchitectPrompt } from './ai-prompts';
import { readFileToolName, readFileFunction, readFile } from './ai-tool-read-file';
import { writeFile, writeFileFunction, writeFileToolName } from './ai-tool-write-file';
import { readFolder, readFolderFunction, readFolderToolName } from './ai-tool-read-folder';
import { searchForFile, searchForFileFunction, searchForFileToolName } from './ai-tool-search-for-file';
import { ToolResult } from './ai-tool';
import { existsSync, writeFileSync } from 'fs';

export interface ChatRequest {
  prompt: string;
  activeFile: string | undefined;
  files: string[];
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

export async function ai(request: ChatRequest, folder: string) {
  let model = getSetting(WorkspaceSetting.aiModel);
  model = 'Qwen/Qwen2.5-72B-Instruct-Turbo'; // 'Qwen/Qwen2.5-Coder-32B-Instruct';
  if (!model) {
    writeError(`No AI model selected. Select one in settings.`);
    return;
  }

  let response;
  const stream = false;
  const path = folder;
  let prompt = request.prompt;
  if (request.activeFile) {
    prompt += `Use this file to fulfill this request: ${request.activeFile}`;
  }
  if (request.files.length > 0) {
    prompt += `\nThese files can be used to fulfill the request: ${request.files.join(', ')}`;
  }

  const prompts = [prompt];

  await showProgress('Thinking...', async () => {
    let repeating = true;
    let lastResult = '';
    while (repeating) {
      let prompt = prompts.shift();
      if (!prompt) {
        repeating = false;
        return;
      }

      if (lastResult && lastResult !== '') {
        prompt = prompt + lastResult;
      }
      const messages: any = [
        {
          role: 'system',
          content: softwareArchitectPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ];
      write(`> ${prompt}`);
      let toolHasResult = true;
      let firstTime = true;
      while (toolHasResult || firstTime) {
        if (toolHasResult) {
          // write(`> Resuming after getting more information`);
        }
        toolHasResult = false;
        firstTime = false;
        response = await getAI().chat.completions.create({
          model: model,
          stream,
          tools: [readFileFunction(), searchForFileFunction(), readFolderFunction(), writeFileFunction()],
          tool_choice: 'auto',
          messages: messages,
        });

        if (stream) {
          for await (const chunk of response) {
            writeAppend(chunk.choices[0]?.delta?.content || '');
          }
        }
        let toolResult: ToolResult | undefined;
        if (response.error) {
          writeError(response.error.message);
          repeating = false;
        } else {
          if (!stream) {
            const calls = response.choices[0].message.tool_calls;
            if (calls && calls.length > 0) {
              for (const call of calls) {
                const id = call.id;
                const name = call.function.name;
                const args = JSON.parse(call.function.arguments);
                //write(`> ${name}`);

                switch (name) {
                  case readFileToolName:
                    toolResult = readFile(path, args);
                    break;
                  case writeFileToolName:
                    toolResult = writeFile(path, args);
                    break;
                  case readFolderToolName:
                    toolResult = readFolder(path, args);
                    break;
                  case searchForFileToolName:
                    toolResult = searchForFile(path, args);
                    break;
                  default:
                    throw new Error(`Unknown tool ${name}`);
                    break;
                }
                messages.push({
                  tool_call_id: id,
                  role: 'tool',
                  name: name,
                  content: toolResult.result,
                });
                toolHasResult = true;
              }
            }

            if (!toolHasResult) {
              const result = response.choices[0].message.content;
              let output = result;
              if (result) {
                const newOutput = performChanges(`${result}`);
                if (newOutput) {
                  output = newOutput;
                }
                lastResult = result;
              }
              if (!result) {
                lastResult = `\n${toolResult.context}:\n${toolResult.result}`;
              }
              if (result && result.includes('@prompt')) {
                const list = extractPrompts(result);
                if (hasQuestions(list)) {
                  // Stop here as the LLM has questions
                  output = list.join('\n');
                } else {
                  // Have the LLM answer its requests
                  prompts.push(...list);
                  lastResult = '';
                }
              }

              write(`${output}`);
            }
          }
        }
      }
    }
  });
}

function performChanges(input: string): string | undefined {
  if (input.startsWith('@changefile:')) {
    const file = input.split('@changefile:')[1].split('\n')[0].trim();
    // newContent is everything after the first line
    const newContent = input.split('\n').slice(1).join('\n');
    if (!existsSync(file)) {
      writeError(`AI wanted to write to file ${file} but it does not exist`);
      return undefined;
    }
    writeFileSync(file, newContent);
    return `Changed file ${file}`;
  }
  return undefined;
}

function hasQuestions(list: string[]): boolean {
  for (const line of list) {
    if (line.includes('?')) {
      return true;
    }
  }
  return false;
}

function extractPrompts(input: string): string[] {
  const lines = input.split('\n');
  const prompts: string[] = [];

  for (const line of lines) {
    const match = line.match(/^@prompt:\s*(.*)$/);
    if (match) {
      prompts.push(match[1]);
    }
  }

  return prompts;
}
