import { QuickPickItem, QuickPickItemKind, window } from 'vscode';
import { Project } from './project';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { QueueFunction } from './tip';

export async function LoggingSettings(queueFunction: QueueFunction, project: Project) {
  const items: QuickPickItem[] = selectedOptions();
  const result = await window.showQuickPick(items, {
    placeHolder: 'Select log types to report to the output window',
    canPickMany: true,
  });
  if (!result) return;
  queueFunction();
  const list = result.map((item: any) => item.value);
  const selections = [];
  for (const option of getOptions()) {
    if (!list.includes(option.value)) {
      selections.push(option.value);
    }
  }
  setSetting(WorkspaceSetting.logFilter, selections);
}

function selectedOptions(): QuickPickItem[] {
  const result: QuickPickItem[] = [];
  const filter = getSetting(WorkspaceSetting.logFilter);
  for (const option of getOptions()) {
    const choice: QuickPickItem = option as QuickPickItem;
    choice.picked = !filter || !filter.includes(option.value);
    if (option.separator) {
      result.push({ label: option.separator, kind: QuickPickItemKind.Separator });
    }
    result.push(choice);
  }
  return result;
}

function getOptions(): LogOption[] {
  return [
    {
      label: 'Info logging',
      description: 'General info level logging',
      value: '',
      separator: 'Task Logging',
    },
    {
      label: 'Angular',
      description: 'Logging from the Angular CLI [ng]',
      value: '[ng]',
    },
    {
      label: 'Console Logging',
      description: 'Console.log, Console.warn or Console.error',
      value: 'console',
      separator: 'Nexus Browser Logging',
    },
    {
      label: 'Capacitor Calls',
      description: 'Calls to native capacitor plugin methods [capacitor]',
      value: '[capacitor]',
    },
    {
      label: 'Cordova Calls',
      description: 'Calls to native cordova plugin methods [cordova]',
      value: '[cordova]',
    },
    {
      label: 'Webpack Dev Server',
      description: 'Logging from web pack dev server [webpack-dev-server]',
      value: '[webpack-dev-server]',
    },
    {
      label: 'Verbose',
      description: 'Verbose level [verbose]',
      value: '[verbose]',
    },
    {
      label: 'Warning',
      description: 'Warning level [warn]',
      value: '[warn]',
    },
    {
      label: 'Error',
      description: 'Error level [error]',
      value: '[error]',
    },
  ];
}

interface LogOption {
  label: string;
  description: string;
  value: string;
  separator?: string;
}
