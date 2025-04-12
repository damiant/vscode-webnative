import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { write } from './logging';
import { ToolResult } from './ai-tool';

export const readFolderToolName = 'read_folder';

export function readFolder(path: string, args: any): ToolResult {
  const files = getAllFilenames(path, ['node_modules', 'dist', 'www']);
  write(`> Read folder ${path}`);
  return {
    result: JSON.stringify(files),
    context: `Contents of folder ${path}`,
  };
}

export function readFolderFunction(): any {
  return {
    type: 'function',
    function: {
      name: readFolderToolName,
      description: 'Read a folder and return all of the files it contains',
      parameters: {
        type: 'object',
        properties: {
          folder: {
            type: 'string',
            description: 'The folder to read',
          },
        },
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
        if (!ignoreFolders.includes(entry.name)) {
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
