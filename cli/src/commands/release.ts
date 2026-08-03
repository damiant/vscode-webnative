import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { registerCommand } from '../cli/registry';
import {
  capacitorBuildCommand,
  isCapBuildSupported,
  KeyStoreSettings,
  listCapBuildTargets,
  readKeyStoreSettings,
  selectionToPlatformAndArgs,
  writeKeyStoreConfig,
} from '../build/capacitor-build';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { ensureProject, positional, runCommandResult } from './helpers';
import { CliContext } from '../core/context';

function readKeystoreFromEnv(): KeyStoreSettings {
  return {
    keyStorePath: process.env.WN_KEYSTORE_PATH,
    keyStorePassword: process.env.WN_KEYSTORE_PASSWORD,
    keyAlias: process.env.WN_KEYSTORE_ALIAS,
    keyPassword: process.env.WN_KEYSTORE_ALIAS_PASSWORD,
  };
}

function readKeystoreFromFlags(ctx: CliContext): KeyStoreSettings {
  return {
    keyStorePath: flagString(ctx.args.flags, 'keystore') ?? flagString(ctx.args.flags, 'keystore-path'),
    keyStorePassword: flagString(ctx.args.flags, 'keystore-password'),
    keyAlias: flagString(ctx.args.flags, 'keystore-alias'),
    keyPassword: flagString(ctx.args.flags, 'keystore-alias-password'),
  };
}

function mergeKeystoreSettings(project: Awaited<ReturnType<typeof ensureProject>>, ctx: CliContext): KeyStoreSettings {
  const fromConfig = readKeyStoreSettings(project);
  const fromEnv = readKeystoreFromEnv();
  const fromFlags = readKeystoreFromFlags(ctx);
  return {
    signingType: fromFlags.signingType ?? fromConfig.signingType,
    keyStorePath: fromFlags.keyStorePath ?? fromEnv.keyStorePath ?? fromConfig.keyStorePath,
    keyStorePassword: fromFlags.keyStorePassword ?? fromEnv.keyStorePassword ?? fromConfig.keyStorePassword,
    keyAlias: fromFlags.keyAlias ?? fromEnv.keyAlias ?? fromConfig.keyAlias,
    keyPassword: fromFlags.keyPassword ?? fromEnv.keyPassword ?? fromConfig.keyPassword,
  };
}

function redactSecrets(settings: KeyStoreSettings): string[] {
  return [settings.keyStorePassword, settings.keyPassword].filter(Boolean) as string[];
}

async function runReleaseAndroid(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  if (!isCapBuildSupported(project)) {
    throw new WnError('PRECONDITION_FAILED', '@capacitor/cli 4.4.0+ is required for cap build', {
      exitCode: ExitCode.CommandFailed,
    });
  }
  if (!project.hasCapacitorProject(CapacitorPlatform.android)) {
    throw new WnError('PLATFORM_NOT_ADDED', 'Android platform is not added', { exitCode: ExitCode.CommandFailed });
  }

  const type = (flagString(ctx.args.flags, 'type') ?? 'aab').toLowerCase();
  const selection = type === 'apk' ? 'android-apk' : 'android-aab';
  const { platform, args } = selectionToPlatformAndArgs(selection);
  const settings = mergeKeystoreSettings(project, ctx);

  if (!settings.keyStorePath || !settings.keyStorePassword || !settings.keyAlias || !settings.keyPassword) {
    throw new WnError('MISSING_INPUT', 'Android signing credentials are required', {
      exitCode: ExitCode.MissingInput,
      hint: 'Pass --keystore flags or set WN_KEYSTORE_* environment variables',
    });
  }

  if (flagBool(ctx.args.flags, 'save-config') && !ctx.opts.dryRun) {
    writeKeyStoreConfig(project, settings);
  }

  const result = capacitorBuildCommand(project, platform, args, settings);
  await runCommandResult(ctx, result, redactSecrets(settings));
  return { platform: 'android', type, settings: { ...settings, keyStorePassword: '***', keyPassword: '***' } };
}

async function runReleaseIos(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  if (!isCapBuildSupported(project)) {
    throw new WnError('PRECONDITION_FAILED', '@capacitor/cli 4.4.0+ is required for cap build', {
      exitCode: ExitCode.CommandFailed,
    });
  }
  if (!project.hasCapacitorProject(CapacitorPlatform.ios)) {
    throw new WnError('PLATFORM_NOT_ADDED', 'iOS platform is not added', { exitCode: ExitCode.CommandFailed });
  }

  const { platform, args } = selectionToPlatformAndArgs('ios-ipa');
  const configArg = flagString(ctx.args.flags, 'config');
  const extraArgs = configArg ? `${args} --configuration=${configArg}` : args;
  const result = capacitorBuildCommand(project, platform, extraArgs, {});
  await runCommandResult(ctx, result);
  return { platform: 'ios', type: 'ipa' };
}

async function runRelease(ctx: CliContext): Promise<unknown> {
  const platform = positional(ctx, 0);
  if (!platform) {
    const project = await ensureProject(ctx);
    return {
      targets: listCapBuildTargets(project),
      hint: 'Usage: wn release ios|android',
    };
  }

  switch (platform.toLowerCase()) {
    case 'android':
      return runReleaseAndroid(ctx);
    case 'ios':
      return runReleaseIos(ctx);
    default:
      throw new WnError('USAGE_ERROR', 'Usage: wn release <ios|android>', { exitCode: ExitCode.UsageError });
  }
}

export function registerReleaseCommand(): void {
  registerCommand({
    name: 'release',
    description: 'Produce a signed native release build',
    run: runRelease,
  });
}
