import { Context, VSCommand } from './context-variables';
import { ionicState } from './wn-tree-provider';
import { sendTelemetryEvent, TelemetryEventType } from './telemetry';
import { writeAppend } from './logging';
import { ExtensionContext, ExtensionKind, UIKind, commands, env, window } from 'vscode';
import { join } from 'path';
import { ExecException, exec } from 'child_process';

/**
 * ionic login and signup commands
 * @param  {string} folder
 * @param  {vscode.ExtensionContext} context
 */
export async function ionicLogin(folder: string, context: ExtensionContext) {
  const ifolder = join(folder, 'node_modules', '@ionic', 'cli', 'bin');
  try {
    if (env.uiKind == UIKind.Web) {
      window.showErrorMessage(
        'The Codespaces browser editor has limited functionality. Click "Next" to continue.',
        'Next',
      );
      ionicState.skipAuth = true;
      await commands.executeCommand(VSCommand.setContext, Context.isAnonymous, false);
      return;
    }
    await run(`npx ionic login --confirm`, ifolder);
    sendTelemetryEvent(folder, TelemetryEventType.Login, context);
  } catch (err) {
    window.showErrorMessage(err);
    ionicState.skipAuth = true;
    await commands.executeCommand(VSCommand.setContext, Context.isAnonymous, false);
  }
}

export async function ionicSignup(folder: string, context: ExtensionContext) {
  const ifolder = join(folder, 'node_modules', '@ionic', 'cli', 'bin');
  await run('npx ionic signup', ifolder);
  sendTelemetryEvent(folder, TelemetryEventType.SignUp, context);
}

async function run(command: string, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = '';
    const cmd = exec(command, { cwd: folder }, (error: ExecException, stdout: string, stderror: string) => {
      if (stdout) {
        out += stdout;
        writeAppend(out);
      }
      if (!error) {
        writeAppend(out);
        resolve(out);
      } else {
        if (stderror) {
          reject(stderror);
        } else {
          resolve(out);
        }
      }
    });
    cmd.stdin.pipe(process.stdin);
  });
}
