import { debug, DebugConfiguration, ViewColumn, WebviewPanel, window } from 'vscode';
import { cancelLastOperation } from './tasks';
import { exState } from './wn-tree-provider';
import { debugSkipFiles } from './utilities';
import { getSetting, WorkspaceSetting } from './workspace-state';

interface device {
  name: string;
  width: number;
  height: number;
  type: string;
}

const devices: Array<device> = [
  { name: 'Web', width: 0, height: 0, type: 'web' },
  { name: 'iPhone SE', width: 375, height: 667, type: 'ios' },
  { name: 'iPhone XR', width: 414, height: 896, type: 'ios' },
  { name: 'iPhone 12 Pro', width: 390, height: 844, type: 'ios' },
  { name: 'iPad Air', width: 820, height: 1180, type: 'ios' },
  { name: 'iPad Mini', width: 768, height: 1024, type: 'ios' },
  { name: 'Pixel 3', width: 393, height: 786, type: 'android' },
  { name: 'Pixel 5', width: 393, height: 851, type: 'android' },
  { name: 'Samsung Galaxy S8+', width: 360, height: 740, type: 'android' },
  { name: 'Samsung Galaxy S20 Ultra', width: 412, height: 915, type: 'android' },
  { name: 'Samsung Galaxy Tab S4', width: 712, height: 1138, type: 'android' },
];

export function viewInEditor(url: string, active?: boolean, existingPanel?: boolean): WebviewPanel {
  const panel = existingPanel
    ? exState.webView
    : window.createWebviewPanel('viewApp', 'Preview', active ? ViewColumn.Active : ViewColumn.Beside, {
        enableScripts: true,
      });

  panel.webview.html = getWebviewContent(url);

  panel.webview.onDidReceiveMessage(async (message) => {
    const device = await selectMockDevice();
    panel.title = device.name;
    panel.webview.postMessage(device);
  });
  return panel;
}

export function getDebugBrowserName(): string {
  const browser = getDebugBrowserSetting();
  if (browser == 'pwa-msedge') return 'Microsoft Edge';
  if (browser == 'chrome') return 'Google Chrome';
  return browser;
}

function getDebugBrowserSetting() {
  let browserType: string = getSetting(WorkspaceSetting.debugBrowser);
  if (!browserType) {
    browserType = 'chrome';
  }
  return browserType;
}
export async function debugBrowser(url: string, stopWebServerAfter: boolean) {
  try {
    const launchConfig: DebugConfiguration = {
      type: getDebugBrowserSetting(),
      name: 'Debug Web',
      request: 'launch',
      url: url,
      webRoot: '${workspaceFolder}',
      skipFiles: debugSkipFiles(),
    };

    debug.onDidTerminateDebugSession(async (e) => {
      if (stopWebServerAfter) {
        // This stops the dev server
        await cancelLastOperation();
        // Switch back to Ionic View
        exState.view.reveal(undefined, { focus: true });
      }
    });

    await debug.startDebugging(undefined, launchConfig);
  } catch {
    //
  }
}

async function selectMockDevice(): Promise<device> {
  const selected = await window.showQuickPick(
    devices.map((device) => (device.width == 0 ? device.name : `${device.name} (${device.width} x ${device.height})`)),
    { placeHolder: 'Select Emulated Device' },
  );
  if (!selected) return;
  return devices.find((device) => selected.startsWith(device.name));
}

function getWebviewContent(url: string): string {
  return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Preview App</title>
    <style>
    .body {
       display: flex; 
       align-items: center; justify-content: center;
       margin: 0;
    }
    </style>
	</head>
	<script>
	const vscode = acquireVsCodeApi();
	const baseUrl = '${url}';

	window.addEventListener('message', event => {
		const device = event.data;		
		let newurl = baseUrl;
    let width = device.width + 'px';
    let deviceWidth = (device.height + 50) + 'px';
    let height = device.height + 'px';
		if (device.type == 'ios') { newurl += '?ionic:mode=ios'; }
    if (device.type == 'web') {
       width = '100%'; 
       deviceWidth = '100%';
       height = '100%';
       document.getElementById('body').style.height = '100vh';
       document.getElementById('body').style.margin = '0';
       document.getElementById('body').style.display = 'block';
       document.getElementById('devFrame').style.display = 'none';
       document.getElementById('frame').src ='about:blank';
       document.getElementById('web').width ='100%';
       document.getElementById('web').src =newurl;
    } else {
       document.getElementById('devFrame').style.display = 'block';
       document.getElementById('web').src ='about:blank';
       document.getElementById('web').width ='0';
       document.getElementById('body').style.marginTop = '20px';
       document.getElementById('frame').src = newurl;
    }
		document.getElementById('devFrame').style.width = width;
		document.getElementById('devFrame').style.height = deviceWidth;
		document.getElementById('frameContainer').style.height = height;
		console.log(device);
	});
	
	function change() {
	    vscode.postMessage({url: document.getElementById('frame').src});
	}
	</script>
	<body id="body" class="body">
    <iframe id="web" src="" width="0" height="100%" frameBorder="0"></iframe>
		<div id="devFrame" style="width: 375px; height: 717px; border: 2px solid #333; border-radius:10px; padding:10px; display: flex; align-items: center; flex-direction: column;">		   
		   <div id="frameContainer" style="width: 100%; height: 667px;">
		        <div onclick="change()"  style="border: 2px solid #333; width:5px; height: 70px; cursor: pointer; margin-top:20px; margin-left:-19px; position: absolute"></div>
				<iframe id="frame" src="${url}" width="100%" height="100%" frameBorder="0"></iframe>
		   </div>
		  <div style="width: 100%; height: 50px; display: flex; align-items: center; justify-content: space-between;">
      <div style="cursor: pointer; height: 25px; width:25px; padding:5px" onclick="history.back()"><svg viewBox="0 0 512 512"><path fill="none" stroke="#333" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M244 400L100 256l144-144M120 256h292"/></svg></div>
			<div style="background-color: #333; cursor: pointer; height: 25px; width:25px; border-radius:30px; padding:5px" onclick="document.getElementById('frame').src = '${url}'"></div>
      <div style="cursor: pointer; height: 25px; width:25px; padding:5px" onclick="change()"><svg fill="#333" viewBox="0 0 512 512"><circle cx="256" cy="256" r="48"/><circle cx="416" cy="256" r="48"/><circle cx="96" cy="256" r="48"/></svg></div>
		  </div>  
		 </div>
	</body>
	</html>`;
}
