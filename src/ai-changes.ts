import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ChatRequest, ChatResult } from './ai-tool';
import { showOutput, write, writeError, writeWN } from './logging';

export function performChanges(input: string, request: ChatRequest, result: ChatResult): boolean {
  try {
    const lines = input.split('\n');
    let currentFilename = undefined;
    let contents = '';
    let changed = false;
    for (const line of lines) {
      if (line.startsWith('@ChangeFile')) {
        currentFilename = getFilenameFrom(line, request);
        if (contents !== '') {
          write(`${contents}`);
          result.comments.push(contents);
        }

        contents = '';
      } else if (line.startsWith('@WriteFile')) {
        writeWN(`Updated ${currentFilename}`);
        if (existsSync(currentFilename)) {
          const previousContents = readFileSync(currentFilename, 'utf-8');
          result.filesChanged[currentFilename] = previousContents;
        } else {
          result.filesCreated[currentFilename] = contents;
        }
        writeFileSync(currentFilename, contents, 'utf-8');
        changed = true;
        contents = '';
      } else {
        if (!line.startsWith('```')) {
          contents += line + '\n';
        }
      }
    }
    if (contents !== '') {
      result.comments.push(contents);
    }
    return changed;
  } catch (error) {
    writeError(`Error: ${error}`);
    result.comments.push(
      'Unable to perform your request likely due to not having enough context of what files you want changed.',
    );
    return false;
  }
}

function mapped(request: ChatRequest, name: string): string | undefined {
  try {
    return request.fileMap[name];
  } catch {
    return undefined;
  }
}
function getFilenameFrom(line: string, request: ChatRequest): string {
  const name = line.replace('@ChangeFile', '').trim();
  try {
    let fullFilename = mapped(request, name);
    if (!fullFilename) {
      fullFilename = mapped(request, '[root]/' + name);
    }
    if (!fullFilename) {
      fullFilename = name.replace('[root]', request.folder);
    }
    if (fullFilename) {
      return fullFilename;
    } else {
      return name;
    }
    6;
  } catch (error) {
    writeError(`Error getting filename from ${line}`);
    showOutput();
    return name;
  }
}
