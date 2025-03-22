import { CancellationToken, commands, ExtensionContext, ProgressLocation, window } from 'vscode';
import {
  cancelIfRunning,
  finishCommand,
  isRunning,
  markActionAsCancelled,
  markActionAsRunning,
  markOperationAsRunning,
  startCommand,
  waitForOtherActions,
} from '../tasks';
import { Command, Tip, TipFeature } from '../tip';
import { exState, ExTreeProvider } from '../wn-tree-provider';
import { CancelObject, estimateRunTime, openUri, run } from '../utilities';
import { showOutput, write, writeError, writeWN } from '../logging';
import { ActionResult, CommandName, InternalCommand } from '../command-name';
import { CapacitorPlatform } from '../capacitor-platform';
import { kill } from '../process-list';
import { ignore } from '../ignore';
import { Context } from '../context-variables';
import { selectExternalIPAddress } from '../ionic-serve';
import { selectDevice } from '../capacitor-device';
import { Recommendation } from '../recommendation';
import { CommandTitle } from '../command-title';

/**
 * Runs the command while showing a vscode window that can be cancelled
 * @param  {string|string[]} command Node command
 * @param  {string} rootPath path to run the command
 * @param  {ExTreeProvider} ionicProvider? the provide which will be refreshed on completion
 * @param  {string} successMessage? Message to display if successful
 */
export async function fixIssue(
  command: string | string[],
  rootPath: string,
  ionicProvider?: ExTreeProvider,
  tip?: Tip,
  successMessage?: string,
  title?: string,
) {
  const hasRunPoints = tip && tip.runPoints && tip.runPoints.length > 0;

  if (command == Command.NoOp) {
    await tip.executeAction();
    ionicProvider?.refresh();
    return;
  }

  // If the task is already running then cancel it
  const didCancel = await cancelIfRunning(tip);
  if (didCancel) {
    finishCommand(tip);
    return;
  }

  markOperationAsRunning(tip);

  let msg = tip.commandProgress ? tip.commandProgress : tip.commandTitle ? tip.commandTitle : command;
  if (title) msg = title;
  let failed = false;
  let cancelled = false;
  await window.withProgress(
    {
      location: tip.progressDialog ? ProgressLocation.Notification : ProgressLocation.Window,
      title: `${msg}`,
      cancellable: true,
    },

    async (progress, token: CancellationToken) => {
      const cancelObject: CancelObject = { proc: undefined, cancelled: false };
      let increment = undefined;
      let percentage = undefined;

      const interval = setInterval(async () => {
        // Kill the process if the user cancels
        if (token.isCancellationRequested || tip.cancelRequested) {
          tip.cancelRequested = false;
          writeWN(`Stopped "${tip.title}"`);
          if (tip.features.includes(TipFeature.welcome)) {
            commands.executeCommand(CommandName.HideDevServer);
          }

          if (tip.title.toLowerCase() == CapacitorPlatform.ios) {
            exState.selectedIOSDeviceName = '';
          }
          if (tip.title.toLowerCase() == CapacitorPlatform.android) {
            exState.selectedAndroidDeviceName = '';
          }

          //channelShow();
          clearInterval(interval);
          finishCommand(tip);
          cancelObject.cancelled = true;

          console.log(`Killing process ${cancelObject.proc.pid}`);
          await kill(cancelObject.proc, rootPath);
          if (ionicProvider) {
            ionicProvider.refresh();
          }
        } else {
          if (increment && !hasRunPoints) {
            percentage += increment;
            const msg = percentage > 100 ? ' ' : `${parseInt(percentage)}%`;
            progress.report({ message: msg, increment: increment });
          }
        }
      }, 1000);

      const commandList: string[] | any[] = Array.isArray(command) ? command : [command];

      let clear = true;
      for (const cmd of commandList) {
        if (cmd instanceof Function) {
          await cmd();
        } else {
          startCommand(tip, cmd, clear);
          clear = false;
          const secondsTotal = estimateRunTime(cmd);
          if (secondsTotal) {
            increment = 100.0 / secondsTotal;
            percentage = 0;
          }
          try {
            let retry = true;
            while (retry) {
              try {
                retry = await run(
                  rootPath,
                  cmd,
                  cancelObject,
                  tip.features,
                  tip.runPoints,
                  progress,
                  ionicProvider,
                  undefined,
                  undefined,
                  tip.data,
                );
              } catch (err) {
                retry = false;
                failed = true;
                writeError(err);
              }
            }
          } finally {
            if (cancelObject?.cancelled) {
              cancelled = true;
            }
            finishCommand(tip);
          }
        }
      }
      return true;
    },
  );
  if (ionicProvider) {
    ionicProvider.refresh();
  }
  if (successMessage) {
    write(successMessage);
  }
  if (tip.title) {
    if (failed && !cancelled) {
      writeError(`${tip.title} Failed.`);
      showOutput();
    } else {
      writeWN(`${tip.title} Completed.`);
    }
    write('');
  }

  if (tip.syncOnSuccess) {
    if (!exState.syncDone.includes(tip.syncOnSuccess)) {
      exState.syncDone.push(tip.syncOnSuccess);
    }
  }
}

export async function fix(
  tip: Tip,
  rootPath: string,
  ionicProvider: ExTreeProvider,
  context: ExtensionContext,
): Promise<void> {
  if (await waitForOtherActions(tip)) {
    return; // Canceled
  }
  await tip.generateCommand();
  tip.generateTitle();
  if (tip.command) {
    const urlBtn = tip.url ? 'Info' : undefined;
    const msg = tip.message ? `: ${tip.message}` : '';
    const info = tip.description ? tip.description : `${tip.title}${msg}`;
    const ignoreTitle = tip.ignorable ? 'Ignore' : undefined;
    const selection = await window.showInformationMessage(info, urlBtn, tip.secondTitle, tip.commandTitle, ignoreTitle);
    if (selection && selection == tip.commandTitle) {
      fixIssue(tip.command, rootPath, ionicProvider, tip, tip.commandSuccess);
    }
    if (selection && selection == tip.secondTitle) {
      fixIssue(tip.secondCommand, rootPath, ionicProvider, tip, undefined, tip.secondTitle);
    }
    if (selection && selection == urlBtn) {
      openUri(tip.url);
    }
    if (selection && selection == ignoreTitle) {
      ignore(tip, context);
      if (ionicProvider) {
        ionicProvider.refresh();
      }
    }
  } else {
    await execute(tip, context);

    if (ionicProvider) {
      ionicProvider.refresh();
    }
  }
}

export async function execute(tip: Tip, context: ExtensionContext): Promise<void> {
  const result: ActionResult = (await tip.executeAction()) as ActionResult;
  if (result == ActionResult.Ignore) {
    ignore(tip, context);
  }
  if (tip.url) {
    await openUri(tip.url);
  }
}

export async function runAction(tip: Tip, ionicProvider: ExTreeProvider, rootPath: string, srcCommand?: CommandName) {
  if (await waitForOtherActions(tip)) {
    return; // Canceled
  }
  if (tip.stoppable || tip.contextValue == Context.stop) {
    if (isRunning(tip)) {
      cancelIfRunning(tip);
      markActionAsCancelled(tip);
      ionicProvider.refresh();
      return;
    }
    markActionAsRunning(tip);
    ionicProvider.refresh();
  }

  await tip.generateCommand();
  tip.generateTitle();
  if (tip.command) {
    let command = tip.command;
    let host = '';
    if (tip.doIpSelection) {
      host = await selectExternalIPAddress();
      if (host) {
        // Ionic cli uses --public-host but capacitor cli uses --host
        host = ` --host=${host}`;
      } else {
        host = '';
      }
    }
    command = (tip.command as string).replace(InternalCommand.publicHost, host);

    if (tip.doDeviceSelection) {
      const target = await selectDevice(tip.secondCommand as string, tip.data, tip, srcCommand);
      if (!target) {
        markActionAsCancelled(tip);
        ionicProvider.refresh();
        return;
      }
      command = (command as string).replace(InternalCommand.target, target);
    }
    if (command) {
      execute(tip, exState.context);
      fixIssue(command, rootPath, ionicProvider, tip);

      return;
    }
  } else {
    await execute(tip, exState.context);
    if (tip.refresh) {
      ionicProvider.refresh();
    }
  }
}

export async function runAgain(ionicProvider: ExTreeProvider, rootPath: string) {
  let runInfo = exState.runWeb;
  switch (exState.lastRun) {
    case CapacitorPlatform.android:
      runInfo = exState.runAndroid;
      break;
    case CapacitorPlatform.ios:
      runInfo = exState.runIOS;
      break;
  }
  if (runInfo) {
    runAction(runInfo, ionicProvider, rootPath);
  }
}

export async function findAndRun(ionicProvider: ExTreeProvider, rootPath: string, commandTitle: CommandTitle) {
  const list = await ionicProvider.getChildren();
  const r = findRecursive(commandTitle, list);
  if (r) {
    runAction(r.tip, ionicProvider, rootPath);
  } else {
    window.showInformationMessage(`The action "${commandTitle}" is not available.`);
  }
}

function findRecursive(label: string, items: Recommendation[]): Recommendation | undefined {
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      const found = findRecursive(label, item.children);
      if (found) {
        return found;
      }
    }
    if (item.label == label || item.id == label) {
      return item;
    }
  }
  return undefined;
}
