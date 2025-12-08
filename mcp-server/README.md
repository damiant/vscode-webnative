# WebNative MCP Server

Model Context Protocol (MCP) server that provides project analysis and recommendations for Capacitor, Ionic, and Cordova projects. This server exposes the same functionality as the WebNative VS Code extension through MCP tools.

## Features

### Analysis Tools

The MCP server provides four main analysis tools:

1. **`analyze_project`** - Comprehensive project analysis including framework detection, package manager, monorepo support, and platform detection
2. **`get_recommendations`** - Actionable recommendations for version checks, plugin compatibility, deprecated packages, and migrations
3. **`check_plugin_compatibility`** - Plugin compatibility checker with replacement suggestions
4. **`validate_versions`** - Version validation returning only errors and warnings

## Installation

```bash
npm install
npm run build
```

## Usage

### As an MCP Server

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "webnative": {
      "command": "node",
      "args": ["/path/to/vscode-webnative/mcp-server/dist/server.js"]
    }
  }
}
```

### Example: Analyze a Project

```json
{
  "name": "analyze_project",
  "arguments": {
    "projectPath": "/path/to/your/capacitor/project"
  }
}
```

Returns comprehensive project information including framework type, package manager, platforms, and monorepo configuration.

### Example: Get Recommendations

```json
{
  "name": "get_recommendations",
  "arguments": {
    "projectPath": "/path/to/your/capacitor/project"
  }
}
```

Returns array of actionable recommendations with errors, warnings, and suggestions for improvements.

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

### Testing

```bash
npm run test
```

### Linting

```bash
npm run lint
npm run format
```

## Architecture

- **`src/shared/`** - Core infrastructure (analyzer, project model, monorepo detection)
- **`src/rules/`** - Rules engine (Capacitor checks, plugin compatibility)
- **`src/tools/`** - MCP tool implementations

See full documentation in the [detailed README](./DETAILED.md).

### GitHub Actions

This repository has a GitHub Actions workflow that runs linting, formatting, tests, and publishes package updates to NPM using [semantic-release](https://semantic-release.gitbook.io/semantic-release/).

In order to use this workflow, you need to:

1. Add `NPM_TOKEN` to the repository secrets
   1. [Create a new automation token](https://www.npmjs.com/settings/punkpeye/tokens/new)
   2. Add token as `NPM_TOKEN` environment secret (Settings → Secrets and Variables → Actions → "Manage environment secrets" → "release" → Add environment secret)
1. Grant write access to the workflow (Settings → Actions → General → Workflow permissions → "Read and write permissions")
