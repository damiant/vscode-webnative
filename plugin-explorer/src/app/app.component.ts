import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { PluginFilter, PluginService } from './plugin.service';
import { Plugin } from './plugin-info';
import { checked, d, setChecked } from './utilities/dom';
import { MessageType, sendMessage } from './utilities/messages';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { PluginComponent } from './plugin.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [BrowserModule, FormsModule, PluginComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  plugins: Plugin[] = [];
  terms = '';
  listTitle = '';
  isInstalled: string | undefined = 'true';
  isCapOnly: string | undefined = 'false';

  count = 0;
  assetsUri = '';
  busy = true;
  private searchedPlugin: Plugin | undefined; // Found from search

  constructor(private pluginService: PluginService) {}

  async ngOnInit() {
    window.addEventListener('message', this.onMessage.bind(this));
    sendMessage(MessageType.getPlugins, '');
  }

  async onMessage(event: any) {
    switch (event.data.command) {
      case MessageType.getPlugins:
        await this.pluginService.get(event.data.uri);
        this.assetsUri = event.data.assetsUri;
        this.pluginService.calculatedUnknownPlugins();
        this.search();
        this.busy = false;
        break;
      case MessageType.getPlugin:
        if (!event.data || !event.data.data || !event.data.data.name) break;
        this.searchedPlugin = event.data.data;
        // Add to the list of displayed plugins if found
        if (this.searchedPlugin) {
          this.searchedPlugin.title = this.pluginService.getTitle(this.searchedPlugin.name);
          this.searchedPlugin.dailyDownloads = '0';
          this.searchedPlugin.ratingInfo = 'This dependency was found on npmjs.com and has not been tested yet.';
          this.searchedPlugin.moreInfoUrl = this.pluginService.getMoreInfoUrl(this.searchedPlugin);
          if (!this.pluginListed(this.searchedPlugin.name)) {
            this.plugins.push(this.searchedPlugin);
            if (this.plugins.length == 1) {
              this.listTitle = `Found "${this.searchedPlugin.name}" on npmjs.com`;
            }
            console.log(`Added plugin from search`, event.data);
          }
        }
        break;
      case MessageType.chooseVersion:
        this.search();
        break;
      case MessageType.getInstalledDeps:
        this.pluginService.setInstalled(event.data.list);
        break;
    }
  }
  change() {
    setTimeout(() => {
      this.search();
    }, 100);
  }

  // User checked Official plugins
  changeOfficial() {
    setChecked('installed', false);
    this.change();
  }

  pluginListed(name: string): boolean {
    return !!this.plugins.find((p) => p.name == name);
  }

  search(): void {
    this.terms = d('sch');
    this.searchedPlugin = undefined;
    const filters: PluginFilter[] = [];
    if (this.terms?.length > 0) {
      filters.push(PluginFilter.search);
      setChecked('installed', false);
    }
    this.listTitle = `Plugins`;

    if (checked('installed')) {
      filters.push(PluginFilter.installed);
      this.listTitle = 'Installed Plugins';
    }
    if (checked('official')) {
      filters.push(PluginFilter.official);
      this.listTitle = 'Official Plugins';
    }

    if (checked('capOnly')) {
      this.listTitle = `Plugins excluding Cordova plugins`;
    }

    const android = checked('android');
    const ios = checked('ios');
    const both = checked('both');
    const any = checked('any');

    this.plugins = this.pluginService.search(filters, this.terms, checked('capOnly'), android, ios, both, any);
    this.count = this.plugins.length;

    if (filters.includes(PluginFilter.search)) this.listTitle += ` related to '${this.terms}'`;
    if (android && !ios) this.listTitle += ` that work on Android`;
    if (!android && ios) this.listTitle += ` that work on iOS`;
    if (both) this.listTitle += ` that work on iOS and Android`;

    if (this.count > 0) {
      this.listTitle = `${this.count == 50 ? 'First ' : ''}${this.count} ${this.listTitle}`;
    } else {
      this.listTitle = 'No results shown';
    }
    if (this.terms) {
      console.log(`Send request for ${this.terms}`);
      sendMessage(MessageType.getPlugin, this.terms);
    }
  }
}
