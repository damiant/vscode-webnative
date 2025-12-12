import * as vscode from 'vscode';
import { getWhatsNewContent } from './whats-new-content';
import { readFileSync } from 'fs';
import { join } from 'path';

const WHATS_NEW_REVISION_KEY = 'webnative.whatsNewRevision';

/**
 * Shows the What's New page in a VS Code webview panel
 * @param context Extension context for accessing global state
 * @param forceShow If true, shows the page regardless of whether it was shown before
 */
export async function showWhatsNew(context: vscode.ExtensionContext, forceShow = false): Promise<void> {
  const packageJsonPath = join(context.extensionPath, 'package.json');
  const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);
  const currentRevision = packageJson.whatsNewRevision || 1;
  const lastShownRevision = context.globalState.get<number>(WHATS_NEW_REVISION_KEY, 0);

  // Only show if revision is newer or forceShow is true
  if (!forceShow && lastShownRevision === currentRevision) {
    return;
  }

  // Create and show the webview panel
  const panel = vscode.window.createWebviewPanel(
    'webnativeWhatsNew',
    "What's New in WebNative",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  // Set the HTML content
  panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    (message) => {
      switch (message.command) {
        case 'openExternal':
          if (message.url) {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
          }
          break;
      }
    },
    undefined,
    context.subscriptions,
  );

  // Update the last shown revision
  if (!forceShow) {
    await context.globalState.update(WHATS_NEW_REVISION_KEY, currentRevision);
  }
}

/**
 * Checks if the What's New page should be shown and displays it if needed
 * @param context Extension context
 */
export async function checkAndShowWhatsNew(context: vscode.ExtensionContext): Promise<void> {
  await showWhatsNew(context, false);
}

/**
 * Generates the complete HTML content for the webview
 */
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const content = getWhatsNewContent();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; media-src https://webnative.dev https:; frame-src https:;">
    <title>What's New in WebNative</title>
    <style>
        ${getStyles()}
    </style>
</head>
<body>
    ${content}
    <script>
        ${getScript()}
    </script>
</body>
</html>`;
}

/**
 * Returns CSS styles that match VS Code's theme
 */
function getStyles(): string {
  return `
        * {
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            font-weight: var(--vscode-font-weight);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 0;
            margin: 0;
            line-height: 1.5;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 300;
            color: var(--vscode-foreground);
            margin: 0 0 1.5rem 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 1rem;
        }

        h2 {
            font-size: 1.8rem;
            font-weight: 400;
            color: var(--vscode-foreground);
            margin: 2rem 0 1rem 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 0.5rem;
        }

        h3 {
            font-size: 1.3rem;
            font-weight: 500;
            color: var(--vscode-foreground);
            margin: 1.5rem 0 0.75rem 0;
        }

        p {
            margin: 0.75rem 0;
            color: var(--vscode-descriptionForeground);
        }

        ul, ol {
            margin: 0.75rem 0;
            padding-left: 2rem;
        }

        li {
            margin: 0.5rem 0;
            color: var(--vscode-descriptionForeground);
        }

        code {
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
        }

        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            margin: 1rem 0;
        }

        pre code {
            background-color: transparent;
            padding: 0;
        }

        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }

        a:hover {
            color: var(--vscode-textLink-activeForeground);
            text-decoration: underline;
        }

        .button {
            display: inline-block;
            padding: 0.5rem 1.25rem;
            margin: 0.5rem 0.5rem 0.5rem 0;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            text-align: center;
            text-decoration: none;
            transition: background-color 0.2s;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
            text-decoration: none;
        }

        .button-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .button-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .video-container {
            position: relative;
            width: 100%;
            padding-bottom: 56.25%; /* 16:9 aspect ratio */
            margin: 1.5rem 0;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }

        .video-container iframe,
        .video-container video {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin: 1.5rem 0;
        }

        .feature-card {
            padding: 1.5rem;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }

        .feature-card:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .feature-card h3 {
            margin-top: 0;
        }

        .badge {
            display: inline-block;
            padding: 0.2rem 0.6rem;
            margin: 0 0.25rem;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 500;
        }

        .section {
            margin: 2rem 0;
        }

        img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin: 1rem 0;
        }

        hr {
            border: none;
            border-top: 1px solid var(--vscode-panel-border);
            margin: 2rem 0;
        }
    `;
}

/**
 * Returns JavaScript for handling button clicks and external links
 */
function getScript(): string {
  return `
        const vscode = acquireVsCodeApi();

        // Handle button clicks for external links
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target.tagName === 'A' && target.href) {
                event.preventDefault();
                vscode.postMessage({
                    command: 'openExternal',
                    url: target.href
                });
            }
        });

        // Handle button clicks with data-url attribute
        document.querySelectorAll('.button[data-url]').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const url = button.getAttribute('data-url');
                if (url) {
                    vscode.postMessage({
                        command: 'openExternal',
                        url: url
                    });
                }
            });
        });
    `;
}
