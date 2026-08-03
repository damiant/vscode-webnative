import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { setAllStringIn } from '../project/utilities-strings';
import { Project } from '../project/project';

export interface PluginPermissionInfo {
  name: string;
  androidPermissions: string[];
  androidFeatures: string[];
  dependentPlugins: string[];
  hasHooks: boolean;
}

export function parsePluginXml(content: string): Omit<PluginPermissionInfo, 'name'> {
  const result = {
    androidPermissions: [] as string[],
    androidFeatures: [] as string[],
    dependentPlugins: [] as string[],
    hasHooks: false,
  };
  if (!content) return result;
  content = setAllStringIn(content, '<platform name="wp8">', '</platform>', '');
  content = setAllStringIn(content, '<platform name="blackberry10">', '</platform>', '');
  for (const permission of findAll(content, '<uses-permission android:name="', '"')) {
    result.androidPermissions.push(permission);
  }
  for (const feature of findAll(content, '<uses-feature android:name="', '"')) {
    result.androidFeatures.push(feature);
  }
  for (const dependency of findAll(content, '<dependency id="', '"')) {
    result.dependentPlugins.push(dependency);
  }
  if (content.includes('<hook')) result.hasHooks = true;
  return result;
}

export function getPluginPermissions(project: Project): PluginPermissionInfo[] {
  const folder = project.projectFolder();
  const nodeModules = project.getNodeModulesFolder();
  const deps = project.analyzer.getAllDependencies();
  const results: PluginPermissionInfo[] = [];

  for (const name of Object.keys(deps).sort()) {
    const pluginXml = join(nodeModules, name, 'plugin.xml');
    if (!existsSync(pluginXml)) continue;
    const content = readFileSync(pluginXml, 'utf-8');
    results.push({ name, ...parsePluginXml(content) });
  }
  return results;
}

function findAll(content: string, search: string, endsearch: string): string[] {
  const list = Array.from(content.matchAll(new RegExp(search + '(.*?)' + endsearch, 'g')));
  return list.map((item) => item[1]);
}
