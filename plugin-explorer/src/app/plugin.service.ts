import { Injectable } from '@angular/core';
import { Plugin, PluginInfo } from './plugin-info';

export enum PluginFilter {
  installed = 1,
  search = 2,
  official = 3,
}

@Injectable({
  providedIn: 'root',
})
export class PluginService {
  private plugins: Plugin[] = [];
  private installed: any = {};
  private latest: any = {};
  private unknownPlugins: Plugin[] = [];
  public async get(url: string) {
    const response = await fetch(url);
    const plugins: Plugin[] = await response.json();
    for (const plugin of plugins) {
      let scope = '';
      let name = plugin.name;
      if (plugin.name.startsWith('@')) {
        const tmp = plugin.name.split('/');
        scope = tmp[0];
        name = tmp[1];
      }
      plugin.title = this.getTitle(name);
      const publishedMonths = this.calcChange(plugin.published);
      plugin.changed = this.changeInMonths(publishedMonths);
      plugin.framework = this.getFramework(plugin);
      if (plugin.platforms.length == 1) {
        if (plugin.platforms.includes('android')) {
          plugin.singlePlatform = 'android';
        } else if (plugin.platforms.includes('ios')) {
          plugin.singlePlatform = 'apple';
        }
      }
      plugin.moreInfoUrl = this.getMoreInfoUrl(plugin);
      plugin.tagInfo = this.getTagInfo(plugin);
      plugin.rating = this.calculateRating(scope, plugin, publishedMonths);
      plugin.dailyDownloads = this.calculateDaily(plugin);
      plugin.license = this.calculateLicense(plugin);
    }
    this.plugins = plugins;
  }

  private calculateLicense(plugin: Plugin): string {
    if (plugin.license?.length > 20) {
      return plugin.license.substring(0, 20) + '...';
    }
    if (plugin.name.startsWith('@ionic-enterprise/')) {
      return 'Commercial';
    }
    if (!plugin.license || plugin.license.length < 1) {
      return 'Unknown';
    }
    return plugin.license;
  }

  private getTagInfo(plugin: Plugin) {
    let msg = plugin.framework ? `${this.capitialize(plugin.framework)} plugin` : `Package`;
    if (plugin.singlePlatform) {
      msg += ` that only works with ${this.capitialize(plugin.singlePlatform)}`;
    }
    return msg + `. Version ${plugin.version} is the latest version reviewed.`;
  }

  public getMoreInfoUrl(plugin: Plugin): string {
    let url = `https://www.npmjs.com/package/${plugin.name}`;
    if (plugin.name.startsWith('@capacitor/')) {
      url = `https://capacitorjs.com/docs/apis/${plugin.name.replace('@capacitor/', '')}`;
    } else if (plugin.name.startsWith('@ionic-enterprise/')) {
      let part = plugin.name.replace('@ionic-enterprise/', '');
      if (part == 'auth') part = 'auth-connect';
      url = `https://ionic.io/docs/${part}`;
    }
    return url;
  }

  private capitialize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getFramework(plugin: Plugin): string | undefined {
    let framework = undefined;

    for (const item of plugin.success) {
      if (item.includes('capacitor')) {
        framework = 'capacitor';
      }
      if (item.includes('cordova')) {
        return 'cordova';
      }
    }
    return framework;
  }

  public getTitle(name: any): string {
    const words = name.replace('/', '-').replaceAll('.', ' ').split('-');
    return this.titleCase(
      words.filter((word: string) => word !== 'capacitor' && word !== 'cordova' && word !== 'plugin').join(' '),
    );
  }

  public setInstalled(plugins: PluginInfo[]) {
    this.installed = {};
    for (const plugin of plugins) {
      this.installed[plugin.name] = plugin.version;
      this.latest[plugin.name] = plugin.latest;
    }
  }

  public calculatedUnknownPlugins() {
    this.unknownPlugins = [];
    const names = [];
    for (const key of Object.keys(this.installed)) {
      names.push(key);
    }
    for (const plugin of this.plugins) {
      const index = names.indexOf(plugin.name);
      if (index !== -1) {
        names.splice(index, 1);
      }
    }
    for (const name of names) {
      this.unknownPlugins.push({
        name: name,
        success: [],
        fails: [],
        version: this.installed[name],
        ratingInfo: 'This plugin has not been reviewed.',
        tagInfo: '',
        changed: '',
        installed: this.installed[name],
        license: 'Unknown',
        versions: [],
        platforms: [],
        title: name,
        published: '',
        author: '',
        rating: 0,
        moreInfoUrl: 'https://www.npmjs.com/package/' + name,
        framework: '',
        singlePlatform: undefined,
        dailyDownloads: '?',
      });
    }
  }

  public search(
    filters: PluginFilter[],
    terms: string,
    capacitorOnly: boolean,
    android: boolean,
    ios: boolean,
    both: boolean,
    any: boolean,
  ): Plugin[] {
    let count = 0;
    const termsWithDash = this.replaceAll(terms, ' ', '-');

    const list = this.plugins.filter((plugin) => {
      try {
        let found = true;
        if (filters.includes(PluginFilter.search)) {
          found =
            this.match(terms, [plugin.name, plugin.title, plugin.description as string]) ||
            plugin.keywords?.includes(terms) ||
            false;
        }
        if (filters.includes(PluginFilter.installed)) {
          found = found && !!this.installed[plugin.name];
        }
        if (filters.includes(PluginFilter.official)) {
          found = found && this.isOfficial(plugin.name);
        }

        found = found && this.passedPlatforms(android, ios, both, any, plugin);

        if (capacitorOnly) {
          found = found && plugin.framework == 'capacitor';
        }
        if (found) {
          count++;
          plugin.installed = this.installed[plugin.name];
        }
        return found && count <= 50;
      } catch (error) {
        console.error(error);
        return false;
      }
    });
    if (filters.includes(PluginFilter.installed)) {
      // Need to add any plugins that are installed but not indexed
      for (const plugin of this.unknownPlugins) {
        list.push(plugin);
      }

      // Latest versions come from the extension
      for (const plugin of list) {
        const latest = this.latest[plugin.name];
        if (latest) {
          plugin.version = latest;
        }
      }
    }
    return list.sort((a, b) => this.sortFactor(b) - this.sortFactor(a));
  }

  private match(terms: string, values: string[]): boolean {
    for (const value of values) {
      if (!terms.includes(' ')) {
        return value?.includes(terms);
      } else {
        for (const term of terms.split(' ')) {
          if (value?.includes(term) && term.length > 2) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private sortFactor(p: Plugin): number {
    return this.boost(p.name) + p.rating + this.downloadBoost(p.downloads);
  }

  private downloadBoost(d: number | undefined): number {
    if (!d) return 0;
    const v = d / 100;
    if (v < 0.9) {
      return v;
    } else {
      return 0.9;
    }
  }

  // Returns an amount of daily downloads: eg (10k, 100)
  private calculateDaily(plugin: Plugin): string {
    const daily = plugin.downloads ? Math.round(plugin.downloads / 31) : 0;
    if (daily > 1000) {
      return `${Math.round(daily / 1000)}k`;
    } else {
      return `${daily}`;
    }
  }

  private isOfficial(name: string): boolean {
    return name.startsWith('@capacitor/') || name.startsWith('@ionic-enterprise');
  }

  // We rate @capacitor first then @ionic-enterprise
  private boost(name: string): number {
    return (name.startsWith('@capacitor/') ? 100000 : 0) + (name.startsWith('@ionic-enterprise') ? 10000 : 0);
  }

  // Returns true if the plugin passed at least one test for the platform
  private passedPlatforms(android: boolean, ios: boolean, both: boolean, any: boolean, plugin: Plugin): boolean {
    if (any) return true;
    if (android && plugin.platforms.includes('android')) return true;
    if (ios && plugin.platforms.includes('ios')) return true;
    if (both && plugin.platforms.length == 2) return true;
    return false;
  }

  private calcChange(published: string): number {
    const from = new Date(published);
    const months = this.monthDiff(from, new Date());
    return months;
  }

  private changeInMonths(months: number): string {
    if (months == 0) {
      return 'Updated Recently';
    } else if (months < 12) {
      return `${months} Months Ago`;
    } else {
      return `${Math.round(months / 12.0)} Years Ago`;
    }
  }

  private monthDiff(dateFrom: Date, dateTo: Date) {
    return dateTo.getMonth() - dateFrom.getMonth() + 12 * (dateTo.getFullYear() - dateFrom.getFullYear());
  }

  private sentence(current: string, info: string): string {
    if (current !== '') {
      return `${current}, ${info}`;
    } else {
      return info;
    }
  }

  private replaceAll(str: string, find: string, replace: string): string {
    return str.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
  }

  private calculateRating(scope: string, plugin: Plugin, publishedMonths: number): number {
    let rating = 0;
    plugin.ratingInfo = '';
    const official = scope == '@capacitor' || scope == '@ionic-enterprise';
    // Must have github stars, be less than 12 months old, or an official plugin
    if ((plugin.stars && plugin.stars > 100) || official) {
      rating++;
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'popular on GitHub');
    } else {
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'not that popular on GitHub');
    }

    if (publishedMonths >= 13) {
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'possibly unmaintained');
    }

    // Has source in Github that has been updated
    if (plugin.updated && publishedMonths < 13) {
      rating++;
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'updated frequently');
    }

    // Has npm downloads of > 1000 per month
    if (plugin.downloads && plugin.downloads > 1000) {
      rating++;
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'regularly downloaded');
    } else {
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'infrequently used');
    }

    // Has a source repo and isnt  version 0.x
    if (plugin.repo && !plugin.version.startsWith('0')) {
      rating++;
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'is open source');
    } else if (!plugin.repo) {
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'is closed source / commercial');
    }

    if (plugin.version.startsWith('0')) {
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'is a development release');
    }

    // If it doesnt build then rate it 0
    if (plugin.success.length == 0) {
      rating = 0;
      plugin.ratingInfo = this.sentence(plugin.ratingInfo, 'does not compile');
    }

    if (official) {
      rating = 5; // Assume awesomeness
    }
    return rating;
  }

  private titleCase(str: string) {
    const tmp = str.toLowerCase().split(' ');
    for (let i = 0; i < tmp.length; i++) {
      tmp[i] = tmp[i].charAt(0).toUpperCase() + tmp[i].slice(1);
    }
    return tmp.join(' ');
  }
}
