import { join } from 'path';
import { Project } from './project';
import { project } from 'xcode';
import * as plist from 'simple-plist';
import { existsSync, writeFileSync } from 'fs';
import { QueueFunction, Tip, TipType } from './tip';
import { ExtensionContext, window } from 'vscode';
import { writeError, writeIonic } from './logging';
import { exists } from './analyzer';
import { openUri, replaceAll } from './utilities';
import { privacyManifestRules } from './privacy-manifest';
import { LastManifestCheck } from './context-variables';
import { clearRefreshCache } from './process-packages';

interface XCProject {
  p: any;
  projectFolder: string;
  projectFilePath: string;
}

interface APIUsage {
  api: string;
  plugin: string;
  reasons: string[];
  reasonUrl: string;
}

const oneHour = 60 * 1000 * 60;

export async function checkPrivacyManifest(project: Project, context: ExtensionContext): Promise<void> {
  const lastManifestCheck = getLastManifestCheck(context);
  if (lastManifestCheck < oneHour) {
    return;
  }

  const apisUsed: APIUsage[] = [];
  for (const api of Object.keys(privacyManifestRules)) {
    for (const plugin of privacyManifestRules[api]) {
      if (exists(plugin)) {
        apisUsed.push({ api, plugin, reasons: getReasons(api), reasonUrl: getReasonUrl(api) });
      }
    }
  }
  if (apisUsed.length == 0) {
    return; // Manifest file is not required
  }

  try {
    const xc = await getXCProject(project);
    if (!xc) {
      if (!existsSync(iosFolder(project))) {
        return; // They have @capacitor/ios but haven't added an iOS project yet
      }
      writeError(`XCode project file is missing: ${xCodeProjectFile(project)}.`);
      return;
    }
    const pFiles = xc.p.pbxFileReferenceSection();
    const files = Object.keys(pFiles);
    const found = files.find((f) => pFiles[f].path?.includes('.xcprivacy'));
    if (found) {
      // Has a .xcprivacy file
      investigatePrivacyManifest(project, replaceAll(pFiles[found].path, '"', ''), context, apisUsed);
      setLastManifestCheck(context);
      return;
    }
    const title = 'Add Privacy Manifest';
    project.add(
      new Tip(title, '', TipType.Warning)
        .setQueuedAction(createPrivacyManifest, project, context)
        .setTooltip('A Privacy Manifest file is required by Apple when submitting your app to the App Store.')
        .canRefreshAfter()
        .canIgnore(),
    );
    setLastManifestCheck(context);
    return undefined;
  } catch (err) {
    writeError(`Unable to read privacy manifest of XCode project: ${err}`);
  }
}

function setLastManifestCheck(context: ExtensionContext) {
  context.workspaceState.update(LastManifestCheck, new Date().getTime());
}

function getLastManifestCheck(context: ExtensionContext): number {
  const v = parseInt(context.workspaceState.get(LastManifestCheck));
  return new Date().getTime() - (isNaN(v) ? 0 : v);
}
async function investigatePrivacyManifest(
  project: Project,
  filename: string,
  context: ExtensionContext,
  apisUsages: APIUsage[],
) {
  const path = join(iosFolder(project), filename);
  if (!existsSync(path)) {
    writeError(`Unable to find privacy manifest file from XCode project: ${path}`);
    return;
  }
  try {
    const data: any = plist.readFileSync(path);
    for (const apiUsage of apisUsages) {
      const found = data.NSPrivacyAccessedAPITypes
        ? data.NSPrivacyAccessedAPITypes.find((a: any) => a.NSPrivacyAccessedAPIType == apiUsage.api)
        : undefined;
      if (!found || found.NSPrivacyAccessedAPITypeReasons?.length == 0) {
        project.add(
          new Tip(`Missing Privacy Manifest Category`, '', TipType.Error)
            .setQueuedAction(
              setPrivacyCategory,
              context,
              path,
              apiUsage.plugin,
              apiUsage.api,
              apiUsage.reasons,
              apiUsage.reasonUrl,
            )
            .setTooltip(`${apiUsage.plugin} requires that the privacy manifest specifies ${apiUsage.api}.`)
            .canRefreshAfter()
            .canIgnore(),
        );
      }
    }
  } catch (e) {
    writeError(`Unable to parse plist file: ${path}: ${e}`);
  }
}

async function setPrivacyCategory(
  queueFunction: QueueFunction,
  context: ExtensionContext,
  privacyFilename: string,
  plugin: string,
  category: string,
  reasons: string[],
  reasonUrl: string,
): Promise<void> {
  const result = await window.showInformationMessage(
    `The Privacy Manifest file in your XCode project requires ${category} and a reason code for using it because ${plugin} uses this feature.`,
    'Docs',
    ...reasons,
    'Exit',
  );
  if (result === 'Docs') {
    openUri(reasonUrl);
    return;
  }
  if (result === 'Exit') {
    return;
  }
  queueFunction();

  const data: any = plist.readFileSync(privacyFilename);
  if (!data.NSPrivacyAccessedAPITypes) {
    data.NSPrivacyAccessedAPITypes = [];
  }
  const found = data.NSPrivacyAccessedAPITypes.find((t: any) => t.NSPrivacyAccessedAPIType == category);
  if (found) {
    if (!found.NSPrivacyAccessedAPITypeReasons) {
      found.NSPrivacyAccessedAPITypeReasons = [];
    }
    found.NSPrivacyAccessedAPITypeReasons.push(result);
  } else {
    data.NSPrivacyAccessedAPITypes.push({
      NSPrivacyAccessedAPIType: category,
      NSPrivacyAccessedAPITypeReasons: [result],
    });
  }
  plist.writeFileSync(privacyFilename, data);
  clearRefreshCache(context);
}

function XCodeProjFolder(project: Project): string {
  return join(iosFolder(project), 'App.xcodeproj');
}

export function iosFolder(project: Project): string {
  return join(project.projectFolder(), 'ios', 'App');
}

function xCodeProjectFile(project: Project): string {
  const projectFolder = XCodeProjFolder(project);
  return join(projectFolder, 'project.pbxproj');
}

async function getXCProject(project: Project): Promise<XCProject> {
  const projectFolder = XCodeProjFolder(project);
  const path = join(projectFolder, 'project.pbxproj');
  if (!existsSync(path)) {
    // iOS project not found
    return;
  }
  const p = await parse(path);
  return { projectFilePath: path, projectFolder, p };
}

async function createPrivacyManifest(queueFunction: QueueFunction, project: Project, context: ExtensionContext) {
  const result = await window.showInformationMessage(
    `Your app requires a Privacy Manifest file as it uses particular plugins. Would you like to create one?`,
    'Yes',
    'More Information',
    'Exit',
  );
  if (result == 'More Information') {
    openUri('https://developer.apple.com/support/third-party-SDK-requirements/');
    return;
  }
  if (result !== 'Yes') {
    return;
  }
  queueFunction();

  try {
    const xc = await getXCProject(project);
    const filename = 'PrivacyInfo.xcprivacy';
    const path = writeManifestFile(iosFolder(project), filename);

    const res = xc.p.addPbxGroup([], 'Resources', undefined, undefined);

    const r3 = xc.p.getPBXGroupByKey('504EC2FB1FED79650016851F', 'PBXGroup');
    const r2 = xc.p.addResourceFile(filename, {}, res.uuid);
    r3.children.push({ value: r2.fileRef, comment: 'Resources' });
    writeFileSync(xc.projectFilePath, xc.p.writeSync());
    writeIonic('A privacy manifest file was added to your project.');
  } catch (e) {
    writeError(`Unable to create privacy manifest file: ${e}`);
  }
  clearRefreshCache(context);
}

function writeManifestFile(iosFolder: string, filename: string): string {
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
  const f = join(iosFolder, filename);
  writeFileSync(f, content);
  return f;
}

async function parse(path: string): Promise<any> {
  return new Promise((resolve) => {
    const p = project(path);
    p.parse((err: any) => {
      resolve(p);
    });
  });
}

function getReasons(api: string): string[] {
  switch (api) {
    case 'NSPrivacyAccessedAPICategoryUserDefaults':
      return ['CA92.1', '1C8F.1'];
    case 'NSPrivacyAccessedAPICategoryFileTimestamp':
      return ['C617.1', 'DDA9.1', '3B52.1']; // FYI: 0A2A.1 is not applicable
    case 'NSPrivacyAccessedAPICategoryDiskSpace':
      return ['85F4.1', 'E174.1', '7D9E.1', 'B728.1'];
    case 'NSPrivacyAccessedAPICategorySystemBootTime':
      return ['35F9.1', '8FFB.1', '3D61.1'];
    case 'NSPrivacyAccessedAPICategoryActiveKeyboards':
      return ['3EC4.1', '54BD.1'];

    default:
      writeError(`Unknown api ${api} in getReasons`);
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
  }
}
