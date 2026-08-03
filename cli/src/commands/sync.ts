import { registerCommand } from '../cli/registry';
import { flagBool } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { capacitorSync } from '../build/capacitor-sync';
import { build as buildCommand } from '../build/build';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { CliContext } from '../core/context';
import { ensureProject, runCommandResult } from './helpers';

async function runSync(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  if (!project.isCapacitor) {
    throw new WnError('PLATFORM_NOT_ADDED', 'Not a Capacitor project', { exitCode: ExitCode.CommandFailed });
  }

  const platformArg = ctx.args.positionals[0];
  const noBuild = flagBool(ctx.args.flags, 'no-build');

  if (!noBuild) {
    let platform: CapacitorPlatform | undefined;
    if (platformArg === 'ios') platform = CapacitorPlatform.ios;
    if (platformArg === 'android') platform = CapacitorPlatform.android;
    await runCommandResult(ctx, buildCommand(project, { platform }));
  }

  await runCommandResult(ctx, capacitorSync(project));
  return { synced: platformArg || 'all' };
}

registerCommand({
  name: 'sync',
  description: 'Run cap sync (copy web assets and update native deps)',
  run: runSync,
});
