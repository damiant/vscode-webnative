import { Envelope } from './envelope';
import { GlobalOptions } from './args';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

export class Output {
  constructor(private readonly opts: GlobalOptions) {}

  private color(code: string, text: string): string {
    if (this.opts.noColor) return text;
    return `${code}${text}${colors.reset}`;
  }

  writeJson(envelope: Envelope): void {
    process.stdout.write(JSON.stringify(envelope) + '\n');
  }

  writeStreamEvent(event: Record<string, unknown>): void {
    if (this.opts.streamJson || this.opts.json) {
      process.stdout.write(JSON.stringify(event) + '\n');
    }
  }

  info(message: string): void {
    if (this.opts.json || this.opts.quiet) return;
    process.stderr.write(message + '\n');
  }

  verbose(message: string): void {
    if (!this.opts.verbose || this.opts.json) return;
    process.stderr.write(this.color(colors.dim, message) + '\n');
  }

  warn(message: string): void {
    if (this.opts.json) {
      process.stderr.write(message + '\n');
      return;
    }
    process.stderr.write(this.color(colors.yellow, message) + '\n');
  }

  error(message: string): void {
    process.stderr.write(this.color(colors.red, message) + '\n');
  }

  success(message: string): void {
    if (this.opts.json || this.opts.quiet) return;
    process.stderr.write(this.color(colors.green, message) + '\n');
  }

  humanResult(envelope: Envelope): void {
    if (envelope.ok) {
      if (envelope.data != null) {
        if (typeof envelope.data === 'string') {
          process.stdout.write(envelope.data + '\n');
        } else {
          process.stdout.write(JSON.stringify(envelope.data, null, 2) + '\n');
        }
      }
      for (const w of envelope.warnings) {
        this.warn(w);
      }
    } else {
      for (const e of envelope.errors) {
        this.error(`${e.code}: ${e.message}`);
        if (e.hint) this.info(e.hint);
        if (e.choices?.length) {
          this.info('Choices:');
          for (const c of e.choices) {
            this.info(`  ${JSON.stringify(c)}`);
          }
        }
      }
    }
  }
}
