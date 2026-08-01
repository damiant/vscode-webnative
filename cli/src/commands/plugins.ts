import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { registerCommand } from '../cli/registry';
import { findBestPluginVersion } from '../packages/peer-dependencies';
import { fetchPluginCatalog } from '../plugins/catalog';
import { getPluginInfo } from '../plugins/info';
import { enterpriseRegisterCommand, hasEnterpriseAuth, planPluginInstall, planPluginRemove } from '../plugins/install';
import { getPluginPermissions } from '../plugins/permissions';
import { searchPlugins } from '../plugins/search';
import { maybeCapSync, requireProject, runProjectCommand } from './helpers';
import { CliContext } from '../core/context';

function runCallback(ctx: CliContext) {
  return (command: string, folder: string) => ctx.exec.getOutput({ command, cwd: folder }, { ignoreExitCode: true });
}

async function pluginsSearch(ctx: CliContext) {
  const query = ctx.args.positionals[0] ?? flagString(ctx.args.flags, 'query');
  if (!query) {
    throw new WnError('MISSING_INPUT', 'Search query is required.', {
      exitCode: ExitCode.MissingInput,
      hint: 'wn plugins search <query>',
    });
  }
  const results = await searchPlugins({
    query,
    platform: flagString(ctx.args.flags, 'platform'),
    official: flagBool(ctx.args.flags, 'official'),
  });
  return { results, count: results.length };
}

async function pluginsInfo(ctx: CliContext) {
  const project = await requireProject(ctx);
  const name = ctx.args.positionals[0];
  if (!name) {
    throw new WnError('MISSING_INPUT', 'Plugin name is required.', {
      exitCode: ExitCode.MissingInput,
      hint: 'wn plugins info <name>',
    });
  }
  let compatibleVersion: string | undefined;
  if (project.isCapacitor) {
    compatibleVersion = await findBestPluginVersion(name, project, runCallback(ctx));
  }
  const info = await getPluginInfo(name, project, runCallback(ctx), compatibleVersion);
  if (!info) {
    throw new WnError('UNKNOWN_PLUGIN', `Plugin or package ${name} was not found on npm.`, {
      exitCode: ExitCode.CommandFailed,
    });
  }
  return info;
}

async function pluginsAdd(ctx: CliContext) {
  const project = await requireProject(ctx);
  const name = ctx.args.positionals[0];
  if (!name) {
    throw new WnError('MISSING_INPUT', 'Plugin name is required.', {
      exitCode: ExitCode.MissingInput,
      hint: 'wn plugins add <name>',
    });
  }
  const version = flagString(ctx.args.flags, 'version');
  const plan = await planPluginInstall(name, project, runCallback(ctx), version);

  if (name.startsWith('@ionic-enterprise/') && !hasEnterpriseAuth(project.projectFolder())) {
    const key = flagString(ctx.args.flags, 'enterprise-key');
    if (!key) {
      throw new WnError('MISSING_INPUT', 'Ionic Enterprise product key required.', {
        exitCode: ExitCode.MissingInput,
        input: 'enterprise-key',
        hint: 'Re-run with --enterprise-key <key>',
      });
    }
    if (ctx.opts.dryRun) return { ...plan, enterprise: enterpriseRegisterCommand(key) };
    await runProjectCommand(ctx, enterpriseRegisterCommand(key));
  }

  if (ctx.opts.dryRun) return plan;
  await runProjectCommand(ctx, plan.install);
  if (plan.sync) await runProjectCommand(ctx, plan.sync);
  return { installed: plan.packageSpec };
}

async function pluginsRemove(ctx: CliContext) {
  const project = await requireProject(ctx);
  const name = ctx.args.positionals[0];
  if (!name) {
    throw new WnError('MISSING_INPUT', 'Plugin name is required.', {
      exitCode: ExitCode.MissingInput,
      hint: 'wn plugins remove <name>',
    });
  }
  const plan = planPluginRemove(name, project, !flagBool(ctx.args.flags, 'no-sync'));
  if (ctx.opts.dryRun) return plan;
  await runProjectCommand(ctx, plan.remove);
  if (plan.sync) await runProjectCommand(ctx, plan.sync);
  return { removed: name };
}

async function pluginsPermissions(ctx: CliContext) {
  const project = await requireProject(ctx);
  return { plugins: getPluginPermissions(project) };
}

async function pluginsRoot(ctx: CliContext) {
  const catalog = await fetchPluginCatalog(flagBool(ctx.args.flags, 'refresh'));
  return { count: catalog.plugins.length };
}

function register(name: string, description: string, run: (ctx: CliContext) => Promise<unknown>) {
  registerCommand({ name, description, run });
}

register('plugins', 'Capacitor plugin catalog', pluginsRoot);
register('plugins search', 'Search the Capacitor plugin directory', pluginsSearch);
register('plugins info', 'Show npm metadata for a plugin', pluginsInfo);
register('plugins add', 'Install a Capacitor plugin', pluginsAdd);
register('plugins remove', 'Remove a Capacitor plugin', pluginsRemove);
register('plugins permissions', 'List Android permissions from plugin.xml', pluginsPermissions);
