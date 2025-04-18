import { getSetting, WorkspaceSetting } from './workspace-state';
import { showOutput, write, writeError, writeWN } from './logging';
import { getRunOutput, showProgress } from './utilities';
import { systemPrompt } from './ai-prompts';
import { readFileToolName, readFileFunction, readFile } from './ai-tool-read-file';
import { writeFile, writeFileFunction, writeFileToolName } from './ai-tool-write-file';
import { readFolder, readFolderFunction, readFolderToolName } from './ai-tool-read-folder';
import { searchForFile, searchForFileFunction, searchForFileToolName } from './ai-tool-search-for-file';
import { Call, CallResult, ChatRequest, ChatResult, Options, ToolResult } from './ai-tool';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { describeProject } from './ai-project-info';
import { Progress, window } from 'vscode';
import { aiLog, aiWriteLog } from './ai-log';
import { AIBody, completions, Message, AIResponse } from './ai-openrouter';
import { contextInfo, inputFiles } from './ai-utils';
import { build } from './build';
import { Project } from './project';
import { performChanges } from './ai-changes';

export async function ai(request: ChatRequest, project: Project, options: Options): Promise<string | undefined> {
  const model = getSetting(WorkspaceSetting.aiModel);
  if (model === '' || !model) {
    writeError(`No AI model selected. Select one in settings.`);
    return `No AI model selected. Select one in settings.`;
  }

  let response: AIResponse;
  const result: ChatResult = { filesChanged: {}, filesCreated: {}, comments: [], buildFailed: false };
  const path = project.projectFolder();
  let prompt = request.prompt;

  if (request.context?.url) {
    const info = contextInfo(request.context);
    if (info) {
      prompt = `${prompt}\nAdditional Context: ${info}.`;
    }
  }

  if (!options.useTools) {
    prompt = `${prompt}\n${inputFiles(request, options)}`;
  } else {
    prompt = `${prompt}\n${inputFiles(request, options)}`;
    //prompt = `Modify this file ${request.activeFile}: ${prompt}`;
  }

  let sysPrompt = systemPrompt.replace('@project', describeProject());
  if (options.useTools) {
    sysPrompt += `\nYou can use external tools to access and find other files in the project.`;
  }

  if (request.files.length > 0 && options.useTools) {
    //prompt += `\nThese files can be used to fulfill the request: ${request.files.join(', ')}`;
  }

  let prompts = [prompt];
  let iteration = 0;
  let content = '';
  let changedFiles = false;
  callHistory = [];

  await showProgress(`AI: `, async (progress: Progress<{ message?: string; increment?: number }>) => {
    let repeating = true;
    while (repeating) {
      const prompt = prompts.shift();

      if (!prompt) {
        repeating = false;
        return;
      }
      progress.report({ message: request.prompt });

      const messages: Message[] = [
        {
          role: 'system',
          content: sysPrompt,
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
      progress.report({ message: request.prompt, increment: iteration * 10 });
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
                  role: 'tool', // 'user',
                  toolCallId: callResult.id,
                  //tool_call_id: callResult.id,
                  name: callResult.name,
                  content: contentForToolResult(callResult, options),
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
              progress.report({ message: 'Changing Files....' });
              changedFiles = performChanges(content, request, result);
              if (changedFiles || result.buildFailed) {
                progress.report({ message: 'Building Project....' });
                const abort = await buildProject(project, request, result, options, prompts);
                if (abort) {
                  progress.report({ message: 'Reverting....' });
                  revert(result);
                } else if (result.buildFailed) {
                  progress.report({ message: 'Fixing Errors....' });
                  // Try again. New prompt was added
                  repeating = true;
                }
              }
            }
          }
        }
      }
      aiWriteLog(path);
    }
  });

  const more = 'Info';
  const revertChanges = 'Revert';
  const accept = changedFiles ? 'Accept' : 'Ok';
  let comments = result.comments.join(' ').trim();
  if (result.buildFailed) {
    comments += ` Unfortunately, the AI failed to create a project that built without errors.`;
  }
  const message = result.comments.length > 0 ? comments : `Completed: ${request.prompt}`;
  const res = await window.showInformationMessage(message, accept, revertChanges, more);
  if (res == revertChanges) {
    revert(result);
  }
  if (res === more) {
    showOutput();
  }
  return undefined;
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
      toolResult = readFolder(path);
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

function revert(result: ChatResult): void {
  for (const filename in result.filesChanged) {
    const contents = result.filesChanged[filename];
    writeFileSync(filename, contents, 'utf-8');
  }
  for (const filename in result.filesCreated) {
    const contents = result.filesCreated[filename];
    if (existsSync(filename)) {
      unlinkSync(filename);
    }
  }
  writeWN(`Reverted changes.`);
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

// Returns true if we are aborting
async function buildProject(
  project: Project,
  request: ChatRequest,
  result: ChatResult,
  options: Options,
  prompts: string[],
): Promise<boolean> {
  const cmd = await build(project, {});
  try {
    const data = await getRunOutput(cmd, project.projectFolder(), undefined, true, false, true);
    result.buildFailed = false;
    return false;
  } catch (error) {
    if (!result.buildFailed) {
      result.buildFailed = true;
      prompts.push(
        `The build is failing with these errors that need to be fixed:\n${error}\n${inputFiles(request, options)}`,
      );
      return false;
    } else {
      // We tried fixing once. Time to abort and revert
      return true;
    }
  }
}
function contentForToolResult(callResult: CallResult, options: Options): string {
  if (options.sonnetFix) {
    return JSON.stringify([{ type: 'tool_result', tool_use_id: callResult.id, content: callResult.toolResult.result }]);
  }
  return callResult.toolResult.result;
}
