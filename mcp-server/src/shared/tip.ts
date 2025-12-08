/**
 * Simplified Tip structure for MCP server
 * Adapted from ../../../src/tip.ts
 */

export enum TipType {
  Build,
  Error,
  Edit,
  Warning,
  Idea,
  Capacitor,
  Capacitor2,
  Cordova,
  Check,
  CheckMark,
  Box,
  Experiment,
  Ionic,
  WebNative,
  Run,
  Link,
  Android,
  Vue,
  Angular,
  React,
  Comment,
  Settings,
  Files,
  Builder,
  Sync,
  Add,
  Dependency,
  Media,
  Debug,
  Apple,
  None,
}

export interface TipAction {
  actionFunction?: string; // Name of the action function to call
  args?: unknown[];
  command?: string | string[];
  commandTitle?: string;
}

export class Tip {
  public action?: TipAction;
  public contextValue?: string;
  public data?: unknown;
  public relatedDependency?: string;
  public tooltip?: string;
  public url?: string;

  constructor(
    public title: string,
    public readonly message: string,
    public readonly type?: TipType,
    public readonly description?: string,
    public command?: string | string[],
    public commandTitle?: string,
  ) {
    if (command) {
      this.action = {
        command,
        commandTitle,
      };
    }
  }

  setAction(functionName: string, ...args: unknown[]): Tip {
    this.action = {
      actionFunction: functionName,
      args,
    };
    return this;
  }

  setContextValue(value: string): Tip {
    this.contextValue = value;
    return this;
  }

  setData(data: unknown): Tip {
    this.data = data;
    return this;
  }

  setRelatedDependency(dependency: string): Tip {
    this.relatedDependency = dependency;
    return this;
  }

  setTooltip(tooltip: string): Tip {
    this.tooltip = tooltip;
    return this;
  }

  setUrl(url: string): Tip {
    this.url = url;
    return this;
  }

  toJSON() {
    return {
      actionFunction: this.action?.actionFunction,
      command: this.action?.command,
      commandTitle: this.action?.commandTitle,
      contextValue: this.contextValue,
      description: this.description,
      message: this.message,
      relatedDependency: this.relatedDependency,
      title: this.title,
      tooltip: this.tooltip,
      type: TipType[this.type || TipType.None],
      url: this.url,
    };
  }
}
