import * as path from 'path';
import { GlobalOptions, ParsedArgs } from '../cli/args';
import { loadConfig, WnConfig } from './config';
import { ExecRunner } from './exec';
import { Logger } from './logger';
import { Project } from '../project/project';

export interface CliContext {
  args: ParsedArgs;
  opts: GlobalOptions;
  config: WnConfig;
  logger: Logger;
  exec: ExecRunner;
  cwd: string;
  project?: Project;
  warnings: string[];
  commandName: string;
}

export function createContext(args: ParsedArgs, commandName: string): CliContext {
  const cwd = path.resolve(args.global.cwd);
  const config = loadConfig(cwd, args.global);
  const logger = new Logger(args.global);
  const exec = new ExecRunner(args.global, config, logger);
  return {
    args,
    opts: args.global,
    config,
    logger,
    exec,
    cwd,
    warnings: [],
    commandName,
  };
}
