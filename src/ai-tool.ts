export interface ToolResult {
  result: string;
  context: string;
}

export interface Call {
  name: string;
  args?: string;
}
export interface CallResult {
  id: string;
  toolResult: ToolResult;
  name: string;
}

export interface ChatRequest {
  prompt: string;
  activeFile: string | undefined;
  files: string[];
  fileMap?: { [key: string]: string };
}

export interface ChatResult {
  filesChanged?: { [key: string]: string };
  filesCreated?: { [key: string]: string };
  comments: string[];
  buildFailed: boolean;
}

export interface Options {
  useTools: boolean;
  stream: boolean;
}
