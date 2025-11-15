import { Project } from './project';
import { exState } from './tree-provider';
import { exists } from './analyzer';
import { ExtensionContext, window } from 'vscode';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export function getBuildConfigurationName(): string {
  if (!exState.buildConfiguration || exState.buildConfiguration == 'default') {
    return '';
  } else {
    return `(${exState.buildConfiguration})`;
  }
}

export function getBuildConfigurationArgs(isDebugging?: boolean): string {
  return getConfigurationArgs(exState.buildConfiguration, isDebugging);
}

export function getRunConfigurationArgs(isDebugging?: boolean): string {
  return getConfigurationArgs(exState.runConfiguration, isDebugging);
}

function getConfigurationArgs(config: string, isDebugging?: boolean): string {
  if (isDebugging == true) {
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

export async function runConfiguration(folder: string, context: ExtensionContext, project: Project): Promise<string> {
  return configuration(folder, context, project, 'run');
}

export async function buildConfiguration(folder: string, context: ExtensionContext, project: Project): Promise<string> {
  return configuration(folder, context, project, 'build');
}

async function configuration(
  folder: string,
  context: ExtensionContext,
  project: Project,
  title: string,
): Promise<string> {
  let configs = [];
  const filename = join(project.projectFolder(), 'angular.json');
  if (existsSync(filename)) {
    configs = getAngularBuildConfigs(filename);
  }
  if (exists('vue') || exists('react')) {
    configs = getConfigs(project);
    if (!configs.includes('development')) {
      configs.push('development');
    }
    if (!configs.includes('production')) {
      configs.push('production');
    }
  }
  if (configs.length == 0) {
    window.showInformationMessage(`No ${title} configurations found in this project`);
    return;
  }
  configs.unshift('default');
  const selection = await window.showQuickPick(configs, { placeHolder: `Select a ${title} configuration to use` });
  return selection;
}

function getConfigs(project: Project): string[] {
  const list = readdirSync(project.projectFolder(), 'utf8');
  const envFiles = list.filter((file) => file.startsWith('.env.'));
  return envFiles.map((f) => f.replace('.env.', ''));
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
