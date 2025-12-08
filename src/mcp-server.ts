import { EventEmitter, McpServerDefinition, McpStdioServerDefinition, ExtensionContext } from 'vscode';
import { join } from 'path';

const didChangeEmitter = new EventEmitter<void>();

export class webNativeMCPServerProvider {
  onDidChangeMcpServerDefinitions = didChangeEmitter.event;

  constructor(private context: ExtensionContext) {}

  async provideMcpServerDefinitions(): Promise<McpServerDefinition[]> {
    const output: McpServerDefinition[] = [];

    // Register the WebNative MCP server
    const serverPath = join(this.context.extensionPath, 'mcp-server', 'build', 'index.js');

    output.push(new McpStdioServerDefinition('WebNative MCP Server', 'node', [serverPath], {}, '1.0.0'));

    return output;
  }
}
