import Together from 'together-ai';
import { ExtensionSetting, getExtSetting, getSetting, WorkspaceSetting } from './workspace-state';
import { showOutput, write, writeAppend, writeError } from './logging';
import { showProgress } from './utilities';
import { systemPrompt } from './ai-prompts';
import { readFileToolName, readFileFunction, readFile } from './ai-tool-read-file';
import { writeFile, writeFileFunction, writeFileToolName } from './ai-tool-write-file';
import { readFolder, readFolderFunction, readFolderToolName } from './ai-tool-read-folder';
import { searchForFile, searchForFileFunction, searchForFileToolName } from './ai-tool-search-for-file';
import { ToolResult } from './ai-tool';
import { readFileSync, writeFileSync } from 'fs';
import { describeProject } from './ai-project-info';
import { Progress, window } from 'vscode';
import { aiLog, aiWriteLog } from './ai-log';

export interface ChatRequest {
  prompt: string;
  activeFile: string | undefined;
  files: string[];
}

export function getAI(): Together {
  return new Together({ apiKey: apiKey() });
}

export function apiKey() {
  const key = getExtSetting(ExtensionSetting.aiKey);
  if (!key) {
    writeError(`A key is require to use AI Chat. Set it in settings.`);
    return undefined;
  }
  return key;
}

interface Options {
  useTools: boolean;
  stream: boolean;
}

export async function ai(request: ChatRequest, folder: string) {
  const options: Options = {
    useTools: false,
    stream: true,
  };
  let model = getSetting(WorkspaceSetting.aiModel);
  if (model === '' || !model) {
    model = 'Qwen/Qwen2.5-72B-Instruct-Turbo';
  }

  if (!model) {
    writeError(`No AI model selected. Select one in settings.`);
    return;
  }

  showOutput();
  let response;
  const path = folder;
  let prompt = request.prompt;
  if (request.activeFile) {
    if (!options.useTools) {
      prompt = `${prompt}\nInput file:\n${readFileSync(request.activeFile, 'utf8')}`;
    } else {
      prompt = `Modify this file ${request.activeFile}: ${prompt}`;
    }
  }
  if (request.files.length > 0 && options.useTools) {
    prompt += `\nThese files can be used to fulfill the request: ${request.files.join(', ')}`;
  }

  let prompts = [prompt];
  let iteration = 0;
  let content = '';

  await showProgress(
    `AI: ${request.prompt}...`,
    async (progress: Progress<{ message?: string; increment?: number }>) => {
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
            content: systemPrompt.replace('@project', describeProject()),
          },
          {
            role: 'user',
            content: prompt,
          },
        ];
        write(`> ${prompt}`);
        iteration++;
        aiLog(`#### ${prompt}`);
        aiLog('```typescript');
        aiLog(JSON.stringify(messages, null, 2));
        aiLog('```');

        aiLog(`### Result`);
        progress.report({ increment: iteration });
        //progress.report({ message: `${prompt}...` });
        let toolHasResult = true;
        let firstTime = true;
        while (toolHasResult || firstTime) {
          if (toolHasResult) {
            // write(`> Resuming after getting more information`);
          }
          toolHasResult = false;
          firstTime = false;
          const body: any = {
            model: model,
            stream: options.stream,
            messages: messages,
          };
          if (options.useTools) {
            body.tool_choice = 'required';
            body.tools = [readFileFunction(), searchForFileFunction(), readFolderFunction(), writeFileFunction()];
          }
          try {
            response = await getAI().chat.completions.create(body);
          } catch (e) {
            writeError(`Error: ${e}`);
            showOutput();
            break;
          }

          let toolResult: ToolResult | undefined;
          if (response.error) {
            writeError(response.error.message);
            repeating = false;
          } else {
            let aggregatedToolCall: {
              id?: string;
              function?: { name?: string; arguments?: string };
            } = {};
            let count = 0;
            for await (const chunk of response) {
              aiLog(`### Chunk ${count++}`);
              aiLog('```json');
              aiLog(JSON.stringify(chunk, null, 2));
              aiLog('```');
              const choice = chunk.choices[0];
              content += choice?.delta?.content || '';
              writeAppend(choice?.delta?.content || '');
              aggregateToolCall(choice, aggregatedToolCall);

              if (!choice?.finish_reason) {
                continue;
              }
              const call = aggregatedToolCall;
              if (call && call.function) {
                let id;
                let name;
                try {
                  ({ id, name, toolResult } = callFunction(call, toolResult));
                } catch (e) {
                  aiWriteLog(path);
                  writeError(`Error calling function ${call.function.name}: ${e}`);
                }
                messages.push({
                  tool_call_id: id,
                  role: 'tool',
                  name: name,
                  content: toolResult.result,
                });
                aggregatedToolCall = {};
                toolHasResult = true;
              }

              if (!toolHasResult) {
                if (content && content.includes('@prompt')) {
                  const list = extractPrompts(content);
                  if (hasQuestions(list)) {
                    // Stop here as the LLM has questions
                    const newPrompt = await askQuestions(prompt, list);
                    if (newPrompt) {
                      repeating = true;
                      prompts = [newPrompt];
                      lastResult = '';
                    }
                    // content = list.join('\n');
                    // showOutput();
                  } else {
                    // Have the LLM answer its requests
                    prompts.push(...list);
                    lastResult = '';
                  }
                } else {
                  performChanges(content, request.activeFile);
                }
                // const result = chunk.choices[0].delta.content;
                // let output = result;
                if (content) {
                  // const newOutput = performChanges(`${content}`);
                  // if (newOutput) {
                  //   content = newOutput;
                  // }
                  lastResult = content;
                }
                if (!content && toolResult) {
                  lastResult = `\n${toolResult.context}:\n${toolResult.result}`;
                }
              }
            }
          }
        }
        aiWriteLog(path);
      }
    },
  );

  function callFunction(
    call: { id?: string; function?: { name?: string; arguments?: string } },
    toolResult: ToolResult,
  ) {
    const id = call.id;
    const name = call.function.name;
    const args = JSON.parse(call.function.arguments);

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
    return { id, name, toolResult };
  }

  function aggregateToolCall(
    choice: any,
    aggregatedToolCall: { id?: string; function?: { name?: string; arguments?: string } },
  ) {
    if (choice.delta.tool_calls?.[0]) {
      const toolCall = choice.delta.tool_calls[0];
      if (toolCall.id) aggregatedToolCall.id = toolCall.id;
      if (toolCall.function) {
        if (!aggregatedToolCall.function) aggregatedToolCall.function = {};
        if (toolCall.function.name) aggregatedToolCall.function.name = toolCall.function.name;
        if (toolCall.function.arguments)
          aggregatedToolCall.function.arguments =
            (aggregatedToolCall.function.arguments || '') + toolCall.function.arguments;
      }
    }
  }
}

async function askQuestions(firstPrompt: string, prompts: string[]): Promise<string | undefined> {
  let newPrompt = firstPrompt;
  for (const prompt of prompts) {
    const response = prompt.trim();
    const answer = await window.showInputBox({ prompt, ignoreFocusOut: true });
    if (answer && answer !== '') {
      newPrompt += `\n${response}: ${answer}`;
    } else {
      return undefined;
    }
  }
  return newPrompt;
}

function performChanges(input: string, filename: string): void {
  if (input.startsWith('```')) {
    const lines = input.split('\n').slice(1);
    lines.pop();
    input = lines.join('\n');
  }
  if (!filename) {
    writeError(`No file was specified.`);
  }
  writeFileSync(filename, input);
  write(``);
  write(`Changed file ${filename}`);
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
