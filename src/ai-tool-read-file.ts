import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { write, writeError } from './logging';
import { getAllFilenames } from './ai-tool-read-folder';
import { ToolResult } from './ai-tool';

export const readFileToolName = 'read_file';

export function readFile(path: string, args: any): ToolResult {
  let pth = join(path, args.filename);
  if (!existsSync(pth)) {
    const filename = closestMatch(args.filename, path);
    if (!filename) {
      writeError(`File ${pth} could not be found in ${path}`);
      return { result: '', context: `Contents of file ${pth}` };
    } else {
      pth = filename;
    }
  }
  const data = readFileSync(pth, 'utf8');
  write(`> Read file ${pth}`);
  return { result: data, context: `Contents of file ${pth}` };
}

function closestMatch(filename: string, path: string): string | undefined {
  const files = getAllFilenames(path, ['node_folders', 'dist', 'www']);
  const matches = files.filter((file) => file.includes(filename));
  if (matches.length === 0) {
    return undefined;
  }
  return matches[0];
}

export function readFileFunction(): any {
  return {
    type: 'function',
    function: {
      name: readFileToolName,
      description: 'Read a file from the local filesystem',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'The name of the file to read',
          },
          // unit: {
          // 	type: "string",
          // 	enum: ["celsius", "fahrenheit"],
          // },
        },
      },
    },
  };
}
