import { RunPoint, TipFeature } from './tip';
import { debugBrowser, viewInEditor } from './preview';
import { handleError } from './error-handler';
import { exState, ExTreeProvider } from './wn-tree-provider';
import { getMonoRepoFolder, getPackageJSONFilename } from './monorepo';
import { InternalCommand } from './command-name';
import { exists } from './analyzer';
import { ionicInit } from './ionic-init';
import { request } from 'https';
import { ExtensionSetting, getExtSetting, getSetting, WorkspaceSection, WorkspaceSetting } from './workspace-state';
import { showOutput, write, writeAppend, writeError, writeWN } from './logging';
import { getWebConfiguration, WebConfigSetting } from './web-configuration';
import { Publisher } from './discovery';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ChildProcess, exec, ExecException, ExecOptionsWithStringEncoding, spawn } from 'child_process';
import { startStopLogServer } from './log-server';
import { qrView } from './webview-debug';
import { CancellationToken, Progress, ProgressLocation, Uri, commands, window, workspace } from 'vscode';
import { uncolor } from './uncolor';
import { kill } from 'process';
import { getStringFrom, replaceAllStringIn } from './utils-strings';

export interface CancelObject {
  proc: ChildProcess;
  cancelled: boolean;
}

const opTiming = {};
let pub: Publisher;

// Any logged lines that start with these are filtered out
const filteredLines = [
  '▲ [WARNING] The glob pattern import("./**/*.entry.js*") ',
  '  :host-context([dir=rtl])',
  '  .ion-float-start:dir(rtl)',
  '▲ [WARNING] 20 rules skipped',
  '◑',
  '◒',
  '◐',
  '◓',
  '│',
  '◇  💡',
  '[info][capacitorcookies] Getting cookies at:',
  '[INFO] Waiting for connectivity with npm...', // Occurs during debugging
];

export function estimateRunTime(command: string) {
  const idx = command.replace(InternalCommand.cwd, '');
  if (opTiming[idx]) {
    return opTiming[idx];
  } else {
    return undefined;
  }
}

export async function confirm(message: string, confirmButton: string): Promise<boolean> {
  const selection = await window.showInformationMessage(message, confirmButton, 'Cancel');
  return selection == confirmButton;
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isMac(): boolean {
  return process.platform === 'darwin';
}

function runOptions(command: string, folder: string, shell?: string): ExecOptionsWithStringEncoding {
  const env = { ...process.env };
  const javaHome: string = getExtSetting(ExtensionSetting.javaHome);

  // Cocoapods required lang set to en_US.UTF-8 (when capacitor sync or run ios is done)
  if (!env.LANG) {
    env.LANG = 'en_US.UTF-8';
  }

  if (javaHome) {
    env.JAVA_HOME = javaHome;
  } else if (!env.JAVA_HOME && !isWindows()) {
    const jHome = '/Applications/Android Studio.app/Contents/jre/Contents/Home';
    if (existsSync(jHome)) {
      env.JAVA_HOME = jHome;
    }
  }

  return { cwd: folder, shell: shell ? shell : exState.shell, encoding: 'utf8', env: env, maxBuffer: 10485760 };
}

export interface RunResults {
  output: string;
  success: boolean;
}

export function stopPublishing() {
  if (pub) {
    pub.stop();
  }
}

export function passesRemoteFilter(msg: string, logFilters: string[]): boolean {
  return passesFilter(msg, logFilters, true);
}

export function passesFilter(msg: string, logFilters: string[], isRemote: boolean): boolean {
  for (const filteredLine of filteredLines) {
    if (msg.startsWith(filteredLine)) {
      return false;
    }
  }
  if (msg == '') return false;
  if (!logFilters) return true;

  for (const logFilter of logFilters) {
    if (logFilter == '' && !isRemote) {
      // If we're filtering out most logs then provide exception
      if (!msg.startsWith('[') || msg.startsWith('[info]') || msg.startsWith('[INFO]')) {
        if (new RegExp('Warn|warn|Error|error').test(msg)) {
          // Its not info so allow
        } else {
          return false;
        }
      }
    } else if (logFilter == 'console' && isRemote) {
      // Remote logging sends console statements as [info|warn|error]
      if (msg.startsWith('[info]') || msg.startsWith('[warn]') || msg.startsWith('[error]')) {
        return false;
      }
    } else {
      if (msg?.includes(logFilter)) {
        return false;
      }
    }
  }
  return true;
}

export async function run(
  folder: string,
  command: string,
  cancelObject: CancelObject,
  features: Array<TipFeature>,
  runPoints: Array<RunPoint>,
  progress: any,
  ionicProvider?: ExTreeProvider,
  output?: RunResults,
  suppressInfo?: boolean,
  auxData?: string,
  continousProgress?: boolean,
  preventErrorFocus?: boolean,
): Promise<boolean> {
  if (command == InternalCommand.removeCordova) {
    return await removeCordovaFromPackageJSON(folder);
  }
  if (command == InternalCommand.ionicInit) {
    await ionicInit(folder);
    return false;
  }

  if (command.includes(InternalCommand.cwd)) {
    command = replaceAll(command, InternalCommand.cwd, '');
    // Change the work directory for monorepos as folder is the root folder
    folder = getMonoRepoFolder(exState.workspace, folder);
  }
  command = qualifyCommand(command, folder);

  let findLocalUrl = features.includes(TipFeature.debugOnWeb) || features.includes(TipFeature.welcome);
  let findExternalUrl = features.includes(TipFeature.welcome);
  let localUrl: string;
  let externalUrl: string;
  let launched = false;

  async function launchUrl(): Promise<void> {
    if (localUrl && externalUrl) {
      launched = true;
      launch(localUrl, externalUrl);
    } else if (!externalUrl) {
      await delay(500);
      if (!launched) {
        launched = true;
        launch(localUrl, externalUrl);
      }
    }
  }

  function launch(localUrl: string, externalUrl: string) {
    const config: WebConfigSetting = getWebConfiguration();
    const url = externalUrl ?? localUrl;
    if (url) {
      if (pub) {
        pub.stop();
      } else {
        if (!auxData) {
          console.error(`auxData not set for launch of ${localUrl} ${externalUrl}`);
        }
        pub = new Publisher('devapp', auxData ?? '', portFrom(url), url.startsWith('https'));
      }
      pub.start().then(() => {
        if (config == WebConfigSetting.nexus) {
          qrView(externalUrl, localUrl);
        }
      });
    }

    // Make sure remote logger service is running
    startStopLogServer(undefined);

    if (features.includes(TipFeature.debugOnWeb)) {
      debugBrowser(localUrl, true);
      return;
    }
    switch (config) {
      case WebConfigSetting.editor:
        viewInEditor(localUrl, true, !!exState.webView);
        break;
      case WebConfigSetting.browser:
        //if (!externalUrl) {
        openUri(localUrl);
        //}
        break;
      case WebConfigSetting.nexus:
        break;
      default: {
        openUri(localUrl);
        break;
      }
    }
  }

  function portFrom(externalUrl: string): number {
    const tmp = externalUrl.split(':');
    if (tmp.length < 3) return 8100;
    return parseInt(tmp[2]);
  }
  let answered = '';
  const logFilters: string[] = getSetting(WorkspaceSetting.logFilter);
  let logs: Array<string> = [];
  return new Promise((resolve, reject) => {
    const start_time = process.hrtime();
    const interval = setInterval(() => {
      if (cancelObject?.cancelled) {
        clearInterval(interval);
        reject(`${command} Cancelled`);
      }
    }, 500);

    const proc = exec(
      command,
      runOptions(command, folder),
      async (error: ExecException, stdout: string, stdError: string) => {
        let retry = false;
        if (error) {
          console.error(error);
        }

        // Quirk of windows robocopy is that it logs errors/exit code on success
        if (!error || command.includes('robocopy')) {
          const end_time = process.hrtime(start_time);
          if (!cancelObject?.cancelled) {
            opTiming[command] = end_time[0]; // Number of seconds
          }

          // Allows handling of linting and tests
          retry = await handleError(undefined, logs, folder);
          clearInterval(interval);
          if (output) {
            output.success = true;
          }
          resolve(retry);
        } else {
          if (!cancelObject?.cancelled) {
            retry = await handleError(stdError, logs, folder);
          }
          clearInterval(interval);
          if (retry) {
            if (output) {
              output.success = true;
            }
            resolve(retry);
          } else {
            if (output) {
              output.success = false;
            }
            reject(`${command} Failed`);
          }
        }
      },
    );

    proc.stdout.on('data', (data) => {
      if (data) {
        if (output) {
          output.output += data;
        }
        const logLines = data.split('\r\n');
        logs = logs.concat(logLines);
        if (findLocalUrl) {
          if (data.includes('http')) {
            const url = checkForUrls(data, [
              'Local:',
              'On Your Network:',
              'open your browser on ',
              '> Local:', // Nuxt
              '➜  Local:', // AnalogJs
              '➜ Local:', // Nuxt with Vite
              '- Local:', // Vue
              'Listening on ', // Tanstack start
              '┃ Local', // Astro
            ]);
            if (url) {
              findLocalUrl = false;
              localUrl = url;
              exState.localUrl = localUrl;
              exState.openWebStatusBar.show();
              exState.openEditorStatusBar.show();
              launchUrl();
            }
          }
        }
        if (continousProgress) {
          progress.report({ message: uncolor(data.toString()) });
        }
        if (findExternalUrl) {
          if (data.includes('http')) {
            const url = checkForUrls(data, [
              'External:',
              'On Your Network:',
              '> Network:', // Nuxt
              '➜  Network:', // AnalogJs
              '- Network:', // Vue
              'open your browser on ', // NX
            ]);
            if (url) {
              findExternalUrl = false;
              externalUrl = url;
              exState.externalUrl = externalUrl;
              launchUrl();
            }
          }
        }

        // Based on found text logged change the progress message in the status bar
        if (runPoints) {
          for (const runPoint of runPoints) {
            if (data.includes(runPoint.text)) {
              progress.report({ message: runPoint.title });

              if (runPoint.action) {
                if (answered !== '') {
                  data = data.replace(answered, '');
                }
                if (data.includes(runPoint.text)) {
                  runPoint.action(runPoint.text).then((keystrokes) => {
                    proc.stdin.write(keystrokes);
                    writeWN(`Answered.`);
                    answered = runPoint.text;
                  });
                }
              }
              if (runPoint.refresh && ionicProvider) {
                ionicProvider.refresh();
              }
            }
          }
        }

        for (const logLine of logLines) {
          if (logLine.startsWith('[capacitor]')) {
            if (!suppressInfo && passesFilter(logLine, logFilters, false)) {
              write(logLine.replace('[capacitor]', ''));
            }
          } else if (logLine && !suppressInfo) {
            const uncolored = uncolor(logLine);
            if (passesFilter(uncolored, logFilters, false)) {
              if (uncolored.includes('\r')) {
                write(uncolored);
              } else {
                writeAppend(uncolored);
              }
            }
          }
        }
        focusOutput();
      }
    });

    proc.stderr.on('data', (data) => {
      if (!suppressInfo) {
        const uncolored = uncolor(data);
        if (passesFilter(uncolored, logFilters, false)) {
          write(uncolored);
        }
      }

      if (!preventErrorFocus) {
        exState.channelFocus = true; // Allows the errors to show
        focusOutput();
        exState.channelFocus = false; // Reset so that if user fixes the error they dont see the logs again
      }
    });

    if (cancelObject) {
      cancelObject.proc = proc;
    }
  });
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkForUrls(data: string, list: Array<string>): string {
  const colorLess = stripColors(data);
  const lines = colorLess.split('\n');
  for (const line of lines) {
    for (const text of list) {
      const url = checkForUrl(line, text);
      if (url) {
        return url;
      }
    }
  }
}

function checkForUrl(data: string, text: string): string {
  if (data.includes(text) && data.includes('http')) {
    let url = getStringFrom(data, text, '\n').trim();
    if (url && url.endsWith(' **')) {
      // This is for NX which logs urls like http://192.168.0.1:4200/ **
      url = url.substring(0, url.length - 3);
    }
    if (url && url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    if (url && url.startsWith('http://[')) {
      return undefined; // IPV6 is not supported (nuxt/vite projects emit this)
    }
    return url;
  }
}

function stripColors(s: string): string {
  // [36mhttp://localhost:[1m3002[22m/[39m
  return replaceAllStringIn(s, '[', 'm', '');
}

/**
 * This ensures that the focus is not pushed to the output window while you are editing a document
 */
function focusOutput() {
  if (exState.outputIsFocused) return;
  channelShow();
}

export function replaceAll(str: string, find: string, replace: string): string {
  return str.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
}

// This will use the local @ionic/cli from the extension if one is not installed locally
function qualifyCommand(command: string, folder: string): string {
  if (command.startsWith('npx ionic')) {
    if (!exists('@ionic/cli')) {
      const cli = join(exState.context.extensionPath, 'node_modules/@ionic/cli/bin');
      if (existsSync(cli)) {
        command = command.replace('npx ionic', 'node "' + join(cli, 'ionic') + '"');
      }
    }
  }
  if (process.env.NVM_DIR) {
    if (!exState.nvm) {
      const nvmrc = join(folder, '.nvmrc');
      if (existsSync(nvmrc)) {
        const txt = readFileSync(nvmrc, 'utf-8').replace('\n', '');
        exState.nvm = `source ${process.env.NVM_DIR}/nvm.sh && nvm use > /dev/null`;
        writeWN(`Detected nvm (${txt}) for this project.`);
      }
    }
    if (exState.nvm) {
      return `${exState.nvm} && ${command}`;
    }
  }
  return command;
}

export async function openUri(uri: string): Promise<void> {
  const ob = uri?.includes('//') ? Uri.parse(uri) : Uri.file(uri);
  await commands.executeCommand('vscode.open', ob);
}

export function debugSkipFiles(): string {
  try {
    let debugSkipFiles: string = workspace.getConfiguration(WorkspaceSection).get('debugSkipFiles');
    if (!debugSkipFiles) {
      return undefined;
    }
    if (debugSkipFiles.includes("'")) {
      debugSkipFiles = debugSkipFiles.replace(/'/g, '"');
    }
    const list = JSON.parse(debugSkipFiles);
    if (!Array.isArray(list)) {
      throw new Error('debugSkipFiles not a valid array');
    }
  } catch (error) {
    window.showErrorMessage(`Unable to parse debugSkipFiles variable. Ensure it is a valid JSON array. ${error}`);
    return undefined;
  }
}

export function stripJSON(txt: string, startText: string): string {
  // This removed output from nvm from json
  const idx = txt.indexOf(startText);
  if (idx != -1) {
    return txt.substring(idx);
  }
  return txt;
}

export function getSpawnOutput(
  command: string,
  folder: string,
  shell?: string,
  hideErrors?: boolean,
  ignoreErrors?: boolean,
): Promise<string> {
  const a = command.split(' ');
  const args = a.slice(1);
  return new Promise((resolve, reject) => {
    const childProcess = spawn(a[0], args, { cwd: folder });

    let output = '';
    let error = '';
    tStart(command);
    childProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    childProcess.on('close', (code) => {
      tEnd(command);
      if (code !== 0) {
        if (!hideErrors) {
          writeError(error);
        }
        if (ignoreErrors) {
          resolve(output);
        } else {
          reject(`${error}`);
        }
      } else {
        resolve(output);
      }
    });
  });
}

export async function getRunOutput(
  command: string,
  folder: string,
  shell?: string,
  hideErrors?: boolean,
  ignoreErrors?: boolean,
  detectExitCode?: boolean,
): Promise<string> {
  return getExecOutput(command, folder, shell, hideErrors, ignoreErrors, detectExitCode);

  // Problems with spawn with some commands (eg windows, npx ng generate)
  //return getSpawnOutput(command, folder, shell, hideErrors, ignoreErrors);
}

export async function getExecOutput(
  command: string,
  folder: string,
  shell?: string,
  hideErrors?: boolean,
  ignoreErrors?: boolean,
  detectExitCode?: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = '';
    if (command.includes(InternalCommand.cwd)) {
      command = replaceAll(command, InternalCommand.cwd, '');
      // Change the work directory for monorepos as folder is the root folder
      folder = getMonoRepoFolder(exState.workspace, folder);
    }
    command = qualifyCommand(command, folder);
    tStart(command);
    exec(command, runOptions(command, folder, shell), (error: ExecException, stdout: string, stdError: string) => {
      if (stdout) {
        out += stdout;
      }
      if (!error) {
        if (out == '' && stdError) {
          out += stdError;
        }
        tEnd(command);
        resolve(out);
      } else {
        if (stdError) {
          if (!hideErrors) {
            writeError(stdError);
          } else {
            console.error(stdError);
          }
          if (ignoreErrors) {
            tEnd(command);
            resolve(out);
          } else {
            tEnd(command);
            reject(stdError);
          }
        } else {
          tEnd(command);
          if (detectExitCode) {
            reject(out);
          } else {
            // This is to fix a bug in npm outdated where it returns an exit code when it succeeds
            resolve(out);
          }
        }
      }
    });
  });
}

export function channelShow() {
  if (exState.channelFocus) {
    showOutput();
    exState.channelFocus = false;
  }
}

export async function runWithProgress(
  command: string,
  title: string,
  folder: string,
  output?: RunResults,
): Promise<boolean> {
  let result = false;
  let done = false;
  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title,
      cancellable: true,
    },
    async (progress, token: CancellationToken) => {
      const cancelObject: CancelObject = { proc: undefined, cancelled: false };
      run(folder, command, cancelObject, [], [], progress, undefined, output, false).then((success) => {
        writeWN(`Command ${command} completed.`);
        done = true;
        result = success;
      });
      while (!cancelObject.cancelled && !done) {
        await delay(500);

        if (token.isCancellationRequested) {
          cancelObject.cancelled = true;
          kill(cancelObject.proc.pid);
        }
      }
    },
  );
  return result;
}

export function getPackageJSON(folder: string): PackageFile {
  const filename = getPackageJSONFilename(folder);
  if (!existsSync(filename)) {
    return { name: undefined, displayName: undefined, description: undefined, version: undefined, scripts: {} };
  }
  return JSON.parse(readFileSync(filename, 'utf8'));
}

export function alt(key: string): string {
  return isWindows() ? `Alt+${key}` : `⌥+${key}`;
}

export function generateUUID(): string {
  return new Date().getTime().toString(36) + Math.random().toString(36).slice(2);
}
/**
 * Given user input convert to a usable app identifier
 * @param  {string} name
 * @returns string
 */
export function asAppId(name: string): string {
  if (!name) return 'Unknown';
  name = name.split('-').join('.');
  name = name.split(' ').join('.');
  if (!name.includes('.')) {
    name = 'com.' + name; // Must have at least a . in the name
  }
  return name;
}

export function extractBetween(A: string, B: string, C: string): string | null {
  const indexB = A.indexOf(B);
  if (indexB === -1) return null; // B not found

  const indexC = A.indexOf(C, indexB + B.length);
  if (indexC === -1) return null; // C not found after B

  return A.substring(indexB + B.length, indexC);
}

export interface PackageFile {
  name: string;
  displayName: string;
  description: string;
  version: string;
  scripts: Record<string, unknown>;
  devDependencies?: Record<string, string>;

  // This is used for plugins
  capacitor?: CapacitorPackageInfo;
}

export interface CapacitorPackageInfo {
  ios?: CapacitorPackagePlatform;
  android?: CapacitorPackagePlatform;
}

export interface CapacitorPackagePlatform {
  src: string;
}

export function plural(name: string, count?: number): string {
  if (count <= 1) {
    if (name == 'are') return 'is';
  }
  if (name == 'Dependency') {
    return 'Dependencies';
  } else if (name == 'Plugin') {
    return 'Cordova Plugins';
  }
  return name + 's';
}

export function doDoes(count: number): string {
  return count > 1 ? 'does' : 'do';
}

export function pluralize(name: string, count: number): string {
  if (count) {
    return count <= 1 ? `${count} ${name}` : `${count} ${name}s`;
  }
}

export async function showMessage(message: string, ms: number) {
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: message,
      cancellable: false,
    },
    async () => {
      await timeout(ms); // Show the message for 3 seconds
    },
  );
}

export function toTitleCase(text: string) {
  return text
    .replace(/\w\S*/g, (txt: string) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    })
    .trim();
}

export async function showProgress(
  message: string,
  func: (p?: Progress<{ message?: string; increment?: number }>) => Promise<any>,
) {
  return await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `${message}`,
      cancellable: false,
    },
    async (progress, token) => {
      return await func(progress);
    },
  );
}

export function httpRequest(method: string, host: string, path: string, postData?: string) {
  const params = {
    host,
    port: 443,
    method,
    path,
  };
  return new Promise(function (resolve, reject) {
    const req = request(params, function (res) {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error('statusCode=' + res.statusCode));
      }
      let body = [];
      res.on('data', function (chunk) {
        body.push(chunk);
      });
      res.on('close', function () {
        try {
          body = JSON.parse(Buffer.concat(body).toString());
        } catch (e) {
          reject(e);
        }
        resolve(body);
      });
      res.on('end', function () {
        try {
          body = JSON.parse(Buffer.concat(body).toString());
        } catch (e) {
          reject(e);
        }
        resolve(body);
      });
    });
    req.setHeader('User-Agent', 'WebNative VS Code Extension (https://webnative.dev)');
    req.setHeader('Accept', '*/*');
    req.on('error', function (err) {
      reject(err);
    });
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeCordovaFromPackageJSON(folder: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const filename = join(folder, 'package.json');
      const packageFile = JSON.parse(readFileSync(filename, 'utf8'));
      packageFile.cordova = undefined;
      writeFileSync(filename, JSON.stringify(packageFile, undefined, 2));

      // Also replace cordova in ionic.config.json
      const iFilename = join(folder, 'ionic.config.json');
      if (existsSync(iFilename)) {
        const ionicConfig = JSON.parse(readFileSync(iFilename, 'utf8'));
        if (ionicConfig.integrations.cordova) {
          delete ionicConfig.integrations.cordova;
          ionicConfig.integrations.capacitor = new Object();
        }
        writeFileSync(iFilename, JSON.stringify(ionicConfig, undefined, 2));
      }
      resolve(false);
    } catch (err) {
      reject(err);
    }
  });
}

export function toPascalCase(text: string) {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

function clearAndUpper(text: string) {
  return text.replace(/-/, '').toUpperCase();
}

const times = {};

export function tStart(name: string) {
  times[name] = process.hrtime();
}

export function tEnd(name: string) {
  const endTime = process.hrtime(times[name]);
  const executionTime = (endTime[0] * 1e9 + endTime[1]) / 1e6; // Convert to milliseconds
  if (executionTime > 100) {
    console.log(`${name} took ${Math.trunc(executionTime)} milliseconds to run.`);
  }
}
