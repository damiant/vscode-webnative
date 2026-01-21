import { existsSync, writeFileSync } from 'fs';
import xcode, { XcodeProjectType } from 'xcode';
import plist from 'simple-plist';
import { join } from 'path';

export class IosProject {
  private _projectPath: string;
  private _infoPlistPath: string;
  private _project: XcodeProjectType;

  constructor(projectPath: string) {
    this._projectPath = join(projectPath, 'App.xcodeproj', 'project.pbxproj');
    this._infoPlistPath = join(projectPath, 'App', 'Info.plist');
  }

  exists(): boolean {
    return existsSync(this._projectPath);
  }

  async parse(): Promise<boolean> {
    if (!this.exists()) {
      return false;
    }
    this._project = xcode.project(this._projectPath);
    try {
      await this.parseAsync(this._project);
      return true;
    } catch (error) {
      console.error(error);
      throw new Error(`Unable to parse project ${this._projectPath}`);
    }
  }

  parseAsync(project: XcodeProjectType) {
    return new Promise((resolve, reject) => {
      project.parse((err) => {
        if (err) return reject(err);
        resolve(undefined);
      });
    });
  }

  getAppTarget(): AppTarget {
    const targets = this.getAppTargets();
    return targets[0];
  }

  getAppTargets(): AppTarget[] {
    const targets = this._project.hash.project.objects.PBXNativeTarget;
    const result: AppTarget[] = [];
    Object.keys(targets).forEach((key) => {
      result.push({ name: targets[key].name, id: key });
    });
    return result;
  }

  getBundleId(target: string): string {
    const targets = this._project.hash.project.objects.PBXNativeTarget;
    let bundleId = '';
    Object.keys(targets).forEach((key) => {
      if (targets[key].name === target) {
        const buildConfigs = this._project.hash.project.objects.XCBuildConfiguration;
        Object.keys(buildConfigs).forEach((configKey) => {
          const config = buildConfigs[configKey];

          if (config.buildSettings && config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER) {
            bundleId = config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER;
          }
        });
      }
    });
    if (bundleId == '') {
      throw new Error(`getBundleId ${target} failed`);
    }
    return bundleId;
  }

  async getDisplayName(): Promise<string> {
    const data: any = plist.readFileSync(this._infoPlistPath);
    return data.CFBundleDisplayName;
  }

  private async getProdutName(target: string): Promise<string> {
    let displayName = '';
    const targets = this._project.hash.project.objects.PBXNativeTarget;
    Object.keys(targets).forEach((key) => {
      if (targets[key].name === target) {
        const buildConfigs = this._project.hash.project.objects.XCBuildConfiguration;
        Object.keys(buildConfigs).forEach((configKey) => {
          const config = buildConfigs[configKey];

          if (config.buildSettings && config.buildSettings.PRODUCT_NAME) {
            displayName = config.buildSettings.PRODUCT_NAME.replace(/"/g, ''); // Remove quotes if present
          }
        });
        if (displayName == '') {
          throw new Error(`getDisplayName ${target} failed`);
        }
      }
    });
    return displayName;
  }

  getBuildConfigurations(target: string): BuildConfiguration[] {
    const buildConfigs = this._project.hash.project.objects.XCBuildConfiguration;
    const result: BuildConfiguration[] = [];
    Object.keys(buildConfigs).forEach((configKey) => {
      const config = buildConfigs[configKey];
      if (!config.baseConfigurationReference && config.name) {
        result.push({ name: config.name });
      }
    });
    return result;
  }

  getVersion(target: string, buildConfig: string): string {
    const identifier = this.getVariable(this.getInfoPlist().CFBundleShortVersionString);
    // eg version = MARKETING_VERSION
    const buildConfigs = this._project.hash.project.objects.XCBuildConfiguration;
    let version = '';
    Object.keys(buildConfigs).forEach((configKey) => {
      const config = buildConfigs[configKey];
      if (config.name === buildConfig) {
        if (config.buildSettings && config.buildSettings[identifier]) {
          version = config.buildSettings[identifier];
          //console.log(`Found version ${version} for ${identifier} in ${buildConfig}`);
          return;
        }
      }
    });
    if (version == '') {
      throw Error(`Couldnt find version for ${identifier} in ${buildConfig}`);
    }
    return version;
  }

  getInfoPlist(): any {
    return plist.readFileSync(this._infoPlistPath);
  }

  async getBuild(target: string, buildConfig: string): Promise<number> {
    const identifier = this.getVariable(this.getInfoPlist().CFBundleVersion);
    // eg version = MARKETING_VERSION
    const buildConfigs = this._project.hash.project.objects.XCBuildConfiguration;
    let build = '';
    Object.keys(buildConfigs).forEach((configKey) => {
      const config = buildConfigs[configKey];
      if (config.name === buildConfig) {
        if (config.buildSettings && config.buildSettings[identifier]) {
          build = config.buildSettings[identifier];
          return;
        }
      }
    });
    if (build == '') {
      throw Error(`Couldnt find build for ${identifier} in ${buildConfig}`);
    }
    return parseInt(build);
  }

  private getVariable(name: string): string {
    return name.replace('$(', '').replace(')', '');
  }

  async setBundleId(target: string, buildConfig: string, bundleId: string): Promise<void> {
    const targets = this._project.hash.project.objects.PBXNativeTarget;
    let set = false;
    Object.keys(targets).forEach((key) => {
      if (targets[key].name === target) {
        const buildConfigs = this._project.hash.project.objects.XCBuildConfiguration;
        Object.keys(buildConfigs).forEach((configKey) => {
          const config = buildConfigs[configKey];

          if (config.buildSettings && config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER) {
            config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = bundleId;
            writeFileSync(this._projectPath, this._project.writeSync());
            set = true;
          }
        });
      }
    });
    if (!set) {
      throw new Error(`setBundleId ${target} failed`);
    }
  }

  setVersion(target: string, buildConfig: string, version: string): void {
    const identifier = this.getVariable(this.getInfoPlist().CFBundleShortVersionString);
    let versionSet = false;
    const buildConfigs = this._project.hash.project.objects.XCBuildConfiguration;
    Object.keys(buildConfigs).forEach((configKey) => {
      const config = buildConfigs[configKey];
      if (config.name === buildConfig) {
        if (config.buildSettings && config.buildSettings[identifier]) {
          config.buildSettings[identifier] = version;
          writeFileSync(this._projectPath, this._project.writeSync());
          versionSet = true;
          return;
        }
      }
    });
    if (!versionSet) {
      throw Error(`Couldnt find version for ${identifier} in ${buildConfig}`);
    }
  }

  async setBuild(target: string, buildConfig: string, build: number): Promise<void> {
    const identifier = this.getVariable(this.getInfoPlist().CFBundleVersion);
    let set = false;
    const buildConfigs = this._project.hash.project.objects.XCBuildConfiguration;
    Object.keys(buildConfigs).forEach((configKey) => {
      const config = buildConfigs[configKey];
      if (config.name === buildConfig) {
        if (config.buildSettings && config.buildSettings[identifier]) {
          config.buildSettings[identifier] = build;
          writeFileSync(this._projectPath, this._project.writeSync());
          set = true;
          return;
        }
      }
    });
    if (!set) {
      throw Error(`Couldnt find build for ${identifier} in ${buildConfig}`);
    }
  }

  async setDisplayName(target: string, buildConfig: string, displayName: string): Promise<void> {
    const data: any = plist.readFileSync(this._infoPlistPath);
    data.CFBundleDisplayName = displayName;
    plist.writeFileSync(this._infoPlistPath, data);
  }
}

export interface BuildConfiguration {
  name: string;
}

export interface AppTarget {
  name: string;
  id: string;
}
