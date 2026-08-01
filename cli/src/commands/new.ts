import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { confirm } from '../cli/prompt';
import { registerCommand } from '../cli/registry';
import { CliContext } from '../core/context';
import {
  buildScaffoldCommands,
  findTemplate,
  folderExists,
  getPackageId,
  getProjectName,
  listTemplateCatalog,
  parseTargets,
  resolveProjectFolder,
  starterTemplates,
  templateId,
} from '../templates/new';
import { runCommandSequence, usageError } from './helpers';

async function runNew(ctx: CliContext): Promise<unknown> {
  if (flagBool(ctx.args.flags, 'list-templates')) {
    return { templates: listTemplateCatalog() };
  }

  const nameArg = ctx.args.positionals[0] ?? flagString(ctx.args.flags, 'name');
  let name = nameArg;
  if (!name) {
    throw new WnError('MISSING_INPUT', 'Project name is required', {
      exitCode: ExitCode.MissingInput,
      input: 'name',
      hint: 'Pass a name argument or --name <name>',
    });
  }

  name = getProjectName(name);
  const packageId = getPackageId(name);
  const templateFlag = flagString(ctx.args.flags, 'template');
  const frameworkFlag = flagString(ctx.args.flags, 'framework');
  const template = findTemplate(templateFlag, frameworkFlag);

  if (!template) {
    const choices = starterTemplates.map((t) => ({ id: templateId(t), name: `${t.typeName} — ${t.name}` }));
    throw new WnError('UNKNOWN_TEMPLATE', `Unknown template: ${templateFlag ?? frameworkFlag ?? '(none)'}`, {
      exitCode: ExitCode.MissingInput,
      input: 'template',
      choices,
      hint: 'Run wn new --list-templates --json',
    });
  }

  const dir = flagString(ctx.args.flags, 'dir') ?? ctx.cwd;
  const folder = resolveProjectFolder(dir, name);
  if (folderExists(folder)) {
    throw new WnError('DIR_NOT_EMPTY', `The folder "${folder}" already exists`, {
      exitCode: ExitCode.CommandFailed,
      hint: 'Choose a unique project name or use --dir',
    });
  }

  const targets = parseTargets(flagString(ctx.args.flags, 'targets'));
  const noInstall = flagBool(ctx.args.flags, 'no-install');
  const noGit = flagBool(ctx.args.flags, 'no-git');

  const projectInput = {
    name,
    type: template.type,
    template: template.name,
    targets,
  };

  const options = { noGit, folder, packageId, name, noInstall };
  const commands = buildScaffoldCommands(projectInput, template, options);

  if (!ctx.opts.dryRun && !ctx.opts.yes && !ctx.opts.noInput && !ctx.opts.json) {
    const ok = await confirm(`Create ${template.typeName} "${template.name}" at ${folder}?`, ctx.opts);
    if (!ok) return { cancelled: true };
  }

  await runCommandSequence(ctx, commands, dir);

  return {
    name,
    folder,
    template: templateId(template),
    packageId,
    commands,
  };
}

export function registerNewCommand(): void {
  registerCommand({
    name: 'new',
    description: 'Create a new project from a starter template',
    noProject: true,
    run: runNew,
  });
}
