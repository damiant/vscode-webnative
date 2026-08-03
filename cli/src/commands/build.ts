import { registerCommand } from '../cli/registry';
import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { build as buildCommand } from '../build/build';
import { extractErrors } from '../build/error-parsers';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { CliContext } from '../core/context';
import { ensureProject, runCommandResult } from './helpers';

async function runBuild(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const platformArg = ctx.args.positionals[0] || 'web';
  let platform: CapacitorPlatform | undefined;
  if (platformArg === 'ios') platform = CapacitorPlatform.ios;
  else if (platformArg === 'android') platform = CapacitorPlatform.android;
  else if (platformArg === 'all') {
    // build web then copy both — handled by omitting platform for web build and syncing
    platform = undefined;
  } else if (platformArg !== 'web') {
    throw new WnError('USAGE_ERROR', `Unknown platform: ${platformArg}`, { exitCode: ExitCode.UsageError });
  }

  const noCopy = flagBool(ctx.args.flags, 'no-copy');
  const prod = flagBool(ctx.args.flags, 'prod') || ctx.config.buildForProduction;
  const config = flagString(ctx.args.flags, 'config');
  const sourcemap = flagBool(ctx.args.flags, 'sourcemap');

  const result = buildCommand(project, {
    platform: noCopy ? undefined : platform,
    buildForProduction: prod,
    buildConfiguration: config,
    sourceMaps: sourcemap,
    projectName: project.monoRepo?.name,
  });

  const start = Date.now();
  try {
    await runCommandResult(ctx, result);
  } catch (err) {
    const details = err instanceof WnError ? err.details : undefined;
    const output = String(details?.stdout || '') + '\n' + String(details?.stderr || '');
    const parsed = extractErrors(output);
    throw new WnError('BUILD_FAILED', 'Build failed', {
      exitCode: ExitCode.CommandFailed,
      details: {
        errors: parsed.map((e) => ({
          code: 'BUILD_FAILED',
          message: e.message,
          file: e.file,
          line: e.line,
          column: e.column,
        })),
      },
    });
  }

  if (platformArg === 'all' && !noCopy) {
    for (const p of [CapacitorPlatform.ios, CapacitorPlatform.android]) {
      if (project.hasCapacitorProject(p)) {
        const copy = buildCommand(project, { platform: p, buildForProduction: prod, buildConfiguration: config });
        await runCommandResult(ctx, copy);
      }
    }
  }

  return {
    outputDir: project.getDistFolder(),
    durationMs: Date.now() - start,
    platform: platformArg,
  };
}

registerCommand({
  name: 'build',
  description: 'Build the web app (and optionally copy to native)',
  run: runBuild,
});
