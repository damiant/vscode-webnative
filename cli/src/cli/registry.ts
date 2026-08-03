import { CliContext } from '../core/context';
import { ParsedArgs } from './args';

export interface CommandDef {
  name: string;
  description: string;
  run: (ctx: CliContext) => Promise<unknown>;
  /** If true, skip project detection */
  noProject?: boolean;
}

const commands = new Map<string, CommandDef>();

export function registerCommand(def: CommandDef): void {
  commands.set(def.name, def);
}

export function getCommand(name: string): CommandDef | undefined {
  return commands.get(name);
}

export function listCommands(): CommandDef[] {
  return [...commands.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve command from tokens using longest registered name match. */
export function resolveCommand(parsed: ParsedArgs): {
  def?: CommandDef;
  name: string;
  rest: string[];
} {
  const tokens = parsed.tokens;
  if (tokens.length === 0) {
    return { name: '', rest: [] };
  }

  for (let len = Math.min(tokens.length, 4); len >= 1; len--) {
    const name = tokens.slice(0, len).join(' ');
    const def = commands.get(name);
    if (def) {
      const rest = tokens.slice(len);
      // Mutate for command handlers that read positionals
      parsed.positionals = rest;
      parsed.command = name.split(' ');
      return { def, name, rest };
    }
  }

  return { name: tokens[0], rest: tokens.slice(1) };
}
