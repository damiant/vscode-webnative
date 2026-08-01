import { flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { registerCommand } from '../cli/registry';
import { capacitorAdd } from '../build/capacitor-add';
import {
  getCapacitorProjectState,
  NativePlatform,
  setBuild,
  setBundleId,
  setDisplayName,
  setVersion,
  validateBuild,
  validateBundleId,
  validateVersion,
} from '../native/configure';
import { checkPrivacyManifest, createPrivacyManifest, setPrivacyCategory } from '../native/privacy';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { CliContext } from '../core/context';
import { ensureProject, positional, runCommandResult } from './helpers';

function parsePlatform(raw?: string): NativePlatform | undefined {
  if (!raw) return undefined;
  switch (raw.toLowerCase()) {
    case 'ios':
      return NativePlatform.iOSOnly;
    case 'android':
      return NativePlatform.AndroidOnly;
    default:
      throw new WnError('USAGE_ERROR', `Unknown platform: ${raw}`, { exitCode: ExitCode.UsageError });
  }
}

async function runNativeGet(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const state = await getCapacitorProjectState(project.projectFolder());
  if (!state) {
    throw new WnError('PLATFORM_NOT_ADDED', 'No native iOS or Android project found', {
      exitCode: ExitCode.CommandFailed,
      hint: 'Run wn native add ios|android',
    });
  }
  return {
    ios: state.iosBundleId
      ? {
          appId: state.iosBundleId,
          appName: state.iosDisplayName,
          version: state.iosVersion,
          build: state.iosBuild,
        }
      : undefined,
    android: state.androidBundleId
      ? {
          appId: state.androidBundleId,
          appName: state.androidDisplayName,
          version: state.androidVersion,
          build: state.androidBuild,
        }
      : undefined,
  };
}

async function runNativeSet(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const property = positional(ctx, 0);
  const value = positional(ctx, 1);
  const platform = parsePlatform(flagString(ctx.args.flags, 'platform'));

  if (!property || value === undefined) {
    throw new WnError('USAGE_ERROR', 'Usage: wn native set <property> <value> [--platform ios|android]', {
      exitCode: ExitCode.UsageError,
    });
  }

  const folder = project.projectFolder();
  switch (property) {
    case 'app-id': {
      const err = validateBundleId(value);
      if (err) throw new WnError('INVALID_VALUE', err, { exitCode: ExitCode.UsageError });
      if (!ctx.opts.dryRun) await setBundleId(folder, value, platform);
      break;
    }
    case 'app-name':
      if (!ctx.opts.dryRun) await setDisplayName(folder, value, platform);
      break;
    case 'version': {
      const err = validateVersion(value);
      if (err) throw new WnError('INVALID_VALUE', err, { exitCode: ExitCode.UsageError });
      if (!ctx.opts.dryRun) await setVersion(folder, value, platform);
      break;
    }
    case 'build': {
      const err = validateBuild(value);
      if (err) throw new WnError('INVALID_VALUE', err, { exitCode: ExitCode.UsageError });
      if (!ctx.opts.dryRun) await setBuild(folder, value, platform);
      break;
    }
    default:
      throw new WnError('USAGE_ERROR', `Unknown property: ${property}`, {
        exitCode: ExitCode.UsageError,
        hint: 'Properties: app-id, app-name, version, build',
      });
  }

  return { property, value, platform: platform ?? 'both' };
}

async function runNativeAdd(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const platformRaw = positional(ctx, 0);
  if (!platformRaw) {
    throw new WnError('USAGE_ERROR', 'Usage: wn native add <ios|android>', { exitCode: ExitCode.UsageError });
  }
  const platform = platformRaw.toLowerCase() as CapacitorPlatform;
  if (platform !== CapacitorPlatform.ios && platform !== CapacitorPlatform.android) {
    throw new WnError('USAGE_ERROR', 'Platform must be ios or android', { exitCode: ExitCode.UsageError });
  }
  await runCommandResult(ctx, capacitorAdd(project, platform));
  return { platform, added: true };
}

async function runNativePrivacyCheck(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const result = await checkPrivacyManifest(project.projectFolder(), (plugin) => project.analyzer.exists(plugin));
  return result;
}

async function runNativePrivacyAdd(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const check = await checkPrivacyManifest(project.projectFolder(), (plugin) => project.analyzer.exists(plugin));
  const reasons = flagString(ctx.args.flags, 'reason')?.split(',') ?? [];

  if (check.needsCreation) {
    if (ctx.opts.dryRun) {
      return { created: true, dryRun: true };
    }
    const created = await createPrivacyManifest(project.projectFolder());
    if (!created.success) {
      throw new WnError('WRITE_FAILED', created.error ?? 'Unable to create privacy manifest', {
        exitCode: ExitCode.CommandFailed,
      });
    }
  }

  const manifestPath = check.manifestPath;
  if (!manifestPath && !check.needsCreation) {
    throw new WnError('WRITE_FAILED', check.error ?? 'Privacy manifest not available', {
      exitCode: ExitCode.CommandFailed,
    });
  }

  const path = manifestPath ?? (await createPrivacyManifest(project.projectFolder())).path;
  if (!path) {
    throw new WnError('WRITE_FAILED', 'Privacy manifest path not found', { exitCode: ExitCode.CommandFailed });
  }

  const applied: Array<{ category: string; reason: string }> = [];
  if (!ctx.opts.dryRun) {
    for (const missing of check.missingCategories) {
      const reason = reasons[0] ?? missing.reasons[0];
      if (reason) {
        setPrivacyCategory(path, missing.api, reason);
        applied.push({ category: missing.api, reason });
      }
    }
    if (reasons.length && check.apisUsed.length) {
      for (const api of check.apisUsed) {
        for (const reason of reasons) {
          setPrivacyCategory(path, api.api, reason);
          applied.push({ category: api.api, reason });
        }
      }
    }
  }

  return { path, applied, check };
}

async function runNativePrivacy(ctx: CliContext): Promise<unknown> {
  const action = positional(ctx, 1);
  switch (action) {
    case 'check':
      return runNativePrivacyCheck(ctx);
    case 'add':
      return runNativePrivacyAdd(ctx);
    default:
      throw new WnError('USAGE_ERROR', 'Usage: wn native privacy <check|add>', { exitCode: ExitCode.UsageError });
  }
}

async function runNative(ctx: CliContext): Promise<unknown> {
  const sub = positional(ctx, 0);
  switch (sub) {
    case 'get':
      return runNativeGet(ctx);
    case 'set':
      return runNativeSet(ctx);
    case 'add':
      return runNativeAdd(ctx);
    case 'privacy':
      return runNativePrivacy(ctx);
    default:
      throw new WnError('USAGE_ERROR', 'Usage: wn native <get|set|add|privacy>', { exitCode: ExitCode.UsageError });
  }
}

export function registerNativeCommand(): void {
  registerCommand({
    name: 'native',
    description: 'Read and write native project settings',
    run: runNative,
  });
  registerCommand({
    name: 'native privacy check',
    description: 'Check iOS privacy manifest requirements',
    run: runNativePrivacyCheck,
  });
  registerCommand({
    name: 'native privacy add',
    description: 'Create or update iOS privacy manifest',
    run: runNativePrivacyAdd,
  });
}
