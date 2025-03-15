'use strict';

import { Project, reviewProject } from './project';
import { Recommendation } from './recommendation';
import { Context, VSCommand } from './context-variables';
import { isFolderBasedMonoRepo, MonoRepoProject, MonoRepoType } from './monorepo';
import { PackageManager } from './node-commands';
import { Tip } from './tip';
import { CapacitorPlatform } from './capacitor-platform';

import {
  Event,
  EventEmitter,
  ExtensionContext,
  TreeDataProvider,
  TreeItem,
  TreeView,
  WebviewPanel,
  commands,
} from 'vscode';
import { accessSync } from 'fs';
import { join } from 'path';
import { IonicStartPanel } from './starter';

interface ExState {
  view: TreeView<any>;
  skipAuth: boolean;
  projects: Array<MonoRepoProject>;
  repoType: MonoRepoType;
  packageManager: PackageManager;
  workspace: string; // Monorepo workspace name
  context: ExtensionContext;
  shell?: string;
  projectsView: TreeView<any>;
  selectedAndroidDevice?: string;
  selectedIOSDevice?: string;
  selectedAndroidDeviceName?: string;
  selectedIOSDeviceName?: string;
  projectDirty?: boolean; // Was there a likely change in the project (ie file saved)
  syncDone: Array<string>; // Was a cap sync done for a particular platform
  outputIsFocused: boolean; // True if the output window is focused
  channelFocus: boolean; // Whether to focus the output window
  refreshDebugDevices: boolean; // Should we refresh the list of debuggable devices
  remoteLogging: boolean; // Whether remote logging is enabled
  hasNodeModules: boolean; // Whether node modules are installed
  nodeModulesFolder: string; // The folder where node_modules is located
  hasPackageJson: boolean; // Whether folder has package.json
  hasNodeModulesNotified: boolean; // Whether we've notified the user of no node_modules
  configuration: string; // Build configuration
  project: string; // Angular project name
  nvm: string; // If .nvmrc is used will contain its contents
  rootFolder: string; // The folder to inspect
  flavors: string[]; // Android Flavors
  debugged: boolean; // Have we ever started debugging
  servePort: number; // The port used when the dev server is running
  webView: WebviewPanel | undefined; // The Web Browser preview
  runIOS: Tip;
  runAndroid: Tip;
  runWeb: Tip;
  lastRun: CapacitorPlatform;
  projectRef: Project;
}
export const exState: ExState = {
  view: undefined,
  context: undefined,
  skipAuth: false,
  projects: [],
  projectsView: undefined,
  repoType: MonoRepoType.none,
  packageManager: PackageManager.npm,
  workspace: undefined,
  outputIsFocused: false,
  channelFocus: true,
  hasNodeModules: undefined,
  nodeModulesFolder: undefined,
  hasPackageJson: undefined,
  hasNodeModulesNotified: undefined,
  syncDone: [],
  refreshDebugDevices: false,
  remoteLogging: false,
  runIOS: undefined,
  runAndroid: undefined,
  runWeb: undefined,
  nvm: undefined,
  flavors: undefined,
  rootFolder: undefined,
  webView: undefined,
  lastRun: undefined,
  projectRef: undefined,
  configuration: undefined,
  servePort: 8100,
  project: undefined,
  debugged: false,
};

interface FolderInfo {
  packageJsonExists: boolean;
  folderBased: boolean;
  folder: string;
}

let folderInfoCache: FolderInfo = undefined;

export class ExTreeProvider implements TreeDataProvider<Recommendation> {
  private _onDidChangeTreeData: EventEmitter<Recommendation | undefined | void> = new EventEmitter<
    Recommendation | undefined | void
  >();
  readonly onDidChangeTreeData: Event<Recommendation | undefined | void> = this._onDidChangeTreeData.event;

  selectedProject: string;

  constructor(
    private workspaceRoot: string | undefined,
    private context: ExtensionContext,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getParent(element: Recommendation) {
    return undefined;
  }

  getTreeItem(element: Recommendation): TreeItem {
    return element;
  }

  selectProject(project: string) {
    this.selectedProject = project;
    this.refresh();
  }

  async getChildren(element?: Recommendation): Promise<Recommendation[]> {
    if (!this.workspaceRoot) {
      commands.executeCommand(VSCommand.setContext, Context.noProjectFound, true);
      return Promise.resolve([]);
    }
    commands.executeCommand(VSCommand.setContext, Context.noProjectFound, false);

    if (element) {
      if (element.whenExpanded) {
        return element.whenExpanded();
      } else {
        return Promise.resolve(element.children);
      }
    } else {
      let folderInfo: FolderInfo = folderInfoCache;
      if (!folderInfo || folderInfo.folder != this.workspaceRoot || !folderInfo.packageJsonExists) {
        folderInfo = this.getFolderInfo(this.workspaceRoot);
        folderInfoCache = folderInfo;
      }
      if (folderInfo.packageJsonExists || folderInfo.folderBased) {
        const summary = await reviewProject(this.workspaceRoot, this.context, this.selectedProject);

        if (!summary) return [];
        return summary.project.groups;
      } else {
        IonicStartPanel.init(exState.context.extensionUri, this.workspaceRoot, exState.context);
        return Promise.resolve([]);
      }
    }
  }

  private getFolderInfo(folder: string): FolderInfo {
    const packageJsonPath = join(this.workspaceRoot, 'package.json');
    const folders = isFolderBasedMonoRepo(this.workspaceRoot);
    const packageJsonExists = this.pathExists(packageJsonPath);
    const folderBased = folders.length > 0 && !packageJsonExists;

    return {
      packageJsonExists,
      folderBased,
      folder,
    };
  }

  private pathExists(p: string): boolean {
    try {
      accessSync(p);
    } catch (err) {
      return false;
    }

    return true;
  }
}
