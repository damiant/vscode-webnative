import { join } from 'path';
import { project } from 'xcode';
import * as plist from '@webnativellc/simple-plist';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { replaceAll } from '../core/text';
import { privacyManifestRules } from './privacy-manifest';

export interface APIUsage {
  api: string;
  plugin: string;
  reasons: string[];
  reasonUrl: string;
}

export interface MissingPrivacyCategory {
  api: string;
  plugin: string;
  reasons: string[];
  reasonUrl: string;
}

export interface PrivacyManifestCheckResult {
  /** Whether a privacy manifest is required based on installed plugins */
  required: boolean;
  apisUsed: APIUsage[];
  hasManifest: boolean;
  manifestPath?: string;
  missingCategories: MissingPrivacyCategory[];
  needsCreation: boolean;
  error?: string;
}

export interface CreatePrivacyManifestResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface SetPrivacyCategoryResult {
  success: boolean;
  path: string;
  category: string;
  reason: string;
  error?: string;
}

interface XCProject {
  p: any;
  projectFolder: string;
  projectFilePath: string;
}

/**
 * Check whether the iOS project needs a privacy manifest and whether existing manifest entries are complete.
 */
export async function checkPrivacyManifest(
  projectFolder: string,
  pluginExists: (plugin: string) => boolean = defaultPluginExists(projectFolder),
): Promise<PrivacyManifestCheckResult> {
  if (process.platform !== 'darwin') {
    return {
      required: false,
      apisUsed: [],
      hasManifest: false,
      missingCategories: [],
      needsCreation: false,
    };
  }

  const apisUsed: APIUsage[] = [];
  for (const api of Object.keys(privacyManifestRules)) {
    for (const plugin of privacyManifestRules[api]) {
      if (pluginExists(plugin)) {
        apisUsed.push({ api, plugin, reasons: getReasons(api), reasonUrl: getReasonUrl(api) });
      }
    }
  }

  if (apisUsed.length == 0) {
    return {
      required: false,
      apisUsed: [],
      hasManifest: false,
      missingCategories: [],
      needsCreation: false,
    };
  }

  try {
    const xc = await getXCProject(projectFolder);
    if (!xc) {
      if (!existsSync(iosFolder(projectFolder))) {
        return {
          required: true,
          apisUsed,
          hasManifest: false,
          missingCategories: [],
          needsCreation: false,
        };
      }
      return {
        required: true,
        apisUsed,
        hasManifest: false,
        missingCategories: [],
        needsCreation: false,
        error: `XCode project file is missing: ${xCodeProjectFile(projectFolder)}.`,
      };
    }

    const pFiles = xc.p.pbxFileReferenceSection();
    const files = Object.keys(pFiles);
    const found = files.find((f) => pFiles[f].path?.includes('.xcprivacy'));
    if (found) {
      const manifestPath = join(iosFolder(projectFolder), replaceAll(pFiles[found].path, '"', ''));
      const missingCategories = investigatePrivacyManifest(manifestPath, apisUsed);
      return {
        required: true,
        apisUsed,
        hasManifest: true,
        manifestPath,
        missingCategories,
        needsCreation: false,
      };
    }

    return {
      required: true,
      apisUsed,
      hasManifest: false,
      missingCategories: [],
      needsCreation: true,
    };
  } catch (err) {
    return {
      required: true,
      apisUsed,
      hasManifest: false,
      missingCategories: [],
      needsCreation: false,
      error: `Unable to read privacy manifest of XCode project: ${err}`,
    };
  }
}

/**
 * Create a PrivacyInfo.xcprivacy file and add it to the Xcode project.
 */
export async function createPrivacyManifest(projectFolder: string): Promise<CreatePrivacyManifestResult> {
  try {
    const xc = await getXCProject(projectFolder);
    if (!xc) {
      return { success: false, error: 'XCode project not found' };
    }

    const filename = 'PrivacyInfo.xcprivacy';
    const path = writeManifestFile(iosFolder(projectFolder), filename);

    const res = xc.p.addPbxGroup([], 'Resources', undefined, undefined);

    const r3 = xc.p.getPBXGroupByKey('504EC2FB1FED79650016851F', 'PBXGroup');
    const r2 = xc.p.addResourceFile(filename, {}, res.uuid);
    r3.children.push({ value: r2.fileRef, comment: 'Resources' });
    writeFileSync(xc.projectFilePath, xc.p.writeSync());

    return { success: true, path };
  } catch (e) {
    return { success: false, error: `Unable to create privacy manifest file: ${e}` };
  }
}

/**
 * Add a reason code for a privacy API category in an existing manifest file.
 */
export function setPrivacyCategory(
  privacyFilename: string,
  category: string,
  reason: string,
): SetPrivacyCategoryResult {
  try {
    const data: any = plist.readFileSync(privacyFilename);
    if (!data.NSPrivacyAccessedAPITypes) {
      data.NSPrivacyAccessedAPITypes = [];
    }
    const found = data.NSPrivacyAccessedAPITypes.find((t: any) => t.NSPrivacyAccessedAPIType == category);
    if (found) {
      if (!found.NSPrivacyAccessedAPITypeReasons) {
        found.NSPrivacyAccessedAPITypeReasons = [];
      }
      if (!found.NSPrivacyAccessedAPITypeReasons.includes(reason)) {
        found.NSPrivacyAccessedAPITypeReasons.push(reason);
      }
    } else {
      data.NSPrivacyAccessedAPITypes.push({
        NSPrivacyAccessedAPIType: category,
        NSPrivacyAccessedAPITypeReasons: [reason],
      });
    }
    plist.writeFileSync(privacyFilename, data);
    return { success: true, path: privacyFilename, category, reason };
  } catch (e) {
    return { success: false, path: privacyFilename, category, reason, error: String(e) };
  }
}

function investigatePrivacyManifest(manifestPath: string, apisUsages: APIUsage[]): MissingPrivacyCategory[] {
  const missing: MissingPrivacyCategory[] = [];
  if (!existsSync(manifestPath)) {
    return missing;
  }
  try {
    const data: any = plist.readFileSync(manifestPath);
    for (const apiUsage of apisUsages) {
      const found = data.NSPrivacyAccessedAPITypes
        ? data.NSPrivacyAccessedAPITypes.find((a: any) => a.NSPrivacyAccessedAPIType == apiUsage.api)
        : undefined;
      if (!found || found.NSPrivacyAccessedAPITypeReasons?.length == 0) {
        missing.push({
          api: apiUsage.api,
          plugin: apiUsage.plugin,
          reasons: apiUsage.reasons,
          reasonUrl: apiUsage.reasonUrl,
        });
      }
    }
  } catch (e) {
    console.error(`Unable to parse plist file: ${manifestPath}: ${e}`);
  }
  return missing;
}

function defaultPluginExists(projectFolder: string): (plugin: string) => boolean {
  const pkgPath = join(projectFolder, 'package.json');
  let deps: Record<string, string> = {};
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      deps = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {
      /* ignore */
    }
  }
  return (plugin: string) => {
    if (deps[plugin]) return true;
    return existsSync(join(projectFolder, 'node_modules', plugin, 'package.json'));
  };
}

function XCodeProjFolder(projectFolder: string): string {
  return join(iosFolder(projectFolder), 'App.xcodeproj');
}

function iosFolder(projectFolder: string): string {
  return join(projectFolder, 'ios', 'App');
}

function xCodeProjectFile(projectFolder: string): string {
  const projectFolderPath = XCodeProjFolder(projectFolder);
  return join(projectFolderPath, 'project.pbxproj');
}

async function getXCProject(projectFolder: string): Promise<XCProject | undefined> {
  const xcodeFolder = XCodeProjFolder(projectFolder);
  const path = join(xcodeFolder, 'project.pbxproj');
  if (!existsSync(path)) {
    return undefined;
  }
  const p = await parse(path);
  return { projectFilePath: path, projectFolder: xcodeFolder, p };
}

function writeManifestFile(iosAppFolder: string, filename: string): string {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyAccessedAPITypes</key>
	<array/>
	<key>NSPrivacyCollectedDataTypes</key>
	<array/>
   </dict>
   </plist>`;
  const f = join(iosAppFolder, filename);
  writeFileSync(f, content);
  return f;
}

async function parse(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout parsing Xcode project at ${path}`));
    }, 5000);

    const p = project(path);
    p.parse((err: any) => {
      clearTimeout(timeout);
      if (err) {
        reject(err);
      } else {
        resolve(p);
      }
    });
  });
}

function getReasons(api: string): string[] {
  switch (api) {
    case 'NSPrivacyAccessedAPICategoryUserDefaults':
      return ['CA92.1', '1C8F.1'];
    case 'NSPrivacyAccessedAPICategoryFileTimestamp':
      return ['C617.1', 'DDA9.1', '3B52.1'];
    case 'NSPrivacyAccessedAPICategoryDiskSpace':
      return ['85F4.1', 'E174.1', '7D9E.1', 'B728.1'];
    case 'NSPrivacyAccessedAPICategorySystemBootTime':
      return ['35F9.1', '8FFB.1', '3D61.1'];
    case 'NSPrivacyAccessedAPICategoryActiveKeyboards':
      return ['3EC4.1', '54BD.1'];
    default:
      console.error(`Unknown api ${api} in getReasons`);
      return [];
  }
}

function getReasonUrl(api: string): string {
  switch (api) {
    case 'NSPrivacyAccessedAPICategoryUserDefaults':
      return 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api#4278401';
    case 'NSPrivacyAccessedAPICategoryFileTimestamp':
      return 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api#4278393';
    case 'NSPrivacyAccessedAPICategoryDiskSpace':
      return 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api#4278397';
    case 'NSPrivacyAccessedAPICategoryActiveKeyboards':
      return 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api#4278400';
    case 'NSPrivacyAccessedAPICategorySystemBootTime':
      return 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api#4278394';
    default:
      return '';
  }
}
