import { registerCommand } from '../cli/registry';
import { flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { capacitorOpen } from '../build/capacitor-open';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { CliContext } from '../core/context';
import { ensureProject, runCommandResult, usageError } from './helpers';
import { join } from 'path';
import { spawn } from 'child_process';

async function runOpen(ctx: CliContext): Promise<unknown> {
  const target = ctx.args.positionals[0];
  if (!target) throw usageError('Usage: wn open <xcode|android-studio|browser|folder>');

  if (target === 'browser') {
    const url = flagString(ctx.args.flags, 'url') || 'http://localhost:8100';
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
    return { opened: url };
  }

  if (target === 'folder') {
    const which = ctx.args.positionals[1] || 'www';
    const project = await ensureProject(ctx);
    const folder = join(project.projectFolder(), which);
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    spawn(opener, [folder], { detached: true, stdio: 'ignore' }).unref();
    return { opened: folder };
  }

  const project = await ensureProject(ctx);
  let platform: CapacitorPlatform;
  if (target === 'xcode' || target === 'ios') platform = CapacitorPlatform.ios;
  else if (target === 'android-studio' || target === 'android') platform = CapacitorPlatform.android;
  else throw usageError(`Unknown open target: ${target}`);

  if (!project.hasCapacitorProject(platform)) {
    throw new WnError('PLATFORM_NOT_ADDED', `Platform ${platform} is not added`, {
      exitCode: ExitCode.CommandFailed,
    });
  }

  await runCommandResult(ctx, capacitorOpen(project, platform));
  return { opened: platform };
}

registerCommand({
  name: 'open',
  description: 'Open project in Xcode, Android Studio, browser, or folder',
  run: runOpen,
});
