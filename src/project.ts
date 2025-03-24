import { Recommendation } from './recommendation';
import { Tip, TipType } from './tip';
import { load, exists } from './analyzer';
import { isRunning } from './tasks';
import { getGlobalIonicConfig, getIonicConfig, sendTelemetryEvents } from './telemetry';
import { exState } from './wn-tree-provider';
import { Context, VSCommand } from './context-variables';
import { getRecommendations } from './recommend';
import { getIgnored } from './ignore';
import { CommandName, InternalCommand } from './command-name';
import { angularMigrate } from './rules-angular-migrate';
import { checkForMonoRepo, FrameworkType, MonoRepoProject, MonoRepoType } from './monorepo';
import { CapacitorPlatform } from './capacitor-platform';
import { addCommand, npmInstall, npmUninstall, PackageManager, saveDevArgument } from './node-commands';
import { run } from './utilities';
import { getCapacitorConfigDistFolder } from './capacitor-config-file';
import { Command, ExtensionContext, TreeItemCollapsibleState, commands, window } from 'vscode';
import { join } from 'path';
import { existsSync } from 'fs';
import { write } from './logging';
import { Features } from './features';
import { fixIssue } from './features/fix-issue';

export class Project {
  name: string;
  type: string = undefined;
  isCapacitor: boolean;
  isCordova: boolean;
  workspaces: Array<string>;
  folder: string;
  modified: Date; // Last modified date of package.json
  group: Recommendation;
  subgroup: Recommendation;
  groups: Recommendation[] = [];
  ignored: Array<string>;

  // Mono repo Type (eg NX)
  public repoType: MonoRepoType;

  // Package Manager Type (eg npm, pnpm)
  public packageManager: PackageManager;

  // Ionic Config Json Type
  public frameworkType: FrameworkType;

  // Mono Repo Project selected
  public monoRepo: MonoRepoProject;

  public isCapacitorPlugin: boolean;

  // Yarn version from package.json packageManager property
  public yarnVersion: string;

  constructor(_name: string) {
    this.name = _name;
    this.isCapacitorPlugin = false;
  }

  public getIgnored(context: ExtensionContext) {
    this.ignored = getIgnored(context);
  }

  public getNodeModulesFolder(): string {
    let nmf = join(this.folder, 'node_modules');
    if (this.monoRepo && !this.monoRepo?.nodeModulesAtRoot) {
      nmf = join(this.monoRepo.folder, 'node_modules');
    }
    return nmf;
  }

  // Is the capacitor platform installed and does the project folder exists
  public hasCapacitorProject(platform: CapacitorPlatform) {
    return exists(`@capacitor/${platform}`) && existsSync(join(this.projectFolder(), platform));
  }

  public hasACapacitorProject(): boolean {
    return this.hasCapacitorProject(CapacitorPlatform.ios) || this.hasCapacitorProject(CapacitorPlatform.android);
  }

  public isYarnV1(): boolean {
    return this.yarnVersion?.startsWith('1.');
  }

  /**
   * This is the path the selected project (for monorepos) or the root folder
   */
  public projectFolder() {
    if (this.repoType == undefined) {
      return this.folder;
    }
    switch (this.repoType) {
      case MonoRepoType.none:
        return this.folder;
      case MonoRepoType.npm:
      case MonoRepoType.yarn:
      case MonoRepoType.lerna:
      case MonoRepoType.pnpm:
      case MonoRepoType.folder:
        return this.monoRepo ? this.monoRepo.folder : this.folder;
      case MonoRepoType.nx:
        return this.monoRepo ? this.monoRepo.folder : this.folder;
      default:
        return join(this.folder, this.monoRepo.folder);
    }
  }

  public setSubGroup(
    title: string,
    type: TipType,
    message?: string,
    contextValue?: string,
    expanded?: boolean,
  ): Recommendation {
    const tip = new Tip(title, undefined, undefined, undefined, undefined, 'Upgrade');
    const r = new Recommendation(
      message,
      undefined,
      title,
      expanded ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed,
      undefined,
      tip,
    );
    r.children = [];
    this.group.children.push(r);
    this.subgroup = r;
    if (contextValue) {
      r.setContext(contextValue);
    }
    this.setIcon(type, r);
    return r;
  }

  public setGroup(
    title: string,
    message: string,
    type?: TipType,
    expanded?: boolean,
    contextValue?: string,
    overrideIcon?: boolean,
  ): Recommendation {
    // If the last group has no items in it then remove it (eg if there are no recommendations for a project)
    if (this.groups.length > 1 && this.groups[this.groups.length - 1].children.length == 0) {
      if (!this.groups[this.groups.length - 1].whenExpanded) {
        this.groups.pop();
      }
    }
    const r = new Recommendation(
      message,
      '',
      title,
      expanded ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed,
    );
    if (contextValue) {
      r.setContext(contextValue);
    }
    r.children = [];
    r.setIcon('none');
    this.setIcon(TipType.None, r);
    if (overrideIcon) {
      this.setIcon(type, r);
    }
    this.group = r;
    this.groups.push(this.group);
    return r;
  }

  public note(title: string, message: string, url?: string, tipType?: TipType, description?: string) {
    const tip = new Tip(title, message, tipType, description, undefined, undefined, undefined, url);
    const r = new Recommendation(
      description ? description : message,
      message,
      title,
      TreeItemCollapsibleState.None,
      {
        command: CommandName.Fix,
        title: 'Information',
        arguments: [tip],
      },
      undefined,
    );

    this.setIcon(tipType, r);

    this.group.children.push(r);
  }

  setIcon(tipType: TipType, r: Recommendation) {
    switch (tipType) {
      case TipType.Error:
        r.setIcon('error');
        break;
      case TipType.Warning:
        r.setIcon('warning');
        break;
      case TipType.Idea:
        r.setIcon('lightbulb');
        break;
      case TipType.Files:
        r.setIcon('files');
        break;
      case TipType.Builder:
        r.setSingleIcon('logo-builder');
        break;
      case TipType.Apple:
        r.setIcon('apple');
        break;
      case TipType.Dependency:
        r.setIcon('dependency');
        break;
      case TipType.Box:
        r.setIcon('box');
        break;
      case TipType.Check:
        r.setIcon('checkbox');
        break;
      case TipType.CheckMark:
        r.setIcon('checkmark');
        break;
      case TipType.Media:
        r.setIcon('file-media');
        break;
      case TipType.Cordova:
        r.setIcon('cordova');
        break;
      case TipType.Experiment:
        r.setIcon('beaker');
        break;
      case TipType.Capacitor:
        r.setIcon('capacitor');
        break;
      case TipType.Capacitor2:
        r.setSingleIcon('logo-capacitor');
        break;
      case TipType.React:
        r.setIcon('react');
        break;
      case TipType.Vue:
        r.setIcon('vue');
        break;
      case TipType.Angular:
        r.setIcon('angular');
        break;
      case TipType.Ionic:
        r.setIcon('ionic');
        break;
      case TipType.WebNative:
        r.setIcon('webnative');
        break;
      case TipType.Android:
        r.setIcon('android');
        break;
      case TipType.Comment:
        r.setIcon('comment');
        break;
      case TipType.Settings:
        r.setIcon('settings-gear');
        break;
      case TipType.Run:
        r.setIcon('run');
        break;
      case TipType.Debug:
        r.setIcon('debug-alt-small');
        break;
      case TipType.Link:
        r.setIcon('files');
        break;
      case TipType.None:
        r.setIcon('none');
        break;
      case TipType.Add:
        r.setIcon('add');
        break;
      case TipType.Sync:
        r.setIcon('sync');
        break;
      case TipType.Build:
        r.setIcon('build');
        break;
      case TipType.Edit:
        r.setIcon('edit');
        break;
    }
  }

  private isIgnored(tip: Tip) {
    if (!tip) return true;
    const txt = `${tip.message}+${tip.title}`;
    if (!this.ignored) return false;
    return this.ignored.includes(txt);
  }

  public add(tip: Tip, id?: string) {
    const r = this.asRecommendation(tip);
    if (!r) return;
    if (id) {
      r.id = id;
    }

    if (this.subgroup) {
      this.subgroup.children.push(r);
    } else {
      this.group.children.push(r);
    }
  }

  public async run2(command: string, suppressOutput?: boolean): Promise<boolean> {
    return await run(this.projectFolder(), command, undefined, [], [], undefined, undefined, undefined, suppressOutput);
  }

  public async runAtRoot(command: string, suppressOutput?: boolean): Promise<boolean> {
    write(`> ${command}`);
    return await run(this.folder, command, undefined, [], [], undefined, undefined, undefined, suppressOutput);
  }

  public asRecommendation(tip: Tip): Recommendation {
    if (this.isIgnored(tip)) return;

    let argsIsRecommendation = false;
    let cmd: Command = {
      command: CommandName.Fix,
      title: 'Fix',
      arguments: [tip],
    };

    if ([TipType.Run, TipType.Sync, TipType.Debug, TipType.Build, TipType.Edit].includes(tip.type) || tip.doRun) {
      cmd = {
        command: CommandName.Run,
        title: 'Run',
      };
      argsIsRecommendation = true;
    }

    if (tip.vsCommand) {
      cmd = {
        command: tip.vsCommand,
        title: tip.title,
        arguments: [tip],
      };
    }

    if (tip.type == TipType.Link) {
      cmd = {
        command: CommandName.Link,
        title: 'Open',
        arguments: [tip],
      };
      tip.url = tip.description as string;
    }

    const tooltip = tip.tooltip ? tip.tooltip : tip.message;
    const r = new Recommendation(tooltip, tip.message, tip.title, TreeItemCollapsibleState.None, cmd, tip, tip.url);
    this.setIcon(tip.type, r);

    if (argsIsRecommendation) {
      r.command.arguments = [r];
    }

    if (tip.animates) {
      if (isRunning(tip)) {
        r.animate();
      }
    }

    // Context values are used for the when condition for vscode commands (see ionic.open in package.json)
    if (tip.contextValue) {
      r.setContext(tip.contextValue);
    }

    return r;
  }

  public addSubGroup(title: string, latestVersion: string) {
    let tip: Tip = undefined;
    if (title == 'angular') {
      // Option to upgrade with:
      // ng update @angular/cli@13 @angular/core@13 --allow-dirty
      if (!latestVersion) {
        return;
      }
      tip = angularMigrate(this, latestVersion);
    } else {
      tip = new Tip('Upgrade All Packages', undefined, TipType.Run, undefined, undefined, 'Upgrade');
    }

    const command: Command = {
      command: CommandName.Idea,
      title: tip.title,
      arguments: [tip],
    };

    const r = new Recommendation(tip.title, undefined, '@' + title, TreeItemCollapsibleState.Expanded, command, tip);
    r.children = [];
    if (title == 'angular') {
      r.setContext(Context.lightbulb);
    } else {
      r.setContext(Context.lightbulb);
      r.tip.setDynamicCommand(this.updatePackages, r).setDynamicTitle(this.updatePackagesTitle, r);
    }

    this.group.children.push(r);
    this.subgroup = r;
  }

  public isModernYarn() {
    const result = !!this.yarnVersion;
    if (result && this.yarnVersion.startsWith('pnpm@')) {
      return false;
    }
    if (this.isYarnV1()) {
      return false;
    }
    if (!result && this.packageManager == PackageManager.yarn) {
      return true;
    }
    return result;
  }

  private async updatePackages(r: Recommendation): Promise<string> {
    let command = '';
    const addCmd = addCommand();
    for (const child of r.children) {
      // Command will be npm install @capacitor/android@3.4.3 --save-exact
      if ((child.tip.command as string).includes(addCmd)) {
        const npackage = (child.tip.command as string)
          .replace(addCmd + ' ', '')
          .replace(' --save-exact', '')
          .replace(InternalCommand.cwd, '');

        if (command != '') {
          command += ' ';
        }
        command += npackage.trim();
      }
    }
    return npmInstall(command);
  }

  private updatePackagesTitle(r: Recommendation): string {
    let title = '';
    const addCmd = addCommand();
    for (const child of r.children) {
      if (child.tip && (child.tip.command as string).includes(addCmd)) {
        if (title != '') {
          title += ', ';
        }
        title += child.tip.description;
      }
    }
    return `${r.children.length} Packages: ${title}`;
  }

  public clearSubgroup() {
    this.subgroup = undefined;
  }

  public recommendReplace(name: string, title: string, message: string, description: string, replacement: string) {
    if (exists(name)) {
      this.add(
        new Tip(
          title,
          message,
          TipType.Warning,
          description,
          `${npmInstall(replacement)} && ${npmUninstall(name)}`,
          'Replace',
          `Replaced ${name} with ${replacement}`,
        )
          .setRelatedDependency(name)
          .canIgnore(),
      );
    }
  }

  public recommendRemove(name: string, title: string, message: string, description?: string, url?: string) {
    if (exists(name)) {
      this.add(
        new Tip(
          title,
          message,
          TipType.Warning,
          description,
          npmUninstall(name),
          'Uninstall',
          `Uninstalled ${name}`,
          url,
        )
          .canIgnore()
          .setRelatedDependency(name),
      );
    }
  }

  public recommendAdd(name: string, title: string, message: string, description: string, devDependency: boolean) {
    const flags = devDependency ? saveDevArgument(this) : undefined;
    this.add(
      new Tip(
        title,
        message,
        TipType.Warning,
        description,
        npmInstall(name, flags),
        'Install',
        `Installed ${name}`,
      ).setRelatedDependency(name),
    );
  }

  public deprecatedPlugin(name: string, message: string, url?: string) {
    if (exists(name)) {
      this.note(
        name,
        `This plugin is deprecated. ${message}`,
        url,
        TipType.Warning,
        `The plugin ${name} is deprecated. ${message}`,
      );
    }
  }

  public upgrade(name: string, title: string, message: string, fromVersion: string, toVersion: string, type: TipType) {
    if (exists(name)) {
      let extra = '';
      if (name == '@capacitor/core') {
        if (exists('@capacitor/ios')) {
          extra += ` @capacitor/ios@${toVersion}`;
        }
        if (exists('@capacitor/android')) {
          extra += ` @capacitor/android@${toVersion}`;
        }
      }
      this.add(
        new Tip(
          title,
          message,
          type,
          `Upgrade ${name} from ${fromVersion} to ${toVersion}`,
          npmInstall(`${name}@${toVersion}${extra}`),
          `Upgrade`,
          `${name} upgraded to ${toVersion}`,
          `https://www.npmjs.com/package/${name}`,
          `Upgrading ${name}`,
        )
          .setSecondCommand(`Uninstall`, npmUninstall(name))
          .setContextValue(Context.upgrade)
          .setData({ name: name, version: fromVersion })
          .setTooltip(`${name} ${fromVersion}`),
      );
    }
  }

  public package(name: string, title: string, version: string, type: TipType) {
    if (exists(name)) {
      this.add(
        new Tip(
          title,
          version,
          type,
          `Uninstall ${name}`,
          npmUninstall(name),
          `Uninstall`,
          `${name} Uninstalled`,
          `https://www.npmjs.com/package/${name}`,
          `Uninstalling ${name}`,
        )
          .setContextValue(Context.upgrade)
          .setData({ name: name, version: undefined })
          .setTooltip(`${name} ${version}`),
      );
    }
  }

  public checkNotExists(library: string, message: string) {
    if (exists(library)) {
      this.add(
        new Tip(
          library,
          message,
          TipType.Error,
          undefined,
          npmUninstall(library),
          'Uninstall',
          `Uninstalled ${library}`,
        ).setRelatedDependency(library),
      );
    }
  }

  public tip(tip: Tip) {
    if (tip) {
      this.add(tip);
    }
  }

  public tips(tips: Tip[]) {
    if (!tips) return;
    for (const tip of tips) {
      this.tip(tip);
    }
  }

  public fileExists(filename: string): boolean {
    return existsSync(join(this.projectFolder(), filename));
  }

  public getDistFolder(): string {
    return getCapacitorConfigDistFolder(this.projectFolder());
  }
}

function checkNodeVersion() {
  try {
    const v = process.version.split('.');
    const major = parseInt(v[0].substring(1));
    if (major < 13) {
      window.showErrorMessage(
        `This extension requires a minimum version of Node 14. ${process.version} is not supported.`,
        'OK',
      );
    }
  } catch {
    // Do nothing
  }
}

export async function installPackage(extensionPath: string, folder: string) {
  const selected = await window.showInputBox({ placeHolder: 'Enter package name to install' });
  if (!selected) return;

  await fixIssue(
    npmInstall(selected),
    folder,
    undefined,
    new Tip(
      `Install ${selected}`,
      undefined,
      TipType.Run,
      undefined,
      undefined,
      `Installing ${selected}`,
      `Installed ${selected}`,
    ).showProgressDialog(),
  );
}

export interface ProjectSummary {
  project: Project;
  packages: any;
}

export async function reviewProject(
  folder: string,
  context: ExtensionContext,
  selectedProject: string,
): Promise<ProjectSummary | undefined> {
  if (!folder) return undefined;
  const summary = await inspectProject(folder, context, selectedProject);
  if (!summary || !summary.project) return undefined;
  return summary;
}

export async function inspectProject(
  folder: string,
  context: ExtensionContext,
  selectedProject: string,
): Promise<ProjectSummary> {
  const startedOp = Date.now();
  commands.executeCommand(VSCommand.setContext, Context.inspectedProject, false);
  commands.executeCommand(VSCommand.setContext, Context.isLoggingIn, false);

  const project: Project = new Project('My Project');
  project.folder = folder;
  project.packageManager = getPackageManager(folder, project.repoType);
  exState.packageManager = project.packageManager;
  exState.rootFolder = folder;
  exState.projectRef = project;

  let packages = await load(folder, project, context);
  exState.view.title = project.name;
  project.type = project.isCapacitor ? 'Capacitor' : project.isCordova ? 'Cordova' : 'Other';

  const gConfig = getGlobalIonicConfig();

  if (!Features.requireLogin) {
    exState.skipAuth = true;
  }

  if (!gConfig['user.id'] && !exState.skipAuth) {
    commands.executeCommand(VSCommand.setContext, Context.isAnonymous, true);
    return undefined;
  } else {
    commands.executeCommand(VSCommand.setContext, Context.isAnonymous, false);
  }

  await checkForMonoRepo(project, selectedProject, context);

  if (project.monoRepo?.folder) {
    // Use the package manager from the monorepo project
    project.packageManager = getPackageManager(project.monoRepo.folder, project.repoType);

    exState.packageManager = project.packageManager;
  }
  if (project.monoRepo?.localPackageJson) {
    packages = await load(project.monoRepo.folder, project, context);
  }

  guessFramework(project);

  sendTelemetryEvents(folder, project, packages, context);

  checkNodeVersion();
  project.getIgnored(context);

  await getRecommendations(project, context, packages);

  commands.executeCommand(VSCommand.setContext, Context.inspectedProject, true);

  return { project, packages };
}

function guessFramework(project: Project) {
  const config = getIonicConfig(project.projectFolder());
  project.frameworkType = config.type as FrameworkType;
  if (project.frameworkType) return;
  if (exists('@vue/cli-service')) {
    project.frameworkType = 'vue';
  } else if (exists('@angular/core')) {
    project.frameworkType = 'angular';
  } else if (exists('@angular/cli')) {
    project.frameworkType = 'angular-standalone';
  } else if (exists('@ionic/angular')) {
    project.frameworkType = 'angular-standalone';
  } else if (exists('react-scripts')) {
    project.frameworkType = 'react';
  } else if (exists('vite') && !exists('@remix-run/react')) {
    if (exists('react')) {
      project.frameworkType = 'react-vite';
    }
    if (exists('vue')) {
      project.frameworkType = 'vue-vite';
    }
  }
  if (!project.frameworkType) {
    // Project may not being using a known framework or its a regular node project  }
  }
}

function getPackageManager(folder: string, monoRepoType: MonoRepoType): PackageManager {
  const yarnLock = join(folder, 'yarn.lock');
  const pnpmLock = join(folder, 'pnpm-lock.yaml');
  const bunLock = join(folder, 'bun.lockb');
  if (existsSync(yarnLock)) {
    return PackageManager.yarn;
  } else if (existsSync(pnpmLock) || exState.repoType == MonoRepoType.pnpm) {
    return PackageManager.pnpm;
  } else if (existsSync(bunLock)) {
    return PackageManager.bun;
  }

  if (monoRepoType == MonoRepoType.yarn) {
    const packageLock = join(folder, 'package-lock.json');

    if (!existsSync(packageLock)) {
      // Its a yarn monorepo so use yarn as package manager
      return PackageManager.yarn;
    }
  }
  return PackageManager.npm;
}
