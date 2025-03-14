import { join } from 'path';
import { Tip } from './tip';
import { Command, TreeItem, TreeItemCollapsibleState } from 'vscode';

export class Recommendation extends TreeItem {
  public children: Recommendation[];
  private iconName: string;
  private data: any;
  public whenExpanded: () => Promise<Array<Recommendation>>;

  constructor(
    public readonly tooltip: string,
    public readonly title: string,
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly command?: Command,
    public tip?: Tip,
    public readonly url?: string,
  ) {
    super(label, collapsibleState);

    this.tooltip = `${this.tooltip}`;
    this.description = this.title;
  }

  public setIcon(name: string) {
    this.iconName = name;
    this.iconPath = {
      light: join(__filename, '..', '..', 'resources', 'light', name + '.svg'),
      dark: join(__filename, '..', '..', 'resources', 'dark', name + '.svg'),
    };
  }

  public setData(data: any): Recommendation {
    this.data = data;
    return this;
  }

  public getData(): any {
    return this.data;
  }

  // Animated icons need to have an equivalent filename with -anim that contains animated svg
  public animate() {
    this.setIcon(this.iconName + '-anim');
  }

  public setContext(value: string) {
    this.contextValue = value;
  }

  iconPath = undefined;
  contextValue = 'recommendation';
}
