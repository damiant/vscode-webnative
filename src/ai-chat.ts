import { getSetting, WorkspaceSetting } from './workspace-state';
import { showOutput, write, writeAppend, writeError } from './logging';
import { showProgress } from './utilities';
import { systemPrompt } from './ai-prompts';
import { readFileToolName, readFileFunction, readFile } from './ai-tool-read-file';
import { writeFile, writeFileFunction, writeFileToolName } from './ai-tool-write-file';
import { readFolder, readFolderFunction, readFolderToolName } from './ai-tool-read-folder';
import { searchForFile, searchForFileFunction, searchForFileToolName } from './ai-tool-search-for-file';
import { Call, CallResult, ChatRequest, Options, ToolResult } from './ai-tool';
import { readFileSync, writeFileSync } from 'fs';
import { describeProject } from './ai-project-info';
import { Progress, window } from 'vscode';
import { aiLog, aiWriteLog } from './ai-log';
import { AIBody, completions, Message, AIResponse } from './ai-openrouter';

export async function ai(request: ChatRequest, folder: string) {
  const options: Options = {
    useTools: true,
    stream: false, // OpenAI SDK jacks up calls for streaming through OpenRouter
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
  let response: AIResponse;
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
    //prompt += `\nThese files can be used to fulfill the request: ${request.files.join(', ')}`;
  }

  let prompts = [prompt];
  let iteration = 0;
  let content = '';
  callHistory = [];

  await showProgress(
    `AI: ${request.prompt}...`,
    async (progress: Progress<{ message?: string; increment?: number }>) => {
      let repeating = true;
      while (repeating) {
        const prompt = prompts.shift();
        if (!prompt) {
          repeating = false;
          return;
        }

        const messages: Message[] = [
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
        progress.report({ increment: iteration * 10 });
        //progress.report({ message: `${prompt}...` });
        let toolHasResult = true;
        let firstTime = true;
        while (toolHasResult || firstTime) {
          if (toolHasResult) {
            // write(`> Resuming after getting more information`);
          }
          toolHasResult = false;
          firstTime = false;
          const body: AIBody = {
            model: model,
            stream: options.stream,
            messages: messages,
          };
          if (options.useTools) {
            //body.tool_choice = 'required';
            body.tools = [readFileFunction(), searchForFileFunction(), readFolderFunction(), writeFileFunction()];
          }
          try {
            aiLog(`### Completion Request`);
            aiLog(JSON.stringify(body, null, 2));
            response = await completions(body);
          } catch (e) {
            writeError(`Error: ${e}`);
            showOutput();
            break;
          }

          if (response.error) {
            writeError(response.error.message);
            writeError(JSON.stringify(response.error.metadata));
            repeating = false;
          } else {
            content = (response.choices[0].message.content || '') as string;
            if (content.length > 0) {
              write(`\n${content}`);
            }
            progress.report({ message: content });
            const toolCalls = response.choices[0].message.tool_calls;
            if (toolCalls) {
              for (const call of toolCalls) {
                if (call && call.function) {
                  let callResult: CallResult;
                  try {
                    callResult = callFunction(path, call);
                  } catch (e) {
                    aiWriteLog(path);
                    writeError(`Error calling function ${call.function.name}: ${e}`);
                  }
                  if (!callResult) {
                    break;
                  }
                  messages.push({
                    //tool_use_id: id,
                    role: 'user',
                    toolCallId: callResult.id,
                    name: callResult.name,
                    content: JSON.stringify([
                      { type: 'tool_result', tool_use_id: callResult.id, content: callResult.toolResult.result },
                    ]),
                  });

                  toolHasResult = true;
                }
              }
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
                  }
                } else {
                  // Have the LLM answer its requests
                  prompts.push(...list);
                }
              } else {
                //performChanges(content, request.activeFile);
              }
            }
          }
        }
        aiWriteLog(path);
      }
    },
  );
}

let callHistory: Call[] = [];

function callFunction(
  path: string,
  call: { id?: string; function?: { name?: string; arguments?: string } },
): CallResult {
  const id = call.id;
  const name = call.function.name;
  const args = JSON.parse(call.function.arguments);
  let toolResult: ToolResult;

  const alreadyCalled = callHistory.find((c) => c.name === name && c.args === call.function.arguments);
  if (alreadyCalled) {
    writeError(`${name} already called. Aborting`);
    return undefined;
  }
  callHistory.push({ name, args: call.function.arguments });

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
