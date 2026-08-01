import { existsSync } from 'fs';
import { coerce, compare, lt } from 'semver';
import { commandContext, npmInstall, npmUninstall, saveDevArgument, PackageManager } from '../build/node-commands';
import { Project } from '../project/project';
import { Category, Finding, FindingCollector, Severity } from './finding';

function slug(value: string): string {
  return value.replace(/^@/, '').replace(/\//g, '-').replace(/_/g, '-');
}

function libString(lib: string, ver: string): string {
  const vstr = ver ? ` (${ver})` : '';
  return `${lib}${vstr}`;
}

function pm(project: Project) {
  return commandContext(project);
}

function fixCommand(project: Project, id: string, command: string | string[]): Finding['fix'] {
  return { id, command };
}

function addFinding(collector: FindingCollector, finding: Finding | undefined): void {
  if (finding) collector.add(finding);
}

function equals(value: unknown, expected: unknown | unknown[]): boolean {
  if (value == expected) return true;
  if (Array.isArray(expected) && expected.includes(value)) return true;
  return false;
}

export function checkMinVersion(
  project: Project,
  collector: FindingCollector,
  library: string,
  minVersion: string,
  reason?: string,
  url?: string,
  category: Category = 'packages',
): void {
  const v = project.analyzer.getPackageVersion(library);
  if (v && lt(v, minVersion)) {
    const id = `min-version-${slug(library)}`;
    const reasonText = reason ? ` ${reason}` : '';
    addFinding(collector, {
      id,
      severity: 'error',
      category,
      title: `${library} must be upgraded from ${v.version} to at least version ${minVersion}${reasonText}`,
      detail: `${library} ${v.version} is below the minimum required version ${minVersion}.`,
      url,
      fixable: true,
      fix: fixCommand(project, id, npmInstall(`${library}@latest`, pm(project))),
    });
  }
}

export function warnMinVersion(
  project: Project,
  collector: FindingCollector,
  library: string,
  minVersion: string,
  reason?: string,
  url?: string,
  category: Category = 'packages',
): void {
  const v = project.analyzer.getPackageVersion(library);
  if (v && lt(v, minVersion)) {
    const id = `min-version-warning-${slug(library)}`;
    const reasonText = reason ? ` ${reason}` : '';
    addFinding(collector, {
      id,
      severity: 'info',
      category,
      title: `Update ${library} to at least ${minVersion}${reasonText}`,
      detail: `${library} ${v.version} should be updated to at least ${minVersion}${reasonText}.`,
      url,
      fixable: true,
      fix: fixCommand(project, id, npmInstall(`${library}@latest`, pm(project))),
    });
  }
}

export function checkConsistentVersions(
  project: Project,
  collector: FindingCollector,
  lib1: string,
  lib2: string,
  category: Category = 'capacitor',
): void {
  const deps = project.analyzer.getAllDependencies();
  const v1 = coerce(deps[lib1]);
  const v2 = coerce(deps[lib2]);
  if (v1 && v2 && compare(v1, v2)) {
    const sameMajor = v1.major === v2.major;
    const id =
      lib1.startsWith('@capacitor/') && lib2.startsWith('@capacitor/')
        ? 'capacitor-version-mismatch'
        : `${slug(lib2)}-version-mismatch`;
    addFinding(collector, {
      id,
      severity: sameMajor ? 'warning' : 'error',
      category,
      title: sameMajor
        ? `Version of ${libString(lib2, v2.version)} should match ${libString(lib1, v1.version)}`
        : `Version of ${libString(lib2, v2.version)} must match ${libString(lib1, v1.version)}`,
      detail: `All related packages should share a compatible version. Align ${lib2} with ${lib1} (${v1.version}).`,
      fixable: true,
      fix: fixCommand(project, id, npmInstall(`${lib2}@${v1.version}`, pm(project))),
    });
  }
}

export function notRequiredPlugin(project: Project, collector: FindingCollector, name: string, message?: string): void {
  if (!project.analyzer.exists(name)) return;
  const msg = message ? `. ${message}` : '';
  const id = `not-required-plugin-${slug(name)}`;
  addFinding(collector, {
    id,
    severity: 'info',
    category: 'capacitor',
    title: `${name} is not required with Capacitor`,
    detail: `The plugin ${name} is not required with Capacitor${msg}`,
    fixable: true,
    fix: fixCommand(project, id, npmUninstall(name, pm(project))),
  });
}

export function replacementPlugin(
  project: Project,
  collector: FindingCollector,
  name: string,
  replacement: string,
  url?: string,
  severity: Severity = 'info',
  detail?: string,
): void {
  if (!project.analyzer.exists(name)) return;
  const reason = replacement.startsWith('@capacitor/')
    ? ' as it has official support from the Capacitor team.'
    : ' as it offers equivalent functionality.';
  const id = `replace-plugin-${slug(name)}`;
  addFinding(collector, {
    id,
    severity,
    category: 'capacitor',
    title: `Replace ${name} with ${replacement}`,
    detail:
      detail ??
      `The plugin ${name} could be replaced with ${replacement}${reason} Replacing the plugin will require manual refactoring in your code.`,
    url,
    fixable: true,
    fix: fixCommand(project, id, `${npmInstall(replacement, pm(project))} && ${npmUninstall(name, pm(project))}`),
  });
}

export function incompatibleReplacementPlugin(
  project: Project,
  collector: FindingCollector,
  name: string,
  replacement: string,
  url?: string,
): void {
  if (!project.analyzer.exists(name)) return;
  const id = `incompatible-replace-plugin-${slug(name)}`;
  addFinding(collector, {
    id,
    severity: 'info',
    category: 'capacitor',
    title: `Replace ${name} with ${replacement}`,
    detail: `The plugin ${name} is incompatible with Capacitor and must be replaced with ${replacement}${url ? ` (${url})` : ''}.`,
    url,
    fixable: true,
    fix: fixCommand(project, id, `${npmInstall(replacement, pm(project))} && ${npmUninstall(name, pm(project))}`),
  });
}

export function incompatiblePlugin(project: Project, collector: FindingCollector, name: string, url?: string): void {
  if (!project.analyzer.exists(name)) return;
  const isUrl = url?.startsWith('http');
  const msg = isUrl ? `See ${url}` : url ? url : '';
  const id = `incompatible-plugin-${slug(name)}`;
  addFinding(collector, {
    id,
    severity: 'error',
    category: 'capacitor',
    title: `${name} is incompatible with Capacitor. ${msg}`,
    detail: `The plugin ${name} is incompatible with Capacitor. ${msg}`,
    url: isUrl ? url : `https://www.npmjs.com/package/${name}`,
    fixable: false,
  });
}

export function reviewPlugin(project: Project, collector: FindingCollector, name: string): void {
  if (!project.analyzer.exists(name)) return;
  const id = `review-plugin-${slug(name)}`;
  addFinding(collector, {
    id,
    severity: 'warning',
    category: 'capacitor',
    title: `${name} requires Capacitor compatibility testing`,
    detail: `The plugin ${name} requires testing for Capacitor compatibility.`,
    fixable: false,
  });
}

export function deprecatedPlugin(
  project: Project,
  collector: FindingCollector,
  name: string,
  message: string,
  url?: string,
): void {
  if (!project.analyzer.exists(name)) return;
  const id = `deprecated-plugin-${slug(name)}`;
  addFinding(collector, {
    id,
    severity: 'warning',
    category: 'packages',
    title: `${name} is deprecated`,
    detail: `The plugin ${name} is deprecated. ${message}`,
    url,
    fixable: false,
  });
}

export function recommendReplace(
  project: Project,
  collector: FindingCollector,
  name: string,
  title: string,
  message: string,
  description: string,
  replacement: string,
  category: Category = 'packages',
): void {
  if (!project.analyzer.exists(name)) return;
  const id = `replace-package-${slug(name)}`;
  addFinding(collector, {
    id,
    severity: 'warning',
    category,
    title: title || message,
    detail: description || message,
    fixable: true,
    fix: fixCommand(project, id, `${npmInstall(replacement, pm(project))} && ${npmUninstall(name, pm(project))}`),
  });
}

export function recommendRemove(
  project: Project,
  collector: FindingCollector,
  name: string,
  title: string,
  message: string,
  description?: string,
  url?: string,
  category: Category = 'packages',
): void {
  if (!project.analyzer.exists(name)) return;
  const id = `remove-package-${slug(name)}`;
  addFinding(collector, {
    id,
    severity: 'warning',
    category,
    title: title || message,
    detail: description || message,
    url,
    fixable: true,
    fix: fixCommand(project, id, npmUninstall(name, pm(project))),
  });
}

export function recommendAdd(
  project: Project,
  collector: FindingCollector,
  name: string,
  title: string,
  message: string,
  description: string,
  devDependency: boolean,
  category: Category = 'packages',
): void {
  const id = `missing-package-${slug(name)}`;
  const flags = devDependency ? saveDevArgument(project.packageManager) : undefined;
  addFinding(collector, {
    id,
    severity: 'warning',
    category,
    title: title || message,
    detail: description || message,
    fixable: true,
    fix: fixCommand(project, id, npmInstall(name, pm(project), flags ?? '')),
  });
}

export function recommendUpgrade(
  project: Project,
  collector: FindingCollector,
  name: string,
  title: string,
  message: string,
  fromVersion: string,
  toVersion: string,
  severity: Severity = 'warning',
  category: Category = 'packages',
): void {
  if (!project.analyzer.exists(name)) return;
  let extra = '';
  if (name === '@capacitor/core') {
    if (project.analyzer.exists('@capacitor/ios')) {
      extra += ` @capacitor/ios@${toVersion}`;
    }
    if (project.analyzer.exists('@capacitor/android')) {
      extra += ` @capacitor/android@${toVersion}`;
    }
  }
  const id = `upgrade-package-${slug(name)}`;
  addFinding(collector, {
    id,
    severity,
    category,
    title: title || message,
    detail: `Upgrade ${name} from ${fromVersion} to ${toVersion}`,
    url: `https://www.npmjs.com/package/${name}`,
    fixable: true,
    fix: fixCommand(project, id, npmInstall(`${name}@${toVersion}${extra}`, pm(project))),
  });
}

export function checkNotExists(
  project: Project,
  collector: FindingCollector,
  library: string,
  message: string,
  category: Category = 'packages',
): void {
  if (!project.analyzer.exists(library)) return;
  const id = `remove-package-${slug(library)}`;
  addFinding(collector, {
    id,
    severity: 'error',
    category,
    title: `Remove ${library}`,
    detail: `${library} ${message}`,
    fixable: true,
    fix: fixCommand(project, id, npmUninstall(library, pm(project))),
  });
}

export function note(
  project: Project,
  collector: FindingCollector,
  title: string,
  message: string,
  url?: string,
  category: Category = 'packages',
): void {
  const id = `note-${slug(title)}`;
  addFinding(collector, {
    id,
    severity: 'info',
    category,
    title,
    detail: message,
    url,
    fixable: false,
  });
}

export function checkCordovaAndroidPreference(
  project: Project,
  collector: FindingCollector,
  preference: string,
  value: string | boolean,
): void {
  const cordovaConfig = project.analyzer.getCordovaConfig();
  if (!cordovaConfig) return;
  if (equals(cordovaConfig.androidPreferences?.[preference], value)) return;
  const id = `cordova-android-preference-${slug(preference)}`;
  addFinding(collector, {
    id,
    severity: 'error',
    category: 'cordova',
    title: `Set android preference ${preference} to ${value}`,
    detail: `The android preference ${preference} should be ${value}. Add <preference name="${preference}" value="${value}" /> to <platform name="android"> in config.xml`,
    fixable: false,
  });
}

export function checkCordovaAndroidPreferenceMinimum(
  project: Project,
  collector: FindingCollector,
  preference: string,
  minVersion: string,
): void {
  const cordovaConfig = project.analyzer.getCordovaConfig();
  if (!cordovaConfig) return;
  const v = coerce(cordovaConfig.androidPreferences?.[preference]);
  if (!v || lt(v, minVersion)) {
    const id = `cordova-android-preference-min-${slug(preference)}`;
    addFinding(collector, {
      id,
      severity: 'error',
      category: 'cordova',
      title: `Set android preference ${preference} to at least ${minVersion}`,
      detail: `The android preference ${preference} should be at a minimum ${minVersion}. Add <preference name="${preference}" value="${minVersion}" /> to <platform name="android"> in config.xml`,
      fixable: false,
    });
  }
}

export function checkCordovaIosPreference(
  project: Project,
  collector: FindingCollector,
  preference: string,
  value: unknown,
  preferredValue?: number,
): void {
  const cordovaConfig = project.analyzer.getCordovaConfig();
  if (!cordovaConfig) return;
  if (equals(cordovaConfig.iosPreferences?.[preference], value)) return;
  const id = `cordova-ios-preference-${slug(preference)}`;
  if (preferredValue) {
    addFinding(collector, {
      id,
      severity: 'error',
      category: 'cordova',
      title: `Fix ios preference ${preference}`,
      detail: `The ios preference ${preference} cannot be ${cordovaConfig.iosPreferences?.[preference]}. Add <preference name="${preference}" value="${preferredValue}" /> to <platform name="ios"> in config.xml`,
      fixable: false,
    });
  } else {
    addFinding(collector, {
      id,
      severity: 'error',
      category: 'cordova',
      title: `Set ios preference ${preference} to ${value}`,
      detail: `The ios preference ${preference} should be ${value}. Add <preference name="${preference}" value="${value}" /> to <platform name="ios"> in config.xml`,
      fixable: false,
    });
  }
}

export function addRawFinding(collector: FindingCollector, finding: Finding): void {
  collector.add(finding);
}

export function hasNodeModules(project: Project): boolean {
  const nmf = project.getNodeModulesFolder();
  return existsSync(nmf) || project.isModernYarn();
}

export function packageManagerName(project: Project): string {
  switch (project.packageManager) {
    case PackageManager.yarn:
      return 'yarn';
    case PackageManager.pnpm:
      return 'pnpm';
    case PackageManager.bun:
      return 'bun';
    default:
      return 'npm';
  }
}
