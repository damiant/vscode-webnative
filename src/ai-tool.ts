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
  folder: string;
  fileMap?: { [key: string]: string };
  context: ProjectContext;
}

export interface ProjectContext {
  url: string; // Url of the browser when the chat was initiated
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
  provideFiles: boolean;
  sonnetFix: boolean;
}
