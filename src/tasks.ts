import { ProgressLocation, window, CancellationToken } from 'vscode';
import { InternalCommand } from './command-name';
import { Context } from './context-variables';
import { ionicState } from './wn-tree-provider';
import { clearOutput, write, writeWN } from './logging';
import { Tip } from './tip';
import { channelShow, replaceAll, stopPublishing } from './utilities';

interface RunningAction {
  tip: Tip;
  workspace: string;
}

let runningOperations: Array<RunningAction> = [];
let runningActions: Array<RunningAction> = [];
let lastOperation: Tip;

export function getLastOperation(): Tip {
  return lastOperation;
}

export function isRunning(tip: Tip) {
  const found: RunningAction = runningOperations.find((found: RunningAction) => {
    return same(found, { tip, workspace: ionicState.workspace });
  });
  if (found == undefined) {
    const foundAction: RunningAction = runningActions.find((found) => {
      return same(found, { tip, workspace: ionicState.workspace });
    });
    return foundAction != undefined;
  }
  return found != undefined;
}

function same(a: RunningAction, b: RunningAction): boolean {
  return a.tip.title == b.tip.title && a.workspace == b.workspace;
}

export async function cancelLastOperation(): Promise<void> {
  if (!lastOperation) return;
  if (!isRunning(lastOperation)) return;
  await cancelRunning(lastOperation);
}

function cancelRunning(tip: Tip): Promise<void> {
  const found: RunningAction = runningOperations.find((found) => {
    return same(found, { tip, workspace: ionicState.workspace });
  });
  if (found) {
    found.tip.cancelRequested = true;
    console.log('Found task to cancel...');
    if (tip.description == 'Serve') {
      stopPublishing();
    }
  }
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

// If the task is already running then cancel it
export async function cancelIfRunning(tip: Tip): Promise<boolean> {
  if (isRunning(tip)) {
    await cancelRunning(tip);
    if (tip.data == Context.stop) {
      channelShow();
      return true; // User clicked stop
    }
  }
  return false;
}

export function finishCommand(tip: Tip) {
  runningOperations = runningOperations.filter((op: RunningAction) => {
    return !same(op, { tip, workspace: ionicState.workspace });
  });
  runningActions = runningActions.filter((op: RunningAction) => {
    return !same(op, { tip, workspace: ionicState.workspace });
  });
}

export function startCommand(tip: Tip, cmd: string, clear?: boolean) {
  if (tip.title) {
    const message = tip.commandTitle ? tip.commandTitle : tip.title;
    if (clear !== false) {
      clearOutput();
    }
    writeWN(`${message}...`);
    let command = cmd;
    if (command?.includes(InternalCommand.cwd)) {
      command = command.replace(InternalCommand.cwd, '');
      if (ionicState.workspace) {
        write(`> Workspace: ${ionicState.workspace}`);
      }
    }
    write(`> ${replaceAll(command, InternalCommand.cwd, '')}`);
    channelShow();
  }
}

export function markActionAsRunning(tip: Tip) {
  runningActions.push({ tip, workspace: ionicState.workspace });
}

export function markOperationAsRunning(tip: Tip) {
  runningOperations.push({ tip, workspace: ionicState.workspace });
  lastOperation = tip;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function runningInThisWorkSpace(): number {
  let count = 0;
  for (const action of runningActions) {
    if (action.workspace == ionicState.workspace) {
      count++;
    }
  }
  return count;
}
function queueEmpty(): boolean {
  if (runningInThisWorkSpace() == 0) return true;
  if (runningInThisWorkSpace() == 1 && runningActions[0].tip.isNonBlocking()) return true;
  return false;
}

export async function waitForOtherActions(tip: Tip): Promise<boolean> {
  let cancelled = false;
  if (queueEmpty()) return false;
  if (tip.willNotWait()) return false;
  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Task Queued: ${tip.title}`,
      cancellable: true,
    },
    async (progress, token: CancellationToken) => {
      while (!queueEmpty() && !cancelled) {
        await delay(500);

        if (token.isCancellationRequested) {
          cancelled = true;
        }
      }
    },
  );
  return cancelled;
}

export function markActionAsCancelled(tip: Tip) {
  runningActions = runningActions.filter((op: RunningAction) => {
    return !same(op, { tip, workspace: ionicState.workspace });
  });
}
