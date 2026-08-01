import { isWnError, WnError } from './errors';

export interface EnvelopeError {
  code: string;
  message: string;
  input?: string;
  choices?: unknown[];
  hint?: string;
  file?: string;
  line?: number;
  column?: number;
  [key: string]: unknown;
}

export interface Envelope {
  ok: boolean;
  command: string;
  data: unknown;
  warnings: string[];
  errors: EnvelopeError[];
  durationMs: number;
}

export function successEnvelope(command: string, data: unknown, durationMs: number, warnings: string[] = []): Envelope {
  return { ok: true, command, data, warnings, errors: [], durationMs };
}

export function failureEnvelope(command: string, err: unknown, durationMs: number, warnings: string[] = []): Envelope {
  const errors: EnvelopeError[] = [];
  if (isWnError(err)) {
    errors.push(err.toJSON());
  } else if (err instanceof Error) {
    errors.push({ code: 'COMMAND_FAILED', message: err.message });
  } else {
    errors.push({ code: 'COMMAND_FAILED', message: String(err) });
  }
  return { ok: false, command, data: null, warnings, errors, durationMs };
}

export function errorFromParsed(parsed: {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
}): EnvelopeError {
  return {
    code: parsed.code ?? 'BUILD_FAILED',
    message: parsed.message,
    ...(parsed.file ? { file: parsed.file } : {}),
    ...(parsed.line != null ? { line: parsed.line } : {}),
    ...(parsed.column != null ? { column: parsed.column } : {}),
  };
}

export { WnError };
