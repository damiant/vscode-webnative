import { Project } from './project';
import { ionicState } from './wn-tree-provider';
import { exists } from './analyzer';
import { ExtensionContext, window } from 'vscode';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function getConfigurationName(): string {
  if (!ionicState.configuration || ionicState.configuration == 'default') {
    return '';
  } else {
    return `(${ionicState.configuration})`;
  }
}

export function getConfigurationArgs(isDebugging?: boolean): string {
  let config = ionicState.configuration;
  if (isDebugging) {
    // If we are debugging and its an Angular project without a selected build config
    // then choose "development" so that source maps work
    if (config == 'production') {
      config = 'development'; // Assume we have this configuration
    }
  }
  if (!config || config == 'default') {
    return '';
  } else {
    if (exists('vue') || exists('react')) {
      return ` --mode=${config}`;
    } else {
      return ` --configuration=${config}`;
    }
  }
}

export async function buildConfiguration(folder: string, context: ExtensionContext, project: Project): Promise<string> {
  let configs = [];
  const filename = join(project.projectFolder(), 'angular.json');
  if (existsSync(filename)) {
    configs = getAngularBuildConfigs(filename);
  }
  if (exists('vue') || exists('react')) {
    configs = ['development', 'production'];
  }
  if (configs.length == 0) {
    window.showInformationMessage('No build configurations found in this project');
    return;
  }
  configs.unshift('default');
  const selection = window.showQuickPick(configs, { placeHolder: 'Select a build configuration to use' });
  return selection;
}

function getAngularBuildConfigs(filename: string): Array<string> {
  try {
    const result = [];
    const angular = JSON.parse(readFileSync(filename, 'utf8'));
    for (const config of Object.keys(angular.projects.app.architect.build.configurations)) {
      result.push(config);
    }
    return result;
  } catch {
    return [];
  }
}
