#!/usr/bin/env node
import { parseArgs } from './cli/args';
import { failureEnvelope, successEnvelope } from './cli/envelope';
import { isWnError } from './cli/errors';
import { ExitCode } from './cli/exit-codes';
import { printCommandHelp, printRootHelp } from './cli/help';
import { resolveCommand } from './cli/registry';
import { createContext } from './core/context';
import { Output } from './cli/output';
import { inspectProject } from './project/inspect';
import './commands/index';

async function main(): Promise<number> {
  const start = Date.now();
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Usage error: ${(err as Error).message}\n`);
    return ExitCode.UsageError;
  }

  const output = new Output(parsed.global);

  if (parsed.global.version) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../package.json');
    process.stdout.write(`${pkg.version}\n`);
    return ExitCode.Success;
  }

  if (parsed.tokens.length === 0) {
    if (parsed.global.help) {
      printRootHelp();
      return ExitCode.Success;
    }
    // Summary mode: detect project and suggest next commands
    try {
      const project = await inspectProject(parsed.global.cwd, parsed.global.project);
      const summary = {
        name: project.name,
        type: project.type,
        framework: project.frameworkType,
        packageManager: project.packageManager,
        next: ['wn info --json', 'wn check --json', 'wn run web --background --json'],
      };
      if (parsed.global.json) {
        output.writeJson(successEnvelope('', summary, Date.now() - start));
      } else {
        process.stdout.write(
          `WebNative project: ${summary.name} (${summary.type}, ${summary.framework}, ${summary.packageManager})\n` +
            `Try: wn info --json | wn check --json | wn run web --background --json\n` +
            `Help: wn --help\n`,
        );
      }
      return ExitCode.Success;
    } catch {
      printRootHelp();
      return ExitCode.Success;
    }
  }

  const { def, name } = resolveCommand(parsed);
  if (!def) {
    if (parsed.global.help) {
      printRootHelp();
      return ExitCode.Success;
    }
    output.error(`Unknown command: ${name || '(none)'}`);
    printRootHelp();
    return ExitCode.UsageError;
  }

  if (parsed.global.help) {
    printCommandHelp(def.name, def.description);
    return ExitCode.Success;
  }

  const ctx = createContext(parsed, def.name);

  try {
    const data = await def.run(ctx);
    const envelope = successEnvelope(def.name, data, Date.now() - start, ctx.warnings);
    if (parsed.global.json || parsed.global.streamJson) {
      output.writeJson(envelope);
    } else {
      output.humanResult(envelope);
    }
    return ExitCode.Success;
  } catch (err) {
    const envelope = failureEnvelope(def.name, err, Date.now() - start, ctx.warnings);
    // Surface nested build errors into envelope.errors
    if (isWnError(err) && err.details?.errors && Array.isArray(err.details.errors)) {
      envelope.errors = err.details.errors as typeof envelope.errors;
    }
    if (parsed.global.json || parsed.global.streamJson) {
      output.writeJson(envelope);
    } else {
      output.humanResult(envelope);
    }
    if (isWnError(err)) return err.exitCode;
    return ExitCode.CommandFailed;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(String(err) + '\n');
    process.exit(ExitCode.CommandFailed);
  });
