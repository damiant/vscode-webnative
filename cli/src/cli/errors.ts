import { ExitCode, ExitCodeValue } from './exit-codes';

export interface ErrorChoice {
  id: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}

export interface WnErrorOptions {
  exitCode?: ExitCodeValue;
  input?: string;
  choices?: ErrorChoice[];
  hint?: string;
  details?: Record<string, unknown>;
}

export class WnError extends Error {
  readonly code: string;
  readonly exitCode: ExitCodeValue;
  readonly input?: string;
  readonly choices?: ErrorChoice[];
  readonly hint?: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, options: WnErrorOptions = {}) {
    super(message);
    this.name = 'WnError';
    this.code = code;
    this.exitCode = options.exitCode ?? ExitCode.CommandFailed;
    this.input = options.input;
    this.choices = options.choices;
    this.hint = options.hint;
    this.details = options.details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.input ? { input: this.input } : {}),
      ...(this.choices ? { choices: this.choices } : {}),
      ...(this.hint ? { hint: this.hint } : {}),
      ...(this.details ? this.details : {}),
    };
  }
}

export function isWnError(err: unknown): err is WnError {
  return err instanceof WnError;
}
