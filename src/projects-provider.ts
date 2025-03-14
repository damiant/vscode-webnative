import { Event, EventEmitter, ExtensionContext, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CommandName } from './command-name';
import { exState } from './wn-tree-provider';
import { Recommendation } from './recommendation';

export class ProjectsProvider implements TreeDataProvider<Recommendation> {
  private _onDidChangeTreeData: EventEmitter<Recommendation | undefined | void> = new EventEmitter<
    Recommendation | undefined | void
  >();
  readonly onDidChangeTreeData: Event<Recommendation | undefined | void> = this._onDidChangeTreeData.event;
  constructor(
    private workspaceRoot: string | undefined,
    private context: ExtensionContext,
  ) {}

  selectedProject: string;

  refresh(project: string): void {
    exState.workspace = project;
    this.selectedProject = project;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Recommendation): TreeItem {
    return element;
  }

  getChildren(element?: Recommendation): Thenable<Recommendation[]> {
    return Promise.resolve(this.projectList());
  }

  projectList(): Array<Recommendation> {
    const list = [];
    for (const project of exState.projects) {
      const cmd = {
        command: CommandName.ProjectSelect,
        title: 'Open',
        arguments: [project.name],
      };
      const r = new Recommendation(project.folder, undefined, project.name, TreeItemCollapsibleState.None, cmd);
      const icon = project.name == this.selectedProject ? 'circle-filled' : 'none';
      r.setIcon(icon);
      list.push(r);
    }
    return list;
  }
}
