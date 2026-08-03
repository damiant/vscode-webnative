import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { flagBool } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { registerCommand } from '../cli/registry';
import { commandContext, npmUninstall, npx } from '../build/node-commands';
import { CliContext } from '../core/context';
import { CapacitorPlatform } from '../project/capacitor-platform';
import { ensureProject, positional, runShell } from './helpers';

export enum AssetType {
  splash = 'splash.png',
  splashDark = 'splash-dark.png',
  icon = 'icon.png',
  adaptiveForeground = 'icon-foreground.png',
  adaptiveBackground = 'icon-background.png',
}

const ASSET_ALIASES: Record<string, AssetType> = {
  splash: AssetType.splash,
  'splash-dark': AssetType.splashDark,
  icon: AssetType.icon,
  'icon-foreground': AssetType.adaptiveForeground,
  'icon-background': AssetType.adaptiveBackground,
};

function getResourceFolder(folder: string, filename: AssetType, createIfMissing?: boolean): string {
  let resourceFolder = join(folder, 'resources');
  if (createIfMissing && !existsSync(resourceFolder)) {
    mkdirSync(resourceFolder);
  }
  if (filename == AssetType.adaptiveBackground || filename == AssetType.adaptiveForeground) {
    resourceFolder = join(resourceFolder, 'android');
    if (createIfMissing && !existsSync(resourceFolder)) {
      mkdirSync(resourceFolder);
    }
  }
  return resourceFolder;
}

function assetPath(folder: string, type: AssetType): string {
  return join(getResourceFolder(folder, type), type);
}

function assetStatus(folder: string, type: AssetType): { type: string; path: string; exists: boolean } {
  const path = assetPath(folder, type);
  return {
    type: Object.keys(ASSET_ALIASES).find((k) => ASSET_ALIASES[k] === type) ?? type,
    path,
    exists: existsSync(path),
  };
}

function resolveAssetType(raw: string): AssetType {
  const type = ASSET_ALIASES[raw];
  if (!type) {
    throw new WnError('USAGE_ERROR', `Unknown asset type: ${raw}`, {
      exitCode: ExitCode.UsageError,
      choices: Object.keys(ASSET_ALIASES).map((id) => ({ id, name: id })),
    });
  }
  return type;
}

function hasNeededAssets(folder: string): string | undefined {
  if (!existsSync(assetPath(folder, AssetType.icon))) return 'An icon needs to be specified next.';
  if (!existsSync(assetPath(folder, AssetType.splash))) return 'A splash screen needs to be specified next.';
  if (!existsSync(assetPath(folder, AssetType.splashDark)))
    return 'A dark mode splash screen needs to be specified next.';
  return undefined;
}

function addToGitIgnore(folder: string, ignoreGlob: string): void {
  const filename = join(folder, '.gitignore');
  if (existsSync(filename)) {
    let txt = readFileSync(filename, { encoding: 'utf-8' });
    if (!txt.includes(ignoreGlob)) {
      txt = txt + `\n${ignoreGlob}`;
      writeFileSync(filename, txt);
    }
  }
}

async function runAssetsList(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const folder = project.projectFolder();
  return {
    assets: Object.keys(ASSET_ALIASES).map((key) => assetStatus(folder, ASSET_ALIASES[key])),
  };
}

async function runAssetsSet(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const folder = project.projectFolder();
  const typeRaw = positional(ctx, 0);
  const sourceFile = positional(ctx, 1);
  if (!typeRaw || !sourceFile) {
    throw new WnError('USAGE_ERROR', 'Usage: wn assets set <type> <file>', { exitCode: ExitCode.UsageError });
  }

  const assetType = resolveAssetType(typeRaw);
  if (extname(sourceFile) !== '.png') {
    throw new WnError('INVALID_IMAGE', 'The file must be a png', { exitCode: ExitCode.UsageError });
  }
  if (!existsSync(sourceFile)) {
    throw new WnError('MISSING_SOURCE_ASSET', `File not found: ${sourceFile}`, { exitCode: ExitCode.CommandFailed });
  }

  const resourceFolder = getResourceFolder(folder, assetType, true);
  const dest = join(resourceFolder, assetType);
  if (!ctx.opts.dryRun) {
    copyFileSync(sourceFile, dest);
    if (assetType == AssetType.icon) {
      const bg = join(getResourceFolder(folder, AssetType.adaptiveBackground, true), AssetType.adaptiveBackground);
      const fg = join(getResourceFolder(folder, AssetType.adaptiveForeground, true), AssetType.adaptiveForeground);
      if (!existsSync(bg)) copyFileSync(sourceFile, bg);
      if (!existsSync(fg)) copyFileSync(sourceFile, fg);
    }
  }

  return { type: typeRaw, path: dest };
}

async function runAssetsGenerate(ctx: CliContext): Promise<unknown> {
  const project = await ensureProject(ctx);
  const folder = project.projectFolder();
  const needed = hasNeededAssets(folder);
  if (needed) {
    throw new WnError('MISSING_SOURCE_ASSET', needed, { exitCode: ExitCode.MissingInput });
  }

  const ios = flagBool(ctx.args.flags, 'ios') || project.hasCapacitorProject(CapacitorPlatform.ios);
  const android = flagBool(ctx.args.flags, 'android') || project.hasCapacitorProject(CapacitorPlatform.android);
  const pwa = flagBool(ctx.args.flags, 'pwa') || project.analyzer.exists('@angular/service-worker');
  const explicitTarget =
    flagBool(ctx.args.flags, 'ios') || flagBool(ctx.args.flags, 'android') || flagBool(ctx.args.flags, 'pwa');

  const runIos = explicitTarget ? flagBool(ctx.args.flags, 'ios') : ios;
  const runAndroid = explicitTarget ? flagBool(ctx.args.flags, 'android') : android;
  const runPwa = explicitTarget ? flagBool(ctx.args.flags, 'pwa') : pwa;

  const commands: string[] = [];
  if (project.analyzer.exists('cordova-res')) {
    commands.push(npmUninstall('cordova-res', commandContext(project)));
  }

  if (runIos) {
    commands.push(`${npx(project, { forceNpx: true })} @capacitor/assets generate --ios`);
  }
  if (runAndroid) {
    commands.push(`${npx(project, { forceNpx: true })} @capacitor/assets generate --android`);
  }
  if (runPwa) {
    commands.push(
      `${npx(project, { forceNpx: true })} @capacitor/assets generate --pwa --pwaManifestPath './src/manifest.webmanifest'`,
    );
  }

  if (commands.length === 0) {
    throw new WnError('GENERATE_FAILED', 'No Capacitor platforms found. Add iOS, Android, or PWA platform first.', {
      exitCode: ExitCode.CommandFailed,
    });
  }

  for (const cmd of commands) {
    ctx.logger.writeWN(cmd);
    await runShell(ctx, { command: cmd, cwd: folder });
  }

  if (!ctx.opts.dryRun) {
    if (runIos) addToGitIgnore(folder, 'resources/ios/**/*');
    if (runAndroid) addToGitIgnore(folder, 'resources/android/**/*');
  }

  return { generated: { ios: runIos, android: runAndroid, pwa: runPwa } };
}

async function runAssets(ctx: CliContext): Promise<unknown> {
  const sub = positional(ctx, 0);
  switch (sub) {
    case 'list':
      return runAssetsList(ctx);
    case 'set':
      return runAssetsSet(ctx);
    case 'generate':
      return runAssetsGenerate(ctx);
    default:
      throw new WnError('USAGE_ERROR', 'Usage: wn assets <list|set|generate>', { exitCode: ExitCode.UsageError });
  }
}

export function registerAssetsCommand(): void {
  registerCommand({
    name: 'assets',
    description: 'Manage splash screens and app icons',
    run: runAssets,
  });
}
