import { readdirSync, readFileSync } from 'fs';
import { ChatRequest } from './ai-tool';
import { writeError } from './logging';
import { ExtensionSetting, getExtSetting } from './workspace-state';
import { basename, dirname, extname, join } from 'path';

export function apiKey() {
  const key = getExtSetting(ExtensionSetting.aiKey);
  if (!key) {
    writeError(`A key is require to use AI Chat. Set it in settings.`);
    return undefined;
  }
  return key;
}

export function inputFiles(request: ChatRequest): string {
  const extension = extname(request.activeFile);
  const filenameOnly = basename(request.activeFile).slice(0, -extension.length);
  const folder = dirname(request.activeFile);
  const filename = request.activeFile.substring(0, request.activeFile.length - extension.length);
  const relatedFiles = filesBeginningWith(folder, filenameOnly);
  let result = '';
  request.fileMap = {};
  for (let file of relatedFiles) {
    result += '\n```' + nameFor(extname(file)) + ' ' + basename(file);
    result += `\n${readFileSync(file, 'utf8')}`;
    result += '\n```';
    request.fileMap[basename(file)] = file;
  }
  return result;
}

function nameFor(extension: string): string {
  switch (extension) {
    case '.js':
      return 'JavaScript';
    case '.ts':
      return 'TypeScript';
    case '.json':
      return 'JSON';
    case '.html':
      return 'HTML';
    case '.css':
      return 'CSS';
    case '.md':
      return 'Markdown';
    case '.py':
      return 'Python';
    case '.java':
      return 'Java';
    case '.scss':
      return 'scss';
    case '.cs':
      return 'C#';
    case '.php':
      return 'PHP';
    case '.rb':
      return 'Ruby';
    case '.swift':
      return 'Swift';
    case '.go':
      return 'Go';
    case '.rs':
      return 'Rust';
    case '.scala':
      return 'Scala';
    case '.kt':
      return 'Kotlin';
    case '.dart':
      return 'Dart';
  }
  return extension.replace('.', '');
}

function filesBeginningWith(folder: string, filename: string): string[] {
  const files = readdirSync(folder, 'utf-8');
  const list = [];
  for (const file of files) {
    if (basename(file).startsWith(filename)) {
      list.push(join(folder, file));
    }
  }
  return list;
}
