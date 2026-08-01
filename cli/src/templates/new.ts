import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { MonoRepoType } from '../project/monorepo';
import { PackageCommandContext, PackageManager, npmInstall } from '../build/node-commands';
import { replaceAll } from '../core/text';
import { frameworks, starterTemplates, targets, Template } from './starter-templates';

export interface NewProjectInput {
  name: string;
  type: string;
  template: string;
  targets: string[];
}

export interface ProjectOptions {
  noGit: boolean;
  folder: string;
  packageId: string;
  name: string;
  noInstall?: boolean;
}

export function getProjectName(name: string): string {
  name = name.toLocaleLowerCase().replace(/ /g, '-');
  return name.replace(/[^a-zA-Z0-9- ]/g, '');
}

export function getPackageId(name: string): string {
  let packageId = name.replace(/ /g, '.').replace(/-/g, '.');
  if (!packageId.includes('.')) {
    packageId = `ionic.${packageId}`;
  }

  const parts = packageId.split('.');
  for (const part of parts) {
    if (!isNaN(part as any)) {
      packageId = packageId.replace(part, `v${part}`);
    }
  }
  return packageId.trim();
}

export function asAppId(name: string): string {
  if (!name) return 'Unknown';
  name = name.split('-').join('.');
  name = name.split(' ').join('.');
  if (!name.includes('.')) {
    name = 'com.' + name;
  }
  return name;
}

function toTitleCase(text: string): string {
  return text.replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()).trim();
}

function defaultPmContext(pm?: string): PackageCommandContext {
  const map: Record<string, PackageManager> = {
    npm: PackageManager.npm,
    pnpm: PackageManager.pnpm,
    yarn: PackageManager.yarn,
    bun: PackageManager.bun,
  };
  return {
    packageManager: map[pm ?? 'npm'] ?? PackageManager.npm,
    repoType: MonoRepoType.none,
  };
}

export function getCommands(project: NewProjectInput, options: ProjectOptions, commands?: string[]): string[] {
  const isIonic = ['angular-standalone', 'angular', 'react', 'vue'].includes(project.type);
  if (isIonic) return getIonicTemplateCommands(project, options);
  if (project.type == 'plugin') {
    return getCapacitorPluginCommands(project, options);
  }
  const cmds = commands ?? [];
  cmds.push('#' + options.folder);
  return cmds.map((c) => {
    let r = replaceAll(c, '$(project-name)', options.name);
    r = replaceAll(r, '$(package-id)', options.packageId);
    return r;
  });
}

function getCapacitorPluginCommands(project: NewProjectInput, options: ProjectOptions): string[] {
  const nmt = replaceAll(toTitleCase(replaceAll(options.name, '-', ' ')), ' ', '');
  const nm = replaceAll(options.name, ' ', '').toLowerCase();
  const nmp = replaceAll(nm, '-', '.');
  return [
    `npx @capacitor/create-plugin "${nm}" --name "${nm}" --package-id "com.mycompany.${nmp}" --class-name "${nmt}" --author "me" --license MIT --repo https://github.com --description "${nmt} Capacitor Plugin"`,
  ];
}

function getIonicTemplateCommands(project: NewProjectInput, options: ProjectOptions): string[] {
  const ctx = defaultPmContext();
  const cmds: string[] = [];
  cmds.push(
    `npm create ionic@beta "${options.name}" -- ${project.template} --type ${project.type} --no-git --capacitor --package-id ${options.packageId}`,
  );
  cmds.push('#' + options.folder);

  if (project.targets.includes(CapacitorPlatform.android) || project.targets.includes(CapacitorPlatform.ios)) {
    cmds.push(npmInstall(`@capacitor/core`, ctx));
    cmds.push(npmInstall(`@capacitor/cli`, ctx));
    cmds.push(npmInstall(`@capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar`, ctx));
  }

  if (project.targets.includes(CapacitorPlatform.android)) {
    cmds.push(npmInstall('@capacitor/android', ctx));
    cmds.push('npx cap add android');
  }
  if (project.targets.includes(CapacitorPlatform.ios)) {
    cmds.push(npmInstall('@capacitor/ios', ctx));
    cmds.push('npx cap add ios');
  }

  if (!options.noGit) {
    cmds.push('git init');
  }
  return cmds;
}

export function templateId(t: Template): string {
  return `${t.type}:${t.name}`;
}

export function findTemplate(template?: string, framework?: string): Template | undefined {
  if (template) {
    const byId = starterTemplates.find((t) => templateId(t) === template || t.name === template);
    if (byId) return byId;
    if (template.includes(':')) {
      const [type, name] = template.split(':');
      return starterTemplates.find((t) => t.type === type && t.name === name);
    }
  }
  if (framework) {
    const fw = frameworks.find((f) => f.type === framework || f.name.toLowerCase().includes(framework.toLowerCase()));
    if (fw) {
      return starterTemplates.find((t) => t.type === fw.type);
    }
  }
  return undefined;
}

export function listTemplateCatalog() {
  return starterTemplates.map((t) => ({
    id: templateId(t),
    type: t.type,
    typeName: t.typeName,
    name: t.name,
    description: t.description,
    url: t.url,
    targets: t.targets,
  }));
}

export function parseTargets(raw?: string): CapacitorPlatform[] {
  if (!raw) return [];
  const result: CapacitorPlatform[] = [];
  for (const part of raw.split(',').map((s) => s.trim().toLowerCase())) {
    if (part === 'ios') result.push(CapacitorPlatform.ios);
    if (part === 'android') result.push(CapacitorPlatform.android);
  }
  return result;
}

export function folderEmpty(folder: string): boolean {
  try {
    const files = readdirSync(folder);
    return !files || files.length === 0;
  } catch {
    return true;
  }
}

export function resolveProjectFolder(dir: string, name: string): string {
  return join(dir, name);
}

export function buildScaffoldCommands(project: NewProjectInput, template: Template, options: ProjectOptions): string[] {
  let cmds = getCommands(project, options, template.commands ? [...template.commands] : undefined);
  if (options.noInstall) {
    cmds = cmds.map((c) =>
      c
        .replace(/\s--no-install\b/g, '')
        .replace(/npm install\b/g, '# skip install')
        .replace(/pnpm install\b/g, '# skip install')
        .replace(/yarn install\b/g, '# skip install')
        .replace(/bun install\b/g, '# skip install'),
    );
  }
  return cmds.filter((c) => !c.startsWith('# skip'));
}

export function folderExists(folder: string): boolean {
  return existsSync(folder) && !folderEmpty(folder);
}

export { frameworks, targets, starterTemplates };
