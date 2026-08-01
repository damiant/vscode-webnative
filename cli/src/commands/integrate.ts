import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { flagBool, flagString, flagStringArray } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { confirm } from '../cli/prompt';
import { registerCommand } from '../cli/registry';
import { capacitorAdd } from '../build/capacitor-add';
import { InternalCommand } from '../build/command-name';
import { commandContext, npmInstall, npmRun, npx, saveDevArgument } from '../build/node-commands';
import { CliContext } from '../core/context';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { MonoRepoType } from '../project/monorepo';
import { asAppId } from '../templates/new';
import { ensureProject, positional, runCommandResult, runCommandSequence, runShell } from './helpers';

function readAngularOutputPath(projectFolder: string): string | undefined {
  const filename = join(projectFolder, 'angular.json');
  if (!existsSync(filename)) return undefined;
  try {
    const angular = JSON.parse(readFileSync(filename, 'utf8'));
    for (const projectName of Object.keys(angular.projects ?? {})) {
      const outputPath = angular.projects[projectName]?.architect?.build?.options?.outputPath;
      if (outputPath) {
        const browser = join(projectFolder, outputPath, 'browser');
        return existsSync(browser) ? browser : outputPath;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function inferWebDir(projectFolder: string, analyzer: { exists: (lib: string) => boolean }): string {
  if (analyzer.exists('@ionic/angular') || analyzer.exists('ionicons')) {
    if (existsSync(join(projectFolder, 'www'))) return 'www';
  }

  if (!existsSync(join(projectFolder, 'www'))) {
    if (existsSync(join(projectFolder, 'build')) || analyzer.exists('react')) {
      return 'build';
    }
    if (analyzer.exists('@angular/core')) {
      return readAngularOutputPath(projectFolder) ?? 'dist';
    }
    if (existsSync(join(projectFolder, 'dist')) || analyzer.exists('vue')) {
      return 'dist';
    }
  }
  return 'www';
}

async function ionicInit(ctx: CliContext, folder: string): Promise<void> {
  const filename = join(folder, 'package.json');
  const packageFile = JSON.parse(readFileSync(filename, 'utf8'));
  if (!packageFile.name) {
    packageFile.name = 'my-app';
  }
  if (!packageFile.version) {
    packageFile.version = '0.0.0';
  }

  const cfg = join(folder, 'ionic.config.json');
  if (!existsSync(cfg)) {
    await runShell(ctx, { command: `npx ionic init "${packageFile.name}" --type=custom`, cwd: folder });
  }

  if (packageFile.scripts?.build) {
    packageFile.scripts['ionic:build'] = 'npm run build';
    if (ctx.project?.analyzer.exists('@nuxtjs/ionic') && packageFile.scripts?.generate) {
      packageFile.scripts['ionic:build'] = 'npm run generate';
    }
  }
  if (packageFile.scripts?.dev) {
    packageFile.scripts['ionic:serve'] = 'npm run dev';
  }
  if (packageFile.scripts?.serve) {
    packageFile.scripts['ionic:serve'] = 'npm run serve';
  } else if (packageFile.scripts?.start) {
    packageFile.scripts['ionic:serve'] = 'npm run start';
  }
  writeFileSync(filename, JSON.stringify(packageFile, undefined, 2));

  if (existsSync(cfg)) {
    try {
      const ionicConfig = JSON.parse(readFileSync(cfg, 'utf8'));
      ionicConfig.integrations = ionicConfig.integrations ?? {};
      ionicConfig.integrations.capacitor = {};
      writeFileSync(cfg, JSON.stringify(ionicConfig, undefined, 2));
    } catch {
      /* ignore */
    }
  }
}

async function integrateCapacitor(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  if (project.isCapacitor) {
    throw new WnError('ALREADY_INTEGRATED', 'Capacitor is already integrated in this project', {
      exitCode: ExitCode.CommandFailed,
    });
  }

  const appId = flagString(ctx.args.flags, 'app-id') ?? asAppId(project.name);
  const appName = flagString(ctx.args.flags, 'app-name') ?? project.name;
  const webDir = flagString(ctx.args.flags, 'web-dir') ?? inferWebDir(project.projectFolder(), project.analyzer);
  const platformFlags = flagStringArray(ctx.args.flags, 'platforms');
  const platforms =
    platformFlags.length > 0
      ? platformFlags.map((p) => p.toLowerCase() as CapacitorPlatform)
      : [CapacitorPlatform.ios, CapacitorPlatform.android];

  const ctxPm = commandContext(project);
  const pre = project.repoType != MonoRepoType.none ? InternalCommand.cwd : '';
  const commands = [
    npmInstall(`@capacitor/core`, ctxPm),
    npmInstall(`@capacitor/cli`, ctxPm),
    npmInstall(`@capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar`, ctxPm),
    `${pre}${npx(project)} capacitor init "${appName}" "${appId}" --web-dir ${webDir}`,
    InternalCommand.ionicInit,
  ];

  if (!ctx.opts.dryRun && !ctx.opts.yes && !ctx.opts.noInput && !ctx.opts.json) {
    const ok = await confirm(`Integrate Capacitor with webDir "${webDir}"?`, ctx.opts);
    if (!ok) return { cancelled: true };
  }

  for (const cmd of commands) {
    if (cmd === InternalCommand.ionicInit) {
      if (!ctx.opts.dryRun) await ionicInit(ctx, project.projectFolder());
      else ctx.logger.write('[dry-run] ionic init');
      continue;
    }
    ctx.logger.writeWN(cmd.replace(InternalCommand.cwd, ''));
    await runShell(ctx, { command: cmd.replace(InternalCommand.cwd, ''), cwd: project.projectFolder() });
  }

  for (const platform of platforms) {
    if (platform !== CapacitorPlatform.ios && platform !== CapacitorPlatform.android) continue;
    await runCommandResult(ctx, capacitorAdd(project, platform));
  }

  return { appId, appName, webDir, platforms };
}

async function integratePwa(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  if (!project.analyzer.exists('@angular/core')) {
    throw new WnError('NOT_ANGULAR', 'PWA integration requires an Angular project', {
      exitCode: ExitCode.CommandFailed,
    });
  }

  if (!ctx.opts.dryRun && !ctx.opts.yes && !ctx.opts.noInput && !ctx.opts.json) {
    const ok = await confirm('Add @angular/pwa to this project?', ctx.opts);
    if (!ok) return { cancelled: true };
  }

  const cmd = `${npx(project)} ng add @angular/pwa --defaults --skip-confirmation true`;
  await runShell(ctx, { command: cmd, cwd: project.projectFolder() });
  return { integrated: 'pwa' };
}

function defaultPrettierConfig(): string {
  return JSON.stringify(
    {
      printWidth: 120,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true,
      quoteProps: 'as-needed',
      jsxSingleQuote: false,
      trailingComma: 'all',
      bracketSpacing: true,
      bracketSameLine: false,
      arrowParens: 'always',
      overrides: [
        {
          files: ['*.java'],
          options: {
            printWidth: 140,
            tabWidth: 4,
            useTabs: false,
            trailingComma: 'none',
          },
        },
        {
          files: '*.md',
          options: { parser: 'mdx' },
        },
      ],
    },
    undefined,
    2,
  );
}

async function integratePrettier(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const ctxPm = commandContext(project);
  const saveDev = saveDevArgument(project.packageManager);

  if (!ctx.opts.dryRun && !ctx.opts.yes && !ctx.opts.noInput && !ctx.opts.json) {
    const ok = await confirm('Add Prettier, husky, and lint-staged to this project?', ctx.opts);
    if (!ok) return { cancelled: true };
  }

  const commands = [
    npmInstall('husky', ctxPm, saveDev, '--save-exact'),
    npmInstall('prettier', ctxPm, saveDev, '--save-exact'),
    npmInstall('lint-staged', ctxPm, saveDev, '--save-exact'),
  ];
  await runCommandSequence(ctx, commands, project.projectFolder());

  const filename = join(project.projectFolder(), 'package.json');
  const packageFile = JSON.parse(readFileSync(filename, 'utf8'));
  packageFile.scripts = packageFile.scripts ?? {};

  if (!packageFile.scripts['prettify']) {
    packageFile.scripts['prettify'] = `prettier "**/*.{ts,html}" --write`;
  }
  if (!packageFile.scripts['prepare']) {
    packageFile.scripts['prepare'] = `husky install`;
  }
  if (!packageFile['husky']) {
    packageFile['husky'] = { hooks: { 'pre-commit': 'npx lint-staged && npm run lint' } };
  }
  if (!packageFile['lint-staged']) {
    packageFile['lint-staged'] = {
      '*.{css,html,js,jsx,scss,ts,tsx}': ['prettier --write'],
      '*.{md,json}': ['prettier --write'],
    };
  }

  if (!ctx.opts.dryRun) {
    writeFileSync(filename, JSON.stringify(packageFile, undefined, 2));
    const prettierrc = join(project.projectFolder(), '.prettierrc.json');
    if (!existsSync(prettierrc)) {
      writeFileSync(prettierrc, defaultPrettierConfig());
    }
  }

  const applyNow = flagBool(ctx.args.flags, 'apply') || flagBool(ctx.args.flags, 'husky');
  if (applyNow && !ctx.opts.dryRun) {
    await runShell(ctx, { command: npmRun('prettify', ctxPm), cwd: project.projectFolder() });
    if (packageFile.scripts['lint']) {
      await runShell(ctx, { command: npmRun('lint -- --fix', ctxPm), cwd: project.projectFolder() });
    }
  }

  return { integrated: 'prettier' };
}

async function runIntegrate(ctx: CliContext): Promise<unknown> {
  const sub = positional(ctx, 0);
  switch (sub) {
    case 'capacitor':
      return integrateCapacitor(ctx);
    case 'pwa':
      return integratePwa(ctx);
    case 'prettier':
      return integratePrettier(ctx);
    default:
      throw new WnError('USAGE_ERROR', 'Usage: wn integrate <capacitor|pwa|prettier>', {
        exitCode: ExitCode.UsageError,
        hint: 'wn integrate capacitor [--web-dir <dir>] [--platforms ios,android]',
      });
  }
}

export function registerIntegrateCommand(): void {
  registerCommand({
    name: 'integrate',
    description: 'Add Capacitor, PWA, or Prettier to an existing project',
    run: runIntegrate,
  });
}
