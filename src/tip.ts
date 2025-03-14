import { CapacitorPlatform } from './capacitor-platform';
import { ActionResult, CommandName } from './command-name';
import { Context } from './context-variables';
import { finishCommand, isRunning, markActionAsRunning, waitForOtherActions } from './tasks';

export enum TipFeature {
  debugOnWeb,
  welcome,
}

export type QueueFunction = () => void;

export class Tip {
  public progressDialog: boolean;
  public doRun: boolean;
  public doDeviceSelection: boolean;
  public doIpSelection: boolean;
  public cancelRequested: boolean;
  public animates: boolean;
  public stoppable: boolean;
  public nonBlocking: boolean;
  public secondCommand: string;
  public secondTitle: string;
  public tooltip: string;
  public runPoints: Array<RunPoint>;
  public contextValue?: string;
  public vsCommand?: CommandName;
  public ignorable: boolean;
  public refresh: boolean; // Whether the tree provider is refresh after action is run
  public syncOnSuccess: CapacitorPlatform; // Which platform was synced
  public dontWait: boolean; // Whether the task should wait if there are other tasks running
  public data?: any;
  public features: Array<TipFeature> = [];
  public relatedDependency: string;

  private onAction: (...args) => Promise<ActionResult> | Promise<void>;
  private onQueuedAction: (...args) => Promise<ActionResult> | Promise<void>;
  private onCommand: (...args) => Promise<string>;
  private onTitle: (...args) => string;
  private actionArgs: any[];
  private titleArgs: any[];

  constructor(
    public title: string,
    public readonly message: string,
    public readonly type?: TipType,
    public readonly description?: string,
    public command?: string | string[],
    public commandTitle?: string,
    public readonly commandSuccess?: string,
    public url?: string,
    public commandProgress?: string,
  ) {}

  showProgressDialog() {
    this.progressDialog = true;
    return this;
  }

  performRun() {
    this.doRun = true;
    return this;
  }

  requestDeviceSelection() {
    this.doDeviceSelection = true;
    return this;
  }

  requestIPSelection() {
    this.doIpSelection = true;
    return this;
  }

  setFeatures(features: Array<TipFeature>): Tip {
    for (const feature of features) {
      this.features.push(feature);
    }
    return this;
  }

  hasFeature(feature: TipFeature): boolean {
    return this.features.includes(feature);
  }

  canAnimate() {
    this.animates = true;
    return this;
  }

  setTooltip(tooltip: string) {
    this.tooltip = tooltip;
    return this;
  }

  canStop() {
    if (isRunning(this)) {
      this.setContextValue(Context.stop);
    } else {
      this.stoppable = true;
    }
    return this;
  }

  // Tasks that do not block will allow other tasks to run immediately instead of being queued.
  willNotBlock() {
    this.nonBlocking = true;
    return this;
  }

  isNonBlocking() {
    return this.nonBlocking;
  }

  contextIf(value: Context, running: boolean) {
    if (running && isRunning(this)) {
      this.setContextValue(value);
    } else if (!running && !isRunning(this)) {
      this.setContextValue(value);
    }
    return this;
  }

  canIgnore() {
    this.ignorable = true;
    return this;
  }

  canRefreshAfter() {
    this.refresh = true;
    return this;
  }

  // This task will not wait for other tasks to complete
  doNotWait() {
    this.dontWait = true;
    return this;
  }

  // Return whether this task will not wait for other tasks to complete
  willNotWait(): boolean {
    return this.dontWait;
  }

  setSyncOnSuccess(platform: CapacitorPlatform) {
    this.syncOnSuccess = platform;
    return this;
  }

  // The action is executed when the user clicks the item in the treeview
  setAction(func: (...argsIn) => Promise<ActionResult> | Promise<void>, ...args) {
    this.onAction = func;
    this.actionArgs = args;
    return this;
  }

  // The action is executed when the user clicks the item in the treeview
  setQueuedAction(func: (queueFunction: () => void, ...argsIn) => Promise<ActionResult> | Promise<void>, ...args) {
    this.onQueuedAction = func;
    this.actionArgs = args;
    return this;
  }

  // The action is executed when the user clicks the button called title
  setAfterClickAction(title: string, func: (...argsIn) => Promise<ActionResult> | Promise<void>, ...args) {
    this.commandTitle = title;
    this.command = Command.NoOp;
    this.onAction = func;
    this.actionArgs = args;
    return this;
  }

  setContextValue(contextValue: string) {
    if (this.contextValue == Context.stop) {
      return this;
    }
    this.contextValue = contextValue;
    return this;
  }

  setVSCommand(commandName: CommandName) {
    this.vsCommand = commandName;
    return this;
  }

  public addActionArg(arg: string) {
    this.actionArgs.push(arg);
  }

  public actionArg(index: number) {
    return this.actionArgs[index];
  }

  setData(data: any) {
    this.data = data;
    return this;
  }

  setRelatedDependency(name: string) {
    this.relatedDependency = name;
    return this;
  }

  setDynamicCommand(func: (...argsIn) => Promise<string>, ...args) {
    this.onCommand = func;
    this.actionArgs = args;
    return this;
  }

  setDynamicTitle(func: (...argsIn) => string, ...args) {
    this.onTitle = func;
    this.titleArgs = args;
    return this;
  }

  setSecondCommand(title: string, command: string): Tip {
    this.secondCommand = command;
    this.secondTitle = title;
    return this;
  }

  setRunPoints(runPoints: Array<RunPoint>): Tip {
    this.runPoints = runPoints;
    return this;
  }

  async executeAction(): Promise<ActionResult | void> {
    if (this.onAction) {
      if (await waitForOtherActions(this)) {
        return;
      }
      try {
        markActionAsRunning(this);
        return await this.onAction(...this.actionArgs);
      } finally {
        finishCommand(this);
      }
      return;
    }

    // This only marks an action as queued when it starts
    if (this.onQueuedAction) {
      if (await waitForOtherActions(this)) {
        return;
      }
      try {
        return await this.onQueuedAction(
          () => {
            markActionAsRunning(this);
          },
          ...this.actionArgs,
        );
      } finally {
        finishCommand(this);
      }
    }
  }

  async generateCommand() {
    if (this.onCommand) {
      this.command = await this.onCommand(...this.actionArgs);
    }
  }

  async generateTitle() {
    if (this.onTitle) {
      this.title = this.onTitle(...this.titleArgs);
    }
  }
}

export enum Command {
  NoOp = ' ',
}

export enum TipType {
  Build,
  Error,
  Edit,
  Warning,
  Idea,
  Capacitor,
  Cordova,
  Check,
  CheckMark,
  Box,
  Experiment,
  Ionic,
  Run,
  Link,
  Android,
  Vue,
  Angular,
  React,
  Comment,
  Settings,
  Files,
  Sync,
  Add,
  Dependency,
  Media,
  Debug,
  Apple,
  None,
}

export interface RunPoint {
  text: string; // Search text in the log entry
  title: string; // Title used for progress
  refresh?: boolean; // Refresh the tree view
}
