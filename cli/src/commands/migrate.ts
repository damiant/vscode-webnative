import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { registerCommand } from '../cli/registry';
import {
  applyAngularPostFixes,
  ensureValidDependencies,
  planAngularMigration,
  resolveAngularTarget,
} from '../migrate/angular';
import {
  checkMigrationPreconditions,
  listAllMigrations,
  planCapacitorMigration,
  resolveCapacitorMigration,
  runCapacitorMigration,
} from '../migrate/capacitor';
import { planCordovaMigration, planCordovaRemoval } from '../migrate/cordova';
import { planPackageManagerMigration, TargetPackageManager } from '../migrate/package-manager';
import { planSpmMigration } from '../migrate/spm';
import { npmInstallAll } from '../build/node-commands';
import { commandContext } from '../build/node-commands';
import { InternalCommand } from '../build/command-name';
import { isGitDirty, requireCleanGit, requireProject, runProjectCommand } from './helpers';
import { CliContext } from '../core/context';

function runCallback(ctx: CliContext) {
  return (command: string, folder: string) => ctx.exec.getOutput({ command, cwd: folder }, { ignoreExitCode: true });
}

async function migrateList(ctx: CliContext) {
  const project = await requireProject(ctx);
  return { migrations: listAllMigrations(project) };
}

async function migrateCapacitorCmd(ctx: CliContext) {
  const project = await requireProject(ctx);
  if (!project.isCapacitor) {
    throw new WnError('NOT_APPLICABLE', 'Capacitor migration requires a Capacitor project.', {
      exitCode: ExitCode.CommandFailed,
    });
  }

  const options = resolveCapacitorMigration(project, flagString(ctx.args.flags, 'to'));
  const warnings = await checkMigrationPreconditions(project, options);
  ctx.warnings.push(...warnings);

  const plan = await planCapacitorMigration(project, options, runCallback(ctx));
  if (ctx.opts.dryRun) return { ...plan, target: options.versionTitle, changesLink: options.changesLink };

  if (!ctx.opts.yes) {
    const dirty = await isGitDirty(project.folder, ctx);
    requireCleanGit(project.folder, dirty);
  }

  if (plan.incompatible.length > 0 && !ctx.opts.yes) {
    throw new WnError('PRECONDITION_FAILED', `Incompatible plugins: ${plan.incompatible.join(', ')}`, {
      exitCode: ExitCode.CheckFailed,
      details: { incompatible: plan.incompatible },
      hint: 'Re-run with --yes to continue anyway',
    });
  }

  const folder = project.projectFolder();
  const runInProject = (command: string) =>
    ctx.exec.getOutput({ command: command.replace(InternalCommand.cwd, ''), cwd: folder }, { ignoreExitCode: true });

  const result = await runCapacitorMigration(project, plan, (cmd) => runInProject(cmd));
  return { target: options.versionTitle, ...result, changesLink: options.changesLink };
}

async function migrateAngularCmd(ctx: CliContext) {
  const project = await requireProject(ctx);
  const dirty = await isGitDirty(project.folder, ctx);
  requireCleanGit(project.folder, dirty);

  const target = resolveAngularTarget(project, flagString(ctx.args.flags, 'to'), flagBool(ctx.args.flags, 'all'));
  const current = project.analyzer.getPackageVersion('@angular/core')!.major;
  const commands: string[] = [];

  for (let v = current + 1; v <= target; v++) {
    commands.push(...planAngularMigration(project, v).commands);
  }

  if (ctx.opts.dryRun) return { commands, from: current, to: target };

  await ensureValidDependencies(project, runCallback(ctx), async () => {
    await runProjectCommand(ctx, `${InternalCommand.cwd}${npmInstallAll(commandContext(project))}`);
  });

  for (const command of commands) {
    await runProjectCommand(ctx, command);
  }

  const postFixes: string[] = [];
  for (let v = current + 1; v <= target; v++) {
    postFixes.push(...applyAngularPostFixes(project, v));
  }
  return { from: current, to: target, postFixes };
}

async function migrateCordovaCmd(ctx: CliContext) {
  const project = await requireProject(ctx);
  const remove = flagBool(ctx.args.flags, 'remove');
  const plan = remove ? planCordovaRemoval(project) : planCordovaMigration(project);
  const commands = remove ? (plan.remove ?? []) : plan.integrate;

  if (ctx.opts.dryRun) return { ...plan, commands };

  if (!remove) {
    const dirty = await isGitDirty(project.folder, ctx);
    requireCleanGit(project.folder, dirty);
  }

  for (const command of commands) {
    await runProjectCommand(ctx, command);
  }
  return { completed: remove ? 'remove' : 'integrate', notes: plan.notes };
}

async function migrateSpmCmd(ctx: CliContext) {
  const project = await requireProject(ctx);
  const plan = planSpmMigration(project);
  if (ctx.opts.dryRun) return plan;
  await runProjectCommand(ctx, plan.command);
  return { started: true, docs: plan.docs };
}

async function migratePackageManagerCmd(ctx: CliContext) {
  const project = await requireProject(ctx);
  const target = (ctx.args.positionals[0] ?? flagString(ctx.args.flags, 'to')) as TargetPackageManager;
  if (!target) {
    throw new WnError('MISSING_INPUT', 'Target package manager is required.', {
      exitCode: ExitCode.MissingInput,
      choices: [{ id: 'pnpm' }, { id: 'bun' }, { id: 'npm' }, { id: 'yarn' }],
      hint: 'wn migrate package-manager <npm|pnpm|yarn|bun>',
    });
  }
  const plan = planPackageManagerMigration(project, target);
  if (ctx.opts.dryRun) return plan;
  const dirty = await isGitDirty(project.folder, ctx);
  requireCleanGit(project.folder, dirty);
  for (const command of plan.commands) {
    await runProjectCommand(ctx, command);
  }
  return { target: plan.target, completed: true };
}

async function migrateRoot(ctx: CliContext) {
  return migrateList(ctx);
}

function register(name: string, description: string, run: (ctx: CliContext) => Promise<unknown>) {
  registerCommand({ name, description, run });
}

register('migrate', 'Project migrations', migrateRoot);
register('migrate list', 'List available migrations', migrateList);
register('migrate capacitor', 'Migrate Capacitor to the next major version', migrateCapacitorCmd);
register('migrate angular', 'Migrate Angular to a newer major version', migrateAngularCmd);
register('migrate cordova', 'Convert or remove Cordova integration', migrateCordovaCmd);
register('migrate spm', 'Migrate iOS from CocoaPods to SPM', migrateSpmCmd);
register('migrate package-manager', 'Convert package manager', migratePackageManagerCmd);
