import { Output } from '../cli/output';
import { GlobalOptions } from '../cli/args';

/** Thin wrapper matching the extension's write/writeWN/writeError surface. */
export class Logger {
  readonly output: Output;

  constructor(opts: GlobalOptions) {
    this.output = new Output(opts);
  }

  write(message: string): void {
    this.output.info(message);
  }

  writeWN(message: string): void {
    this.output.info(`[wn] ${message}`);
  }

  writeError(message: string): void {
    this.output.error(message);
  }

  writeWarning(message: string): void {
    this.output.warn(message);
  }

  verbose(message: string): void {
    this.output.verbose(message);
  }
}
