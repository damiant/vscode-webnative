import { writeError, writeIonic } from './logging';
import { Project } from './project';
import { isWindows, openUri, run, RunResults, showProgress, stripJSON } from './utilities';

import { basename, extname, join } from 'path';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { ionicBuild } from './ionic-build';
import { MonoRepoType } from './monorepo';
import { ViewColumn, window } from 'vscode';
import { QueueFunction } from './tip';

/**
 * Generates a readable analysis of Javascript bundle sizes
 * Uses source-map-explorer on a production build of the app with source maps turned on
 * @param  {Project} project
 */
export async function analyzeSize(queueFunction: QueueFunction, project: Project) {
  const dist = project.getDistFolder();
  queueFunction();
  await showProgress('Generating Project Statistics', async () => {
    let previousValue;
    try {
      previousValue = enableSourceMaps(project);
      writeIonic('Building for production with Sourcemaps...');
      let args = '';
      if (project.repoType == MonoRepoType.nx || project.frameworkType.startsWith('angular')) {
        args = '--configuration=production';
      }

      const cmd = await ionicBuild(project, { arguments: args, sourceMaps: true });
      const bumpSize = !isWindows() ? 'export NODE_OPTIONS="--max-old-space-size=8192" && ' : '';
      try {
        await run2(project, `${bumpSize}${cmd}`, undefined);
      } catch (err) {
        writeError(err);
      }

      writeIonic('Analyzing Sourcemaps...');
      const result: RunResults = { output: '', success: undefined };
      try {
        await run2(project, `npx source-map-explorer "${dist}/**/*.js" --json --exclude-source-map`, result);
      } catch (err) {
        window.showErrorMessage('Unable to analyze source maps: ' + err, 'OK');
      }

      const html =
        analyzeResults(
          analyzeBundles(stripJSON(result.output, '{')),
          'Bundle Analysis',
          'Size of Javascript bundles for your code and 3rd party packages.',
        ) +
        analyzeResults(
          analyzeAssets(dist, project.projectFolder()),
          'Asset Analysis',
          'Size of assets in your distribution folder.',
        );
      showWindow(project.projectFolder(), html);
      writeIonic('Launched project statistics window.');
    } finally {
      revertSourceMaps(project, previousValue);
    }
  });
}

/**
 * Enables the configuration for source maps in the projects configuration
 * @param  {Project} project
 * @returns string
 */
function enableSourceMaps(project: Project): string {
  try {
    let filename = join(project.folder, 'angular.json');
    if (!existsSync(filename)) {
      filename = join(project.projectFolder(), 'project.json'); // NX Style
    }
    let changeMade = false;
    if (existsSync(filename)) {
      const json = readFileSync(filename, 'utf-8');
      const config = JSON.parse(json);
      const projects = config.projects ? config.projects : { app: config };
      for (const prj of Object.keys(projects)) {
        const cfg = projects[prj].architect ? projects[prj].architect : projects[prj].targets;
        if (cfg.build?.configurations?.production) {
          const previousValue = cfg.build.configurations.production.sourceMap;
          if (previousValue == true) {
            // Great nothing to do, already enabled
            return previousValue;
          } else {
            cfg.build.configurations.production.sourceMap = true;
            writeIonic(`Temporarily modified production sourceMap of ${prj} to true in angular.json`);
            changeMade = true;
          }
        }
      }
      if (changeMade) {
        writeFileSync(filename, JSON.stringify(config, null, 2));
        return json;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Reverts the projects configuration back to its previous settings before source maps were turned on
 * @param  {Project} project
 * @param  {string} previousValue
 */
function revertSourceMaps(project: Project, previousValue: string) {
  if (previousValue == undefined) {
    return;
  }
  let filename = join(project.folder, 'angular.json');
  if (!existsSync(filename)) {
    filename = join(project.projectFolder(), 'project.json'); // NX Style
  }
  if (existsSync(filename)) {
    writeFileSync(filename, previousValue, { encoding: 'utf-8' });
  }
}

function htmlHead() {
  return `<!DOCTYPE html><html lang="en">
	<style>
	.bar-container {
		border: 2px solid var(--vscode-list-hoverBackground);
		width: 200px;
		height: 16px;
	}
	.bar-indent {
		border: 2px solid var(--vscode-list-hoverBackground);
		width: 180px;
		margin-left: 20px;
		height: 16px;
	}
	.bar { 
		height: 100%; 		
		background-color: var(--vscode-button-background);
	}
	.shade {
		color: var(--vscode-list-deemphasizedForeground);
	} 
	.row { display: flex } 
	.col { margin: 5px }
	.float {
		position: absolute;
		margin: 0;		
		padding: 0;
		padding-left: 10px;
	}
	.tooltip {
		position: relative;
		display: inline-block;
	  }
	.tooltip .tooltiptext {
		visibility: hidden;
		width: 200px;
		background-color: var(--vscode-editor-background);
		color: var(--vscode-editor-foreground);
		border: 1px solid var(--vscode-editor-foreground);
		text-align: center;
		padding: 5px 0;	   
		position: absolute;
		z-index: 1;
	  }
	.tooltip:hover .tooltiptext {
		visibility: visible;
	  }	  
	details { user-select: none; }
	details[open] summary span.icon {
		transform: rotate(180deg);
	  }
	summary {
		display: flex;
		cursor: pointer;
	  }
	.hover {
		cursor: pointer;
	}
	</style>
	<script>
	   const vscode = acquireVsCodeApi();
	   function send(message) {
		   console.log(message);
	       vscode.postMessage(message);
	   }	   
	</script>
	<body>`;
}

function analyzeBundles(json: string): Array<FileInfo> {
  const data: SizeResults = JSON.parse(json);
  const ignoreList = ['[EOLs]'];
  const files: Array<FileInfo> = [];
  for (const result of data.results) {
    for (const key of Object.keys(result.files)) {
      if (!ignoreList.includes(key)) {
        const info = getInfo(key, result.files[key].size, result.bundleName);
        files.push(info);
      }
    }
  }
  return files;
}

function analyzeResults(files: Array<FileInfo>, title: string, blurb: string): string {
  let html = '';
  let largestGroup = 0;
  const groups = {};
  const groupLargest = {};
  const groupCount = {};
  const groupFiles = {};

  // Calculate totals
  for (const file of files) {
    if (!groups[file.type]) {
      groups[file.type] = 0;
      groupLargest[file.type] = 0;
      groupCount[file.type] = 0;
      groupFiles[file.type] = [];
    }
    if (!groupFiles[file.type].includes(file.bundlename)) {
      groupFiles[file.type].push(file.bundlename);
    }
    groupCount[file.type] += 1;
    if (file.size > groupLargest[file.type]) {
      groupLargest[file.type] = file.size;
    }
    groups[file.type] = groups[file.type] + file.size;
  }

  for (const group of Object.keys(groups)) {
    if (groups[group] > largestGroup) {
      largestGroup = groups[group];
    }
  }
  files = files.sort((a, b) => {
    return cmp(groups[b.type], groups[a.type]) || cmp(b.size, a.size);
  });
  let lastType: string;
  html += `<h1>${title}</h1>
	<p class="shade">${blurb}</p>`;
  for (const file of files) {
    if (file.type != lastType) {
      if (lastType) {
        html += '</details>';
      }
      lastType = file.type;
      const onclick = groupCount[lastType] == 1 ? `onclick="send('${file.filename}')"` : '';
      html += `<details><summary>
			<div class="row">
			   <div class="col">${graph(groups[lastType], largestGroup)}</div>
			   <p ${onclick} class="col tooltip">${lastType}
			      <span class="tooltiptext">${friendlySize(groups[lastType])} (${groupFiles[lastType].length} Files)</span>
			   </p>			
			</div>
			</summary>`;
    }
    if (groupCount[lastType] != 1) {
      html += `
		    <div class="row">
		       <div class="col">${graph(file.size, groupLargest[file.type], true)}</div>
		       <p onclick="send('${file.filename}')" class="col tooltip shade hover">&nbsp;&nbsp;&nbsp;${file.name}
		          <span class="tooltiptext">${file.path}<br/>${file.size} bytes<br/>${file.bundlename}</span>
		       </p>		   
		    </div>`;
    }
  }
  html += '</details>';

  return html;
}

function showWindow(folder: string, html: string) {
  const panel = window.createWebviewPanel('viewApp', 'Project Statistics', ViewColumn.Active, {
    enableScripts: true,
  });
  panel.webview.onDidReceiveMessage(async (filename) => {
    if (!filename.startsWith(folder)) {
      openUri(join(folder, filename));
    } else {
      openUri(filename);
    }
  });
  panel.webview.html = htmlHead() + html + '</body></html>';
}

function graph(size: number, largest: number, indent = false) {
  return `
	<div class="${indent ? 'bar-indent' : 'bar-container'}">
	<div class="bar" style="width:${(size * 100) / largest}%">
	<p class="float">${friendlySize(size)}</p>
	</div>
	</div>`;
}

function cmp(a, b) {
  if (a > b) return +1;
  if (a < b) return -1;
  return 0;
}

function getInfo(fullname: string, size: number, bundlename: string): FileInfo {
  let url: URL;
  let name: string;
  let pathname: string;
  try {
    url = new URL(fullname);
    name = url.pathname;
    pathname = url.pathname;
  } catch {
    if (fullname.startsWith('../node_modules')) {
      name = fullname.replace('../node_modules', '/node_modules');
      pathname = name;
    } else {
      name = fullname;
      let filename = bundlename;
      if (name == '[unmapped]' || name == '[no source]') {
        name = bundlename;
      } else {
        if (bundlename.endsWith('chunk.js')) {
          filename = fullname; // TODO: React projects dont seem to set the path well
        }
      }

      return { name: friendlyName(name), type: friendlyType(fullname), path: fullname, size, bundlename, filename };
    }
  }

  const filename = name.replace('webpack://', '.');

  if (name.startsWith('/node_modules/')) {
    name = name.replace('/node_modules/', '');
  }
  const names = name.split('/');
  const path = friendlyPath(names.join(' '));
  const type = friendlyType(pathname);
  name = friendlyName(names.pop(), path);
  return { name, path, type, size, bundlename, filename };
}

function friendlySize(size: number): string {
  if (size > 1000) {
    return Math.round(size / 1000.0).toString() + 'kb';
  } else {
    return '1kb';
  }
}

function friendlyType(name: string): string {
  let type = 'Your Code';
  if (name.startsWith('/node_modules/')) {
    type = '3rd Party';
  }
  if (name.includes('polyfills')) {
    type = 'Polyfills';
  }
  if (name.startsWith('/node_modules/core-js')) {
    type = 'Core JS';
  }
  if (name == '[unmapped]' || name == '[no source]') {
    return 'Without Source Code';
  }
  if (name.startsWith('/javascript/esm|')) {
    type = '3rd Party';
  }
  if (name.startsWith('/webpack/')) {
    return 'Webpack';
  }
  if (name.startsWith('/node_modules/react')) {
    return 'React';
  }
  if (name.startsWith('/node_modules/@')) {
    const names = name.replace('/node_modules/@', '').split('/');
    type = names[0];
    if (names.length > 1) {
      type = names[0] + ' ' + names[1];
    }
  } else if (name.startsWith('/node_modules/rxjs')) {
    type = 'RxJS';
  }
  type = type.split('-').join(' ');
  return toTitleCase(type);
}

function friendlyName(name: string, path?: string): string {
  let result = name?.replace('.entry.js', '');
  result = result.split('-').join(' ');
  result = result.split('_').join(' ');
  result = result.split('.').join(' ');
  result = result.split('/').join(' ');
  result = result.split('%20').join(' ');
  for (let i = 1; i < 9; i++) {
    if (result.endsWith(` ${i}`)) {
      result = result.replace(` ${i}`, '');
    }
  }
  // Ionic component
  if (result.startsWith('ion ')) {
    result = result.replace('ion ', '');
    if (result && result[result.length - 2] == '_') {
      result = result.substring(0, result.length - 2); // gets rid of _2, _3 etc
    }
    result += ' Component';
  }
  result = result.replace(' dist', '');
  result = result.replace(' tsx', '');

  if (result.endsWith(' js')) {
    result = result.replace(' js', '');
  } else if (result.endsWith(' ts')) {
    result = result.replace(' ts', '');
  } else if (result.endsWith(' mjs')) {
    result = result.replace(' mjs', '');
  } else if (result.endsWith(' vue')) {
    result = result.replace(' vue', '');
  } else if (result.endsWith(' index')) {
    result = result.replace(' index', '');
  }

  if (result == 'index' || result == 'runtime') {
    result = path;
  } else {
    if (path?.startsWith('Moment Locale')) {
      result = path;
    }
  }

  if (!result) {
    return name;
  }

  if (result.toLowerCase() != result) {
    // Given OneAndTwoAndThree => One And Two And Three
    result = result.replace(/([A-Z])/g, ' $1').trim();
  }

  return toTitleCase(result);
}

function toTitleCase(text: string) {
  return text
    .replace(/\w\S*/g, (txt: string) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    })
    .trim();
}

function friendlyPath(path: string): string {
  path = path.replace('fesm2020', '');
  path = path.replace('fesm2015', '');
  path = path.replace('dist ngx', '');
  path = path.replace('dist esm', '');
  path = path.replace('index.js', '');
  path = path.replace('_lib', '');
  path = path.replace(' esm', '');
  path = path.replace(' dist', '');
  path = path.replace('.js', '');
  path = path.replace('@capacitor', 'Capacitor');
  path = path.split('-').join(' ');

  if (path == '@ionic core dist esm') {
    return 'Ionic Framework';
  } else if (path == '@ionic core dist esm polyfills') {
    return 'Ionic Framework Polyfills';
  } else if (path.startsWith('@ionic-enterprise')) {
    path = path.replace('@ionic-enterprise', 'Ionic Enterprise');
  } else if (path.startsWith('@angular')) {
    path = path.replace('@angular', 'Angular');
  }
  if (path.startsWith('rxjs')) {
    return 'RxJS';
  }
  if (path == 'webpack runtime') {
    return 'Webpack';
  }
  path = path.replace('__ivy_ngcc__', '');
  return toTitleCase(path).trim();
}

async function run2(project: Project, command: string, output: RunResults): Promise<boolean> {
  return await run(project.projectFolder(), command, undefined, [], [], undefined, undefined, output, true);
}

function analyzeAssets(distFolder: string, prjFolder: string): Array<FileInfo> {
  // Summarize files other than js
  const files = getAllFiles(distFolder);
  const excludedFileTypes = ['.js', '.map'];
  const result: Array<FileInfo> = [];
  for (const file of files) {
    const ext = extname(file);
    if (!excludedFileTypes.includes(ext)) {
      const size = statSync(file).size;
      result.push({
        name: basename(file),
        path: file,
        bundlename: file,
        type: assetType(ext),
        size,
        filename: file.replace(prjFolder, ''),
      });
    }
  }
  return result;
}

function assetType(ext: string): string {
  switch (ext) {
    case '.png':
    case '.jpg':
    case '.gif':
    case '.jpeg':
      return 'Images';
    case '.svg':
      return 'Vector Images';
    case '.woff':
    case '.woff2':
    case '.eot':
    case '.ttf':
      return 'Fonts';
    case '.css':
      return 'Style Sheets';
    default:
      return 'Other';
  }
}

function getAllFiles(dirPath: string, arrayOfFiles?: Array<string>): Array<string> {
  const files = readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach((file) => {
    if (statSync(join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(join(dirPath, file));
    }
  });

  return arrayOfFiles;
}

interface FileInfo {
  name: string;
  path: string;
  type: string;
  size: number;
  bundlename: string;
  filename: string;
}

export interface SizeResults {
  results: SizeResult[];
}

export interface SizeResult {
  bundleName: string;
  totalBytes: number;
  mappedBytes: number;
  eolBytes: number;
  sourceMapCommentBytes: number;
  files: any;
}
