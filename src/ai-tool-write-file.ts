import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ToolResult } from './ai-tool';
import { write } from './logging';

export const writeFileToolName = 'write_file';

export function writeFile(path: string, args: any): ToolResult {
  let pth = args.filename;
  if (!args.filename.includes(path)) {
    pth = join(path, args.filename);
  }

  const data = writeFileSync(pth, args.contents);
  write(`> write file ${pth}`);
  return { result: '', context: `File ${pth} written` };
}

export function writeFileFunction(): any {
  return {
    type: 'function',
    function: {
      name: writeFileToolName,
      description: 'Write a file to the local filesystem',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'The name of the file to write',
          },
          contents: {
            type: 'string',
            description: 'The contents of the file',
          },
        },
      },
    },
  };
}
