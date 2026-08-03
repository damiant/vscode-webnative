import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { registerCommand } from '../cli/registry';
import { flagBool } from '../cli/args';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { getCapacitorConfigureFilename, getCapacitorConfigWebDir } from '../project/capacitor-config-file';
import { getCapacitorProjectState } from '../native/configure';
import { MonoRepoType } from '../project/monorepo';
import { PackageManager } from '../build/node-commands';
import { runChecks } from '../rules/engine';
import { ensureProject } from './helpers';
import { CliContext } from '../core/context';

function toolVersion(cmd: string): string | undefined {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim()
      .split('\n')[0];
  } catch {
    return undefined;
  }
}

function ver(v: { version?: string } | string | null | undefined): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  return v.version;
}

async function runInfo(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const folder = project.projectFolder();
  const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
  const platformsOnly = flagBool(ctx.args.flags, 'platforms');
  const withCheck = flagBool(ctx.args.flags, 'check');

  const capConfigFile = getCapacitorConfigureFilename(folder);
  let appId: string | undefined;
  let appName: string | undefined;
  if (capConfigFile) {
    try {
      const raw = readFileSync(capConfigFile, 'utf8');
      const idMatch = raw.match(/appId:\s*['"`]([^'"`]+)['"`]/);
      const nameMatch = raw.match(/appName:\s*['"`]([^'"`]+)['"`]/);
      appId = idMatch?.[1];
      appName = nameMatch?.[1];
    } catch {
      /* ignore */
    }
  }

  const native = (await getCapacitorProjectState(folder)) || {};
  const platforms = [
    {
      name: 'ios',
      installed: project.hasCapacitorProject(CapacitorPlatform.ios),
      version: native.iosVersion,
      buildNumber: native.iosBuild != null ? String(native.iosBuild) : undefined,
      appId: native.iosBundleId,
      appName: native.iosDisplayName,
    },
    {
      name: 'android',
      installed: project.hasCapacitorProject(CapacitorPlatform.android),
      version: native.androidVersion,
      buildNumber: native.androidBuild != null ? String(native.androidBuild) : undefined,
      appId: native.androidBundleId,
      appName: native.androidDisplayName,
    },
  ];

  if (platformsOnly) {
    return { platforms };
  }

  const plugins: Array<{ name: string; version: string }> = [];
  for (const [name, version] of Object.entries(project.analyzer.getAllDependencies())) {
    if (
      name.startsWith('@capacitor/') &&
      !['@capacitor/core', '@capacitor/cli', '@capacitor/ios', '@capacitor/android'].includes(name)
    ) {
      plugins.push({ name, version: String(version).replace(/^[\^~]/, '') });
    }
  }

  const data: Record<string, unknown> = {
    root: project.folder,
    name: pkg.name || project.name,
    type: project.type,
    framework: project.frameworkType,
    packageManager: PackageManager[project.packageManager] || project.packageManager,
    monorepo:
      project.repoType != null && project.repoType !== MonoRepoType.none
        ? {
            type: MonoRepoType[project.repoType] || project.repoType,
            projects: (project.monoRepoProjects || []).map((p) => p.name),
            selected: project.monoRepo?.name,
          }
        : undefined,
    webDir: getCapacitorConfigWebDir(folder) || undefined,
    buildScript: pkg.scripts?.['wn:build']
      ? 'wn:build'
      : pkg.scripts?.['ionic:build']
        ? 'ionic:build'
        : pkg.scripts?.build
          ? 'build'
          : undefined,
    capacitor: project.isCapacitor
      ? {
          cliVersion: ver(project.analyzer.getPackageVersion('@capacitor/cli')),
          coreVersion: ver(project.analyzer.getPackageVersion('@capacitor/core')),
          configFile: capConfigFile ? capConfigFile.replace(folder + '/', '') : undefined,
          appId,
          appName,
          platforms,
        }
      : undefined,
    plugins,
    scripts: Object.keys(pkg.scripts || {}),
    toolchain: {
      node: process.version.replace(/^v/, ''),
      xcode: process.platform === 'darwin' ? toolVersion('xcodebuild -version') : undefined,
      jdk: toolVersion('java -version 2>&1') || undefined,
      cocoapods: process.platform === 'darwin' ? toolVersion('pod --version') : undefined,
      adb: ctx.config.adbPath || toolVersion('which adb') || undefined,
    },
  };

  if (withCheck) {
    const findings = await runChecks(project);
    data.checks = {
      counts: {
        error: findings.filter((f) => f.severity === 'error').length,
        warning: findings.filter((f) => f.severity === 'warning').length,
        info: findings.filter((f) => f.severity === 'info').length,
      },
      findings: findings.slice(0, 20),
    };
  }

  return data;
}

registerCommand({
  name: 'info',
  description: 'Inspect the project (framework, platforms, toolchain)',
  run: runInfo,
});
