import { existsSync, readdirSync, readFile, readFileSync } from 'fs';
import { join } from 'path';
import { write, writeError } from './logging';
import { ToolResult } from './ai-tool';

export const searchForFileToolName = 'search_for_file';

export function searchForFile(path: string, args: any): ToolResult {
  const files: any[] = readdirSync(path, { recursive: true }).filter((file: string) => {
    return file.startsWith('node_modules');
  });
  const file: string | undefined = files.find((file) => file.includes(args.filename));
  if (!file) {
    writeError(`Could not find file ${args.filename} in ${path}`);
    return undefined;
  }
  write(`> Search for ${file} and return its contents`);
  return {
    result: readFileSync(join(path, file), 'utf-8'),
    context: `Contents of file ${file}`,
  };
}

export function searchForFileFunction(): any {
  return {
    type: 'function',
    function: {
      name: searchForFileToolName,
      description: 'Search for a filename and return its contents',
      parameters: {
        type: 'object',
        properties: {
          folder: {
            type: 'string',
            description: 'The folder to read',
          },
          filename: {
            type: 'string',
            description: 'The filename to search for',
          },
        },
      },
    },
  };
}
