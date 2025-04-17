import { readdirSync } from 'fs';
import { extname, join } from 'path';
import { write } from './logging';
import { ToolResult } from './ai-tool';

export const readFolderToolName = 'read_folder';

export function readFolder(path: string): ToolResult {
  let files = getAllFilenames(path, ['node_modules', 'dist', 'www', 'ios', 'android', 'out', 'public', 'resources']);
  write(`> Read folder ${path}`);
  files = files.filter((file) => {
    const ext = extname(file).toLowerCase();
    return ['.ts', '.html', '.js', '.css', '.scss', '.vue', '.svelte'].includes(ext);
  });
  files = files.map((file) => file.replace(path, '- [root]'));
  return {
    result: files.join('\n'), // JSON.stringify(files),
    context: `Contents of folder ${path}`,
  };
}

export function readFolderFunction(): any {
  return {
    type: 'function',
    function: {
      name: readFolderToolName,
      description: 'Get all the projects filenames to know what to change',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  };
}

export function getAllFilenames(dir: string, ignoreFolders: string[] = []): string[] {
  const filenames: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoreFolders.includes(entry.name) && !entry.name.startsWith('.')) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        filenames.push(fullPath);
      }
    }
  }

  walk(dir);

  return filenames;
}
