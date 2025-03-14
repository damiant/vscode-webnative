import { CUSTOM_ELEMENTS_SCHEMA, Component, Input } from '@angular/core';
import { Plugin } from './plugin-info';

import { StarComponent } from './star.component';
import { vscode } from './utilities/vscode';

@Component({
  selector: 'plugin',
  imports: [StarComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styleUrls: ['./plugin.component.css'],
  template: `
    <div class="px-group">
      <div class="prof tooltip">
        <img [hidden]="hide" (error)="hide = true" class="author" alt="data.author?.name" [src]="data.image" />
        <span style="top:55px" class="tooltiptext">{{ data.author?.name ? data.author.name : data.author }}</span>
      </div>
      <div class="panel2">
        <div class="center-title">
          <h2>{{ data.title }}</h2>
          <div class="tooltip center-image">
            <span class="tooltiptext wide-tip">{{ data.tagInfo }}</span>
            @if (frameWorkImage) {
              <img class="ionicon" [src]="frameWorkImage" />
            }
          </div>
          @if (platformImage) {
            <img class="ionicon" [src]="platformImage" />
          }
        </div>
        <p class="subtitle">{{ data.name }} {{ installedVersion }}</p>
        <!-- <div class="tooltip">
        <span class="tooltiptext wide-tip">{{ data.tagInfo }}</span>
        <vscode-badge *ngFor="let tag of data.tags">{{ tag }}</vscode-badge>
      </div> -->
        <p>{{ data.description }}</p>

        <br />
        @if (data.installed == data.version) {
          <vscode-button disabled>Up To Date</vscode-button>
        }
        @if (data.installed !== data.version) {
          <vscode-button (click)="install()">{{ data.installed ? 'Update' : 'Install' }}</vscode-button>
        }
        @if (data.installed) {
          <vscode-button (click)="uninstall()">Uninstall</vscode-button>
        }
        <vscode-button appearance="icon" (click)="chooseVersion()">
          <img class="ionicon" [src]="assetsUri + '/chevron-down.svg'" />
        </vscode-button>
      </div>
      <div class="side">
        <star class="tooltip" [rating]="data.rating">
          <span class="tooltiptext small-tooltip"
            >This plugin was
            <a href="https://capacitorjs.com/docs/vscode/plugins#plugin-ratings">automatically rated</a> based on being
            {{ data.ratingInfo }}</span
          >
        </star>
        @if (data.dailyDownloads !== '0') {
          <p>{{ data.dailyDownloads }} Downloads Daily</p>
        }
        <p>{{ data.changed }}</p>
        <p>License: {{ data.license }}</p>
        <vscode-link [href]="data.moreInfoUrl">More Information</vscode-link><br />
        @if (data.repo && data.updated) {
          <vscode-link [href]="data.repo">Source Code</vscode-link>
        }
        @if (data.repo && data.updated) {
          <br />
        }
        @if (data.bugs) {
          <vscode-link [href]="data.bugs">Report Issue</vscode-link>
        }
      </div>
    </div>
  `,
})
export class PluginComponent {
  _data!: Plugin;
  frameWorkImage: string | undefined;
  platformImage: string | undefined;
  installedVersion: string | undefined;

  @Input() set data(plugin: Plugin) {
    this._data = plugin;
    this.frameWorkImage = this.getFrameworkImage(plugin.framework);
    this.platformImage = plugin.singlePlatform ? this.assetsUri + `/${plugin.singlePlatform}.svg` : undefined;
    this.installedVersion = plugin.installed ? `v${plugin.installed}` : ``;
  }
  get data(): Plugin {
    return this._data;
  }

  @Input() assetsUri = '';

  hide = false;

  public install() {
    vscode.postMessage({
      command: 'install',
      text: this.data.name,
    });
  }

  public uninstall() {
    vscode.postMessage({
      command: 'uninstall',
      text: this.data.name,
    });
  }

  public chooseVersion() {
    vscode.postMessage({
      command: 'choose-version',
      text: this.data.name,
    });
  }

  private getFrameworkImage(framework: string | undefined): string | undefined {
    switch (framework) {
      case 'capacitor':
        return this.assetsUri + '/capacitor.svg';
      case 'cordova':
        return this.assetsUri + '/cordova.svg';
      default:
        return undefined;
    }
  }
}
