import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { registerCommand } from '../cli/registry';
import { parseAuditOutput, filterBySeverity } from '../packages/audit';
import { exportProjectSummary, packagesForExport } from '../packages/export';
import { listPackages } from '../packages/list';
import { applyMinorUpdates, findMinorUpdates, installCommand, packagesFromProject } from '../packages/minor';
import {
  addPackageCommand,
  buildUpgradeSpec,
  installAllCommand,
  removePackageCommand,
  updateAllCommand,
  upgradePackageCommand,
} from '../packages/mutate';
import { checkPeerDependencies } from '../packages/peer-dependencies';
import { analyzeBundleSize } from '../packages/size';
import { maybeCapSync, requireProject, runProjectCommand } from './helpers';
import { CliContext } from '../core/context';

function runCallback(ctx: CliContext) {
  return (command: string, folder: string) => ctx.exec.getOutput({ command, cwd: folder }, { ignoreExitCode: true });
}

async function packagesList(ctx: CliContext) {
  const project = await requireProject(ctx);
  const data = await listPackages(project, runCallback(ctx), {
    outdated: flagBool(ctx.args.flags, 'outdated'),
    plugins: flagBool(ctx.args.flags, 'plugins'),
  });
  return data;
}

async function packagesAdd(ctx: CliContext) {
  const project = await requireProject(ctx);
  const name = ctx.args.positionals[0];
  if (!name) {
    throw new WnError('MISSING_INPUT', 'Package name is required.', {
      exitCode: ExitCode.MissingInput,
      input: 'package',
      hint: 'wn packages add <name>',
    });
  }
  const cmd = addPackageCommand(project, name, { dev: flagBool(ctx.args.flags, 'dev') });
  if (ctx.opts.dryRun) return { command: cmd };
  await runProjectCommand(ctx, cmd);
  await maybeCapSync(ctx, project);
  return { installed: name };
}

async function packagesRemove(ctx: CliContext) {
  const project = await requireProject(ctx);
  const name = ctx.args.positionals[0];
  if (!name) {
    throw new WnError('MISSING_INPUT', 'Package name is required.', {
      exitCode: ExitCode.MissingInput,
      hint: 'wn packages remove <name>',
    });
  }
  const cmd = removePackageCommand(project, name);
  if (ctx.opts.dryRun) return { command: cmd };
  await runProjectCommand(ctx, cmd);
  await maybeCapSync(ctx, project);
  return { removed: name };
}

async function packagesUpgrade(ctx: CliContext) {
  const project = await requireProject(ctx);
  const all = flagBool(ctx.args.flags, 'all');
  const latest = flagBool(ctx.args.flags, 'latest');
  const version = flagString(ctx.args.flags, 'version');
  const name = ctx.args.positionals[0];

  if (all) {
    const cmd = updateAllCommand(project);
    if (ctx.opts.dryRun) return { command: cmd };
    await runProjectCommand(ctx, cmd);
    await maybeCapSync(ctx, project);
    return { upgraded: 'all' };
  }

  if (!name) {
    throw new WnError('MISSING_INPUT', 'Package name is required unless using --all.', {
      exitCode: ExitCode.MissingInput,
      hint: 'wn packages upgrade <name> [--version <v>] [--latest]',
    });
  }

  const spec = buildUpgradeSpec(name, version, latest);
  const cmd = upgradePackageCommand(project, spec, { force: true });
  if (ctx.opts.dryRun) return { command: cmd, spec };
  await runProjectCommand(ctx, cmd);
  await maybeCapSync(ctx, project);
  return { upgraded: spec };
}

async function packagesMinor(ctx: CliContext) {
  const project = await requireProject(ctx);
  const packages = packagesFromProject(project);
  const updates = await findMinorUpdates(project, packages, runCallback(ctx));
  if (!flagBool(ctx.args.flags, 'apply')) return { updates, count: updates.length };
  if (updates.length === 0) return { updates: [], applied: [] };
  const install = async (spec: string) => runProjectCommand(ctx, installCommand(project, spec));
  const result = await applyMinorUpdates(project, updates, install);
  await maybeCapSync(ctx, project);
  return { updates, ...result };
}

async function packagesAudit(ctx: CliContext) {
  const project = await requireProject(ctx);
  const folder = project.projectFolder();
  const fix = flagBool(ctx.args.flags, 'fix');
  const cmd = fix ? 'npm audit fix' : 'npm audit --json';
  if (ctx.opts.dryRun) return { command: cmd, cwd: folder };
  const output = await ctx.exec.getOutput({ command: cmd, cwd: folder }, { ignoreExitCode: !fix });
  if (fix) return { fixed: true, output };
  const deps = project.analyzer.getAllPackageNames();
  const audit = parseAuditOutput(output, deps);
  const severity = flagString(ctx.args.flags, 'severity');
  audit.vulnerabilities = filterBySeverity(audit.vulnerabilities, severity);
  return audit;
}

async function packagesPeers(ctx: CliContext) {
  const project = await requireProject(ctx);
  const coreVersion = project.analyzer.getPackageVersion('@capacitor/core')?.version ?? 'latest';
  const report = await checkPeerDependencies(
    project.projectFolder(),
    project,
    [{ name: '@capacitor/core', version: coreVersion }],
    [],
    runCallback(ctx),
  );
  if (flagBool(ctx.args.flags, 'fix') && report.commands.length > 0) {
    if (ctx.opts.dryRun) return { ...report, dryRun: true };
    for (const command of report.commands) await runProjectCommand(ctx, command);
    await maybeCapSync(ctx, project);
  }
  return report;
}

async function packagesInstall(ctx: CliContext) {
  const project = await requireProject(ctx);
  const cmd = installAllCommand(project, { frozenLockfile: flagBool(ctx.args.flags, 'frozen-lockfile') });
  if (ctx.opts.dryRun) return { command: cmd };
  await runProjectCommand(ctx, cmd);
  return { installed: true };
}

async function packagesSize(ctx: CliContext) {
  const project = await requireProject(ctx);
  const run = (command: string, cwd: string) => ctx.exec.getOutput({ command, cwd });
  if (ctx.opts.dryRun) {
    return { note: 'Production build and source-map-explorer analysis', dist: project.getDistFolder() };
  }
  return analyzeBundleSize(project, run);
}

async function packagesExport(ctx: CliContext) {
  const project = await requireProject(ctx);
  const packages = packagesForExport(project);
  if (ctx.opts.dryRun) return { packages: Object.keys(packages), filename: 'project-summary.md' };
  return exportProjectSummary(project, packages);
}

function register(name: string, description: string, run: (ctx: CliContext) => Promise<unknown>) {
  registerCommand({ name, description, run });
}

register('packages', 'Manage project dependencies', packagesList);
register('packages list', 'List packages with version info', packagesList);
register('packages add', 'Add a dependency', packagesAdd);
register('packages remove', 'Remove a dependency', packagesRemove);
register('packages upgrade', 'Upgrade dependencies', packagesUpgrade);
register('packages minor', 'Find or apply minor/patch updates', packagesMinor);
register('packages audit', 'Audit dependencies for vulnerabilities', packagesAudit);
register('packages peers', 'Check peer dependency compatibility', packagesPeers);
register('packages install', 'Install all dependencies', packagesInstall);
register('packages size', 'Analyze production bundle sizes', packagesSize);
register('packages export', 'Export project-summary.md', packagesExport);
