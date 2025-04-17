import { window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { ai } from './ai-chat';
import { basename, join } from 'path';
import { existsSync } from 'fs';
import { describeProject } from './ai-project-info';
import { getAllFilenames } from './ai-tool-read-folder';
import { ChatRequest, Options } from './ai-tool';

export async function chat(queueFunction: QueueFunction, project: Project) {
  const chatting = true;
  let prompt: string | undefined;
  let activeFile = window.activeTextEditor?.document.uri.fsPath;
  let queued = false;
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
      if (!queued) {
        queued = true;
        queueFunction();
      }
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
        const srcFolder = join(project.projectFolder(), 'src');
        const srcFiles = getAllFilenames(srcFolder, ['node_modules', 'dist', 'www']);
        if (existsSync(join(project.projectFolder(), 'index.html'))) {
          files.push(join(project.projectFolder(), 'index.html'));
        }

        if (srcFiles.length == 0) {
          const otherFiles = getAllFilenames(project.projectFolder(), ['node_modules', 'dist', 'www']);
          files.push(...otherFiles);
        } else {
          files.push(...srcFiles);
        }
      }

      const request: ChatRequest = {
        prompt,
        activeFile,
        folder: project.projectFolder(),
        files,
      };

      const options: Options = {
        useTools: true, // Tools works for some models. Note: tools repeat requests with OpenRouter
        stream: false, // OpenAI SDK jacks up calls for streaming through OpenRouter
        provideFiles: false, // If you use tools then you don't need to provide files
        sonnetFix: false, // Claude Sonnet hack for OpenRouter to get tool results in expected format
      };

      await ai(request, project, options);
    }
    prompt = undefined;
  }
}
