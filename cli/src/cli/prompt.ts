import * as readline from 'readline';
import { GlobalOptions } from './args';
import { ErrorChoice, WnError } from './errors';
import { ExitCode } from './exit-codes';

export function canPrompt(opts: GlobalOptions): boolean {
  return !opts.noInput && !opts.json && !!process.stdin.isTTY;
}

export async function ask(question: string, opts: GlobalOptions, defaultValue?: string): Promise<string> {
  if (!canPrompt(opts)) {
    if (opts.yes && defaultValue !== undefined) return defaultValue;
    throw new WnError('MISSING_INPUT', `Missing required input: ${question}`, {
      exitCode: ExitCode.MissingInput,
      hint: 'Re-run with the appropriate flag or without --no-input',
    });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const suffix = defaultValue !== undefined ? ` [${defaultValue}]` : '';
  const answer = await new Promise<string>((resolve) => {
    rl.question(`${question}${suffix}: `, (a) => resolve(a));
  });
  rl.close();
  return answer.trim() || defaultValue || '';
}

export async function confirm(question: string, opts: GlobalOptions, defaultYes = true): Promise<boolean> {
  if (opts.yes) return true;
  if (!canPrompt(opts)) return defaultYes;
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await ask(`${question} (${hint})`, opts);
  if (!answer) return defaultYes;
  return /^y(es)?$/i.test(answer);
}

export async function requireChoice<T extends ErrorChoice>(
  input: string,
  choices: T[],
  opts: GlobalOptions,
  hint: string,
  selected?: string,
): Promise<T> {
  if (selected) {
    const match = choices.find((c) => c.id === selected || c.name === selected);
    if (!match) {
      throw new WnError('MISSING_INPUT', `Unknown ${input}: ${selected}`, {
        exitCode: ExitCode.MissingInput,
        input,
        choices,
        hint,
      });
    }
    return match;
  }

  if (choices.length === 1) return choices[0];

  if (choices.length === 0) {
    throw new WnError('MISSING_INPUT', `No ${input} available`, {
      exitCode: ExitCode.MissingInput,
      input,
      choices,
      hint,
    });
  }

  if (canPrompt(opts)) {
    process.stderr.write(`Select ${input}:\n`);
    choices.forEach((c, i) => {
      process.stderr.write(`  ${i + 1}) ${c.name ?? c.id}${c.type ? ` (${c.type})` : ''}\n`);
    });
    const answer = await ask('Enter number or id', opts);
    const byIndex = Number(answer);
    if (!Number.isNaN(byIndex) && byIndex >= 1 && byIndex <= choices.length) {
      return choices[byIndex - 1];
    }
    const match = choices.find((c) => c.id === answer || c.name === answer);
    if (match) return match;
  }

  throw new WnError('MISSING_INPUT', `No ${input} selected and more than one is available.`, {
    exitCode: ExitCode.MissingInput,
    input,
    choices,
    hint,
  });
}
