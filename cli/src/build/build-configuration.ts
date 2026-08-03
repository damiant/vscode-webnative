import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Project } from '../project/project';

export function getBuildConfigurationName(configuration?: string): string {
  if (!configuration || configuration === 'default') {
    return '';
  }
  return `(${configuration})`;
}

function getConfigurationArgs(config: string | undefined, isDebugging?: boolean, useMode?: boolean): string {
  let configuration = config;
  if (isDebugging === true) {
    if (configuration === 'production') {
      configuration = 'development';
    }
  }
  if (!configuration || configuration === 'default') {
    return '';
  }
  if (useMode) {
    return ` --mode=${configuration}`;
  }
  return ` --configuration=${configuration}`;
}

export function getBuildConfigurationArgs(configuration?: string, isDebugging?: boolean, useMode?: boolean): string {
  return getConfigurationArgs(configuration, isDebugging, useMode);
}

export function getRunConfigurationArgs(configuration?: string, isDebugging?: boolean, useMode?: boolean): string {
  return getConfigurationArgs(configuration, isDebugging, useMode);
}

/** List available build/run configuration names for a project. */
export function listConfigurations(project: Project, kind: 'build' | 'run' = 'build'): string[] {
  const configs: string[] = [];
  const filename = join(project.projectFolder(), 'angular.json');
  if (existsSync(filename)) {
    configs.push(...getAngularBuildConfigs(filename));
  }
  if (project.analyzer.exists('vue') || project.analyzer.exists('react')) {
    configs.push(...getEnvConfigs(project));
    if (!configs.includes('development')) configs.push('development');
    if (!configs.includes('production')) configs.push('production');
  }
  if (configs.length === 0) {
    return [];
  }
  return ['default', ...configs];
}

function getEnvConfigs(project: Project): string[] {
  const list = readdirSync(project.projectFolder(), 'utf8');
  const envFiles = list.filter((file) => file.startsWith('.env.'));
  return envFiles.map((f) => f.replace('.env.', ''));
}

function getAngularBuildConfigs(filename: string): string[] {
  try {
    const result: string[] = [];
    const angular = JSON.parse(readFileSync(filename, 'utf8'));
    for (const config of Object.keys(angular.projects.app.architect.build.configurations)) {
      result.push(config);
    }
    return result;
  } catch {
    return [];
  }
}
