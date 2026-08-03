import { finalizeCommand } from '../build/command-result';
import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { registerCommand } from '../cli/registry';
import { CliContext } from '../core/context';
import { inspectProject } from '../project/inspect';
import { Category, Finding, Severity } from '../rules/finding';
import { runChecks } from '../rules/engine';
import { addIgnoredId, getIgnoredIds, isIgnored } from '../rules/ignore';

const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

const VALID_SEVERITIES = new Set<Severity>(['error', 'warning', 'info']);
const VALID_CATEGORIES = new Set<Category>([
  'packages',
  'capacitor',
  'cordova',
  'angular',
  'typescript',
  'android',
  'ios',
  'browserslist',
  'security',
  'privacy',
]);

function parseSeverityList(raw: string | undefined): Set<Severity> | undefined {
  if (!raw) return undefined;
  const values = raw.split(',').map((s) => s.trim()) as Severity[];
  for (const v of values) {
    if (!VALID_SEVERITIES.has(v)) {
      throw new WnError('USAGE_ERROR', `Invalid severity: ${v}`, { exitCode: ExitCode.UsageError });
    }
  }
  return new Set(values);
}

function parseCategoryList(raw: string | undefined): Set<Category> | undefined {
  if (!raw) return undefined;
  const values = raw.split(',').map((s) => s.trim()) as Category[];
  for (const v of values) {
    if (!VALID_CATEGORIES.has(v)) {
      throw new WnError('USAGE_ERROR', `Invalid category: ${v}`, { exitCode: ExitCode.UsageError });
    }
  }
  return new Set(values);
}

function parseErrorOn(raw: string | undefined): Severity | undefined {
  if (!raw) return undefined;
  if (!VALID_SEVERITIES.has(raw as Severity)) {
    throw new WnError('USAGE_ERROR', `Invalid --error-on severity: ${raw}`, { exitCode: ExitCode.UsageError });
  }
  return raw as Severity;
}

function filterFindings(
  findings: Finding[],
  options: {
    severities?: Set<Severity>;
    categories?: Set<Category>;
    ignored: string[];
    showIgnored: boolean;
  },
): Finding[] {
  return findings.filter((f) => {
    if (!options.showIgnored && isIgnored(f.id, options.ignored)) return false;
    if (options.severities && !options.severities.has(f.severity)) return false;
    if (options.categories && !options.categories.has(f.category)) return false;
    return true;
  });
}

function meetsErrorThreshold(finding: Finding, threshold: Severity): boolean {
  return SEVERITY_ORDER[finding.severity] >= SEVERITY_ORDER[threshold];
}

function findById(findings: Finding[], id: string): Finding | undefined {
  return findings.find((f) => f.id === id);
}

async function runFixCommand(ctx: CliContext, finding: Finding): Promise<void> {
  if (!finding.fixable || !finding.fix?.command) {
    throw new WnError('NOT_FIXABLE', `Finding ${finding.id} is not automatically fixable`, {
      exitCode: ExitCode.CommandFailed,
    });
  }

  const commands = Array.isArray(finding.fix.command) ? finding.fix.command : [finding.fix.command];
  for (const cmd of commands) {
    const finalized = finalizeCommand(ctx.project!, cmd);
    if (typeof finalized === 'string') {
      await ctx.exec.run({ command: finalized, cwd: ctx.project!.projectFolder() });
    } else {
      await ctx.exec.run(finalized);
    }
  }
}

async function runCheck(ctx: CliContext): Promise<unknown> {
  const started = Date.now();
  const project = await inspectProject(ctx.cwd, ctx.opts.project);
  ctx.project = project;

  const packages = project.analyzer.getAllDependencies();
  const allFindings = await runChecks(project, packages);

  const ignored = getIgnoredIds(ctx.cwd, ctx.opts);
  const showIgnored = flagBool(ctx.args.flags, 'show-ignored');
  const severities = parseSeverityList(flagString(ctx.args.flags, 'severity'));
  const categories = parseCategoryList(flagString(ctx.args.flags, 'category'));
  const errorOn = parseErrorOn(flagString(ctx.args.flags, 'error-on') ?? ctx.config.check?.errorOn);

  const fixId = flagString(ctx.args.flags, 'fix');
  const fixAllRaw = ctx.args.flags['fix-all'];
  const ignoreId = flagString(ctx.args.flags, 'ignore');

  if (ignoreId) {
    addIgnoredId(ctx.cwd, ignoreId, ctx.opts);
    ignored.push(ignoreId);
  }

  let findings = filterFindings(allFindings, { severities, categories, ignored, showIgnored });

  if (fixId) {
    const target = findById(allFindings, fixId);
    if (!target) {
      throw new WnError('UNKNOWN_FINDING', `No finding with id ${fixId}`, { exitCode: ExitCode.CommandFailed });
    }
    try {
      await runFixCommand(ctx, target);
    } catch (err) {
      if (err instanceof WnError) throw err;
      throw new WnError('FIX_FAILED', err instanceof Error ? err.message : String(err), {
        exitCode: ExitCode.CommandFailed,
      });
    }
  }

  if (fixAllRaw !== undefined) {
    const minSeverity =
      typeof fixAllRaw === 'string' && fixAllRaw !== 'true' ? parseErrorOn(fixAllRaw) : ('warning' as Severity);
    const fixable = findings.filter(
      (f) => f.fixable && f.fix?.command && meetsErrorThreshold(f, minSeverity ?? 'warning'),
    );
    for (const finding of fixable) {
      try {
        await runFixCommand(ctx, finding);
      } catch (err) {
        if (err instanceof WnError) throw err;
        throw new WnError('FIX_FAILED', err instanceof Error ? err.message : String(err), {
          exitCode: ExitCode.CommandFailed,
        });
      }
    }
  }

  if (errorOn) {
    const blocking = allFindings.filter((f) => !isIgnored(f.id, ignored) && meetsErrorThreshold(f, errorOn));
    if (blocking.length > 0) {
      throw new WnError('CHECK_FAILED', `Found ${blocking.length} finding(s) at or above ${errorOn} severity`, {
        exitCode: ExitCode.CheckFailed,
        details: { count: blocking.length },
      });
    }
  }

  const summary = {
    findings,
    total: allFindings.length,
    ignored: allFindings.filter((f) => isIgnored(f.id, ignored)).length,
  };

  if (ctx.opts.json) {
    return summary;
  }

  if (!ctx.opts.quiet) {
    for (const f of findings) {
      const prefix = f.severity.toUpperCase().padEnd(7);
      ctx.logger.output.info(`[${prefix}] ${f.id}: ${f.title}`);
      if (f.detail) ctx.logger.output.info(`         ${f.detail}`);
    }
    ctx.logger.output.info(`\n${findings.length} finding(s) shown (${allFindings.length} total)`);
  }

  return summary;
}

registerCommand({
  name: 'check',
  description: 'Run the recommendation engine and report findings',
  run: runCheck,
});

export { runCheck };
