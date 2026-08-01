import { existsSync } from 'fs';
import { join, sep } from 'path';
import { flagBool } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { confirm } from '../cli/prompt';
import { registerCommand } from '../cli/registry';
import { commandContext, npmInstall, npx } from '../build/node-commands';
import { replaceAll } from '../core/text';
import { getStringFrom } from '../project/utilities-strings';
import { CliContext } from '../core/context';
import { ensureProject, positional, runCommandSequence, runShell } from './helpers';

export interface AngularMigration {
  id: string;
  title: string;
  minimumVersion: string;
  description: string;
  command?: string;
  commandFn?: (ctx: CliContext) => Promise<void>;
}

export const angularMigrations: AngularMigration[] = [
  {
    id: 'standalone-ionic',
    title: 'Migrate to Ionic standalone components',
    minimumVersion: '14.0.0',
    description:
      'This will replace IonicModule with individual Ionic components and icons in your project. Are you sure?',
    commandFn: migrateToAngularStandalone,
  },
  {
    id: 'signal-inputs',
    title: 'Migrate to signal inputs',
    minimumVersion: '19.0.0',
    description: 'This will change your @Input decorators to Signal Inputs. Are you sure?',
    command: `npx ng generate @angular/core:signal-input-migration --interactive=false --defaults=true --path=".${sep}"`,
  },
  {
    id: 'control-flow',
    title: 'Migrate to the built-in control flow syntax',
    minimumVersion: '17.0.0',
    description: 'This will change your Angular templates to use the new built-in control flow syntax. Are you sure?',
    command: `npx ng generate @angular/core:control-flow --interactive=false --defaults=true --path=".${sep}"`,
  },
  {
    id: 'output-migration',
    title: 'Migrate to replace @Output with Output functions',
    minimumVersion: '19.0.0',
    description: 'This will replace your @Output decorators with Output functions. Are you sure?',
    command: `npx ng generate @angular/core:output-migration --interactive=false --defaults=true --path=".${sep}"`,
  },
  {
    id: 'inject',
    title: 'Migrate to use inject for dependency injection',
    minimumVersion: '19.0.0',
    description: 'This will replace dependency injection to use the inject function. Are you sure?',
    command: `npx ng generate @angular/core:inject --interactive=false --defaults=true --path=".${sep}"`,
  },
  {
    id: 'signal-queries',
    title: 'Migrate ViewChild and ContentChild to use signals',
    minimumVersion: '19.0.0',
    description:
      'This will replace @ViewChild and @ContentChild decorators with the equivalent signal query. Are you sure?',
    command: `npx ng generate @angular/core:signal-queries --interactive=false --defaults=true --path=".${sep}"`,
  },
  {
    id: 'karma-to-vitest',
    title: 'Migrate Karma to Vitest',
    minimumVersion: '22.0.0',
    description: 'This will migrate your Karma test configuration to Vitest. Are you sure?',
    command: 'ng update @angular/cli --name migrate-karma-to-vitest',
  },
  {
    id: 'application-builder',
    title: 'Migrate to Use Application Builder',
    minimumVersion: '22.0.0',
    description: 'This will migrate your project to use the application builder. Are you sure?',
    command: 'ng update @angular/cli --name use-application-builder',
  },
];

const angularSchematics = ['component', 'service', 'module', 'class', 'directive', 'pipe', 'guard', 'interceptor'];

function qualifyAngularCommand(
  command: string,
  project: { analyzer: { exists: (lib: string) => boolean } } & Parameters<typeof npx>[0],
): string {
  if (command.startsWith('npx ')) {
    return command.replace('npx ', `${npx(project)} `);
  }
  if (command.startsWith('ng ')) {
    return `${npx(project)} ${command}`;
  }
  return command;
}

async function migrateToAngularStandalone(ctx: CliContext): Promise<void> {
  const project = await ensureProject(ctx);
  const ctxPm = commandContext(project);
  const commands = ['npx @ionic/angular-standalone-codemods --non-interactive'];
  if (project.analyzer.isGreaterOrEqual('@ionic/angular', '7.0.0')) {
    if (project.analyzer.isLess('@ionic/angular', '7.5.1')) {
      commands.unshift(npmInstall('@ionic/angular@7.5.1', ctxPm));
    }
  } else {
    throw new WnError('PRECONDITION_FAILED', 'You must be using @ionic/angular version 7 or higher.', {
      exitCode: ExitCode.CommandFailed,
    });
  }
  if (project.analyzer.isLess('ionicons', '7.2.1')) {
    commands.unshift(npmInstall('ionicons@latest', ctxPm));
  }
  await runCommandSequence(ctx, commands, project.projectFolder());
}

function listAvailableSchematics(project: Awaited<ReturnType<typeof ensureProject>>): string[] {
  const types = [...angularSchematics];
  if (project.analyzer.exists('@ionic/angular-toolkit')) {
    types.push('page');
  }
  return types;
}

function listAvailableMigrations(project: Awaited<ReturnType<typeof ensureProject>>): AngularMigration[] {
  return angularMigrations.filter((m) => project.analyzer.isGreaterOrEqual('@angular/core', m.minimumVersion));
}

async function runAngularGenerate(ctx: CliContext, angularType: string, name: string): Promise<unknown> {
  const project = await ensureProject(ctx);
  if (!project.analyzer.exists('@angular/core')) {
    throw new WnError('NOT_ANGULAR', 'This project is not an Angular project', { exitCode: ExitCode.CommandFailed });
  }

  let args = '';
  if (project.analyzer.isGreaterOrEqual('@angular/core', '15.0.0')) {
    const isOlder =
      project.analyzer.exists('@ionic/angular-toolkit') &&
      project.analyzer.isLessOrEqual('@ionic/angular-toolkit', '8.1.0');
    if (angularType == 'page' && !isOlder) {
      args += ' --standalone';
    }
    const isOld =
      project.analyzer.exists('@ionic/angular-toolkit') &&
      project.analyzer.isLessOrEqual('@ionic/angular-toolkit', '11.0.1');
    if (angularType == 'component' && !isOld) {
      args += ' --standalone';
    }
  }

  const normalizedName = replaceAll(name, ' ', '-').trim();
  let cmd = `${npx(project)} ng generate ${angularType} ${normalizedName}${args}`;
  if (angularType == 'directive') {
    cmd += ` --skip-import`;
  }

  if (ctx.args.passthrough.length) {
    cmd += ' ' + ctx.args.passthrough.join(' ');
  }

  ctx.logger.writeWN(`Creating Angular ${angularType} named ${normalizedName}..`);
  const out = await ctx.exec.getOutput({ command: cmd, cwd: project.projectFolder() });
  const src = getStringFrom(out, 'CREATE ', '.ts');
  const path = join(project.projectFolder(), src + '.ts');
  const created = !!(src && existsSync(path));

  return {
    schematic: angularType,
    name: normalizedName,
    created,
    output: out,
    path: created ? path : undefined,
  };
}

async function runMigration(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const migrationId = positional(ctx, 1);

  if (flagBool(ctx.args.flags, 'list') || !migrationId) {
    return {
      migrations: listAvailableMigrations(project).map((m) => ({
        id: m.id,
        title: m.title,
        minimumVersion: m.minimumVersion,
        description: m.description,
      })),
    };
  }

  const migration = angularMigrations.find((m) => m.id === migrationId);
  if (!migration) {
    throw new WnError('UNKNOWN_SCHEMATIC', `Unknown migration: ${migrationId}`, {
      exitCode: ExitCode.UsageError,
      choices: listAvailableMigrations(project).map((m) => ({ id: m.id, name: m.title })),
    });
  }

  if (!project.analyzer.isGreaterOrEqual('@angular/core', migration.minimumVersion)) {
    throw new WnError('PRECONDITION_FAILED', `@angular/core ${migration.minimumVersion}+ is required`, {
      exitCode: ExitCode.CommandFailed,
    });
  }

  if (!ctx.opts.dryRun && !ctx.opts.yes && !ctx.opts.noInput && !ctx.opts.json) {
    const ok = await confirm(migration.description, ctx.opts, false);
    if (!ok) return { cancelled: true };
  }

  if (migration.commandFn) {
    await migration.commandFn(ctx);
  } else if (migration.command) {
    const cmd = qualifyAngularCommand(migration.command, project);
    await runShell(ctx, { command: cmd, cwd: project.projectFolder() });
  }

  return { migration: migration.id, applied: true };
}

async function runGenerate(ctx: CliContext): Promise<unknown> {
  const sub = positional(ctx, 0);

  if (flagBool(ctx.args.flags, 'list') || !sub) {
    const project = await ensureProject(ctx);
    return { schematics: listAvailableSchematics(project) };
  }

  if (sub === 'migration') {
    return runMigration(ctx);
  }

  const name = positional(ctx, 1);
  if (!name) {
    throw new WnError('MISSING_INPUT', `Name is required for generate ${sub}`, {
      exitCode: ExitCode.MissingInput,
      input: 'name',
    });
  }

  const project = await ensureProject(ctx);
  const available = listAvailableSchematics(project);
  if (!available.includes(sub)) {
    throw new WnError('UNKNOWN_SCHEMATIC', `Unknown schematic: ${sub}`, {
      exitCode: ExitCode.UsageError,
      choices: available.map((s) => ({ id: s, name: s })),
    });
  }

  return runAngularGenerate(ctx, sub, name);
}

export function registerGenerateCommand(): void {
  registerCommand({
    name: 'generate',
    description: 'Generate Angular schematics or run codemod migrations',
    run: runGenerate,
  });
  registerCommand({
    name: 'generate migration',
    description: 'Run Angular codemod migrations',
    run: runMigration,
  });
}
