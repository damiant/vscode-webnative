import { Uri, Webview, commands, window } from 'vscode';
import { Context, VSCommand } from './context-variables';
import { CommandName } from './command-name';
import { exState } from './wn-tree-provider';
import { join } from 'path';
import { debugBrowser, viewInEditor } from './webview-preview';
import { httpRequest, openUri } from './utilities';
import { write, writeError, writeWarning } from './logging';
import { inspectProject, ProjectSummary } from './project';
import { PackageInfo } from './package-info';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { coerce } from 'semver';

export function qrView(externalUrl: string, localUrl: string) {
  commands.executeCommand(VSCommand.setContext, Context.isDevServing, true);
  commands.executeCommand(CommandName.ViewDevServer, externalUrl, localUrl);
}

export function qrWebView(webview: Webview, externalUrl: string, localUrl: string): string | undefined {
  const onDiskPath = Uri.file(join(exState.context.extensionPath, 'resources', 'qrious.min.js'));
  webview.options = { enableScripts: true };
  const qrSrc = webview.asWebviewUri(onDiskPath);
  if (getSetting(WorkspaceSetting.pluginDrift) !== 'shown') {
    troubleshootPlugins();
  }

  const id = `${Math.random()}`;
  const shortUrl = externalUrl ? externalUrl?.replace('https://', '').replace('http://', '') : undefined;
  if (!externalUrl) {
    webview.html = localUrl
      ? getWebviewQR(`<a href="${localUrl}">${localUrl}</a>`, localUrl, '', id)
      : getWebviewInitial();
  } else {
    const qrUrl = exState.projectRef.isCapacitor
      ? `https://nexusbrowser.com/` + encodeURIComponent(shortUrl)
      : externalUrl;
    webview.html = getWebviewQR(shortUrl, qrUrl, `${qrSrc}`, id);
  }
  webview.onDidReceiveMessage(async (data) => {
    if (data.from !== id) return;
    switch (data.message) {
      case 'troubleshoot':
        troubleshootPlugins();
        break;
      case 'editor':
        viewInEditor(localUrl, true, false, true, true);
        break;
      case 'debug':
        debugBrowser(externalUrl, false);
        break;
      case 'logs':
        commands.executeCommand(CommandName.ShowLogs);
        break;
      case 'browser':
        openUri(localUrl);
        break;
      case 'restart':
        commands.executeCommand(CommandName.RunForWeb);
        setTimeout(() => {
          commands.executeCommand(CommandName.RunForWeb);
        }, 1500);
        break;
      case 'start':
      case 'stop':
        commands.executeCommand(CommandName.RunForWeb);
        //stop(panel);
        break;
      default:
        window.showInformationMessage(data.message);
    }
  });
  return shortUrl;
}

export async function troubleshootPlugins() {
  try {
    // Download https://nexusbrowser.com/assets/app-data.json which is the list of plugins included in nexus browser app
    const data = (await httpRequest('GET', 'nexusbrowser.com', '/assets/app-data.json')) as Plugins;
    const versions = {};
    // These plugins wont matter if they are not in the Nexus Browser
    const unimportant = ['cordova-plugin-ionic'];
    for (const plugin of data.plugins) {
      versions[plugin.name] = plugin.version;
    }
    let problems = 0;
    let problem = '';
    const pluginList = [];

    const summary: ProjectSummary = await inspectProject(exState.rootFolder, exState.context, undefined);
    for (const libType of ['Capacitor Plugin', 'Plugin']) {
      for (const library of Object.keys(summary.packages).sort()) {
        const pkg: PackageInfo = summary.packages[library];
        if (pkg.depType == libType) {
          if (versions[library]) {
            if (versions[library] != pkg.version) {
              const projectv = coerce(pkg.version);
              const browserv = coerce(versions[library]);
              if (projectv.major != browserv.major) {
                writeWarning(
                  `Your project has v${pkg.version} of ${library} but Nexus Browser has v${versions[library]}`,
                );
              } else {
                write(
                  `[info] Your project has v${pkg.version} of ${library} but Nexus Browser has v${versions[library]}`,
                );
              }
            }
          } else if (!unimportant.includes(library)) {
            pluginList.push(library);
            problem = library;
            problems++;
          }
        }
      }
    }
    if (problems == 1) {
      window.showWarningMessage(
        `Your project uses the plugin ${problem} which is not in the Nexus Browser app, so you may have issues related to its functionality.`,
        'Dismiss',
      );
    } else if (problems > 0) {
      writeWarning(
        `Your project has these plugins: ${pluginList.join(
          ', ',
        )} but Nexus Browser does not. You can suggest adding these here: https://github.com/ionic-team/vscode-ionic/issues/91`,
      );
      window.showWarningMessage(
        `Your project has ${problems} plugins that are not in the Nexus Browser app, so you may have issues related to functionality that relies on those plugins.`,
        'Dismiss',
      );
    }
  } catch (err) {
    writeError(err);
  } finally {
    setSetting(WorkspaceSetting.pluginDrift, 'shown');
  }
}

function getWebviewQR(shortUrl: string, externalUrl: string, qrSrc: string, id: string): string {
  return (
    `
	<!DOCTYPE html>
	<html>
	<script src="${qrSrc}"></script>
	<script>
	  const vscode = acquireVsCodeApi();
	  function action(msg) {
		  vscode.postMessage({ message: msg, from: "${id}"});
		}
	</script>
	<style>
	.container {
  padding-top: 10px;
	  width: 100%;    
	  display: flex;
	  flex-direction: column;
	}
	p { 
	  text-align: center;
	  line-height: 1.8;
	}
	i { 
	  opacity: 0.5; 
	  font-style: normal; }
	.row {
	  width: 100%;//280px;
	  margin-right: 20px;
	  text-align: center; 
	}
  .tooltip .tooltiptext {
     visibility: hidden;
     min-width: 180px;
     min-height: 20px;
     background-color: var(--vscode-editor-background);
     color: var(--vscode-button-foreground);
     text-align: center;
     padding: 1rem;
     border-radius: 6px;
     line-height: 150%;
     position: absolute;
     top: 0px;
     margin-left: -45px;
     z-index: 1;
  }

  .tooltip:hover .tooltiptext {
     visibility: visible;
  } 

	a {
	  cursor: pointer;
	}
	</style>
	<body>
	  <div class="container">
		 <div class="row tooltip">
     ` +
    (qrSrc !== ''
      ? `
       <span class="tooltiptext">Scan to view in a mobile browser</span>
      <canvas alt="Scan to view in a mobile browser" id="qr" (onClick)></canvas>
     `
      : ``) +
    `</div>
      <div class="row">
      <i>${shortUrl}</i>
      <p>Open in a <a onclick="action('browser')">Browser</a> or <a onclick="action('editor')">Editor</a><br/>
      <a onclick="action('stop')">Stop</a> or <a onclick="action('restart')">Restart</a> the dev server<br/>
      <a onclick="action('logs')">Show Logs</a>
      </p>			
		 </div>
	  </div>    
	  <script>
	  const qr = new QRious({
		background: 'transparent',
		foreground: '#888',
		element: document.getElementById('qr'),
		size: 150,
		value: '${externalUrl}'
	  });
	  </script>
	</body>
	</html>
	`
  );
}

function getWebviewInitial(): string {
  return ``;
}

interface Plugins {
  plugins: Plugin[];
}
interface Plugin {
  name: string;
  version: string;
}
