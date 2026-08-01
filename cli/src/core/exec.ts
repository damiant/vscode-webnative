import { spawn, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GlobalOptions } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { Logger } from './logger';
import { WnConfig } from './config';

export interface CommandSpec {
  command: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** When true, passwords/secrets are redacted from dry-run output */
  redact?: string[];
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  cwd: string;
}

export interface ExecOptions {
  dryRun?: boolean;
  quiet?: boolean;
  streamJson?: boolean;
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void;
  timeoutMs?: number;
  ignoreExitCode?: boolean;
}

function detectNvmPrefix(): string {
  const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
  const nvmSh = path.join(nvmDir, 'nvm.sh');
  if (fs.existsSync(nvmSh)) {
    return `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && `;
  }
  return '';
}

function buildEnv(config: WnConfig, extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extra };
  if (config.javaHome) env.JAVA_HOME = config.javaHome;
  if (config.androidSdk) {
    env.ANDROID_HOME = config.androidSdk;
    env.ANDROID_SDK_ROOT = config.androidSdk;
  }
  if (!env.LANG) env.LANG = 'en_US.UTF-8';
  return env;
}

function redactCommand(command: string, secrets: string[] = []): string {
  let result = command;
  for (const s of secrets) {
    if (s) result = result.split(s).join('***');
  }
  return result;
}

export class ExecRunner {
  constructor(
    private readonly opts: GlobalOptions,
    private readonly config: WnConfig,
    private readonly logger: Logger,
  ) {}

  async run(spec: CommandSpec, options: ExecOptions = {}): Promise<RunResult> {
    const cwd = spec.cwd || this.opts.cwd;
    const dryRun = options.dryRun ?? this.opts.dryRun;
    const display = redactCommand(spec.command, spec.redact);

    if (dryRun) {
      this.logger.write(`[dry-run] ${display} (cwd: ${cwd})`);
      if (this.opts.streamJson) {
        this.logger.output.writeStreamEvent({ event: 'dry-run', command: display, cwd });
      }
      return { stdout: '', stderr: '', exitCode: 0, command: display, cwd };
    }

    this.logger.verbose(`$ ${display}`);
    if (this.opts.streamJson) {
      this.logger.output.writeStreamEvent({ event: 'start', command: display, cwd });
    }

    const nvm = detectNvmPrefix();
    const shellCommand = nvm + spec.command;
    const env = buildEnv(this.config, spec.env);

    const result = await spawnShell(shellCommand, {
      cwd,
      env,
      timeoutMs: options.timeoutMs ?? (this.opts.timeout ? this.opts.timeout * 1000 : undefined),
      onLog: (line, stream) => {
        if (!options.quiet && !this.opts.quiet && !this.opts.json) {
          process.stderr.write(line + '\n');
        }
        if (this.opts.streamJson) {
          this.logger.output.writeStreamEvent({ event: 'log', level: 'info', message: line });
        }
        options.onLog?.(line, stream);
      },
    });

    if (this.opts.streamJson) {
      this.logger.output.writeStreamEvent({ event: 'end', command: display, exitCode: result.exitCode });
    }

    if (result.exitCode !== 0 && !options.ignoreExitCode) {
      throw new WnError('COMMAND_FAILED', `Command failed with exit code ${result.exitCode}: ${display}`, {
        exitCode: ExitCode.CommandFailed,
        details: { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode },
      });
    }

    return { ...result, command: display, cwd };
  }

  async getOutput(spec: CommandSpec, options: ExecOptions = {}): Promise<string> {
    const result = await this.run(spec, { ...options, quiet: true, ignoreExitCode: true });
    if (result.exitCode !== 0 && !options.ignoreExitCode) {
      throw new WnError('COMMAND_FAILED', result.stderr || result.stdout || `Command failed: ${spec.command}`, {
        exitCode: ExitCode.CommandFailed,
      });
    }
    return result.stdout;
  }
}

function spawnShell(
  command: string,
  opts: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs?: number;
    onLog?: (line: string, stream: 'stdout' | 'stderr') => void;
  },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const spawnOpts: SpawnOptions = {
      cwd: opts.cwd,
      env: opts.env,
      shell: true,
    };
    const child = spawn(command, [], spawnOpts);
    let stdout = '';
    let stderr = '';
    let killed = false;

    let timer: NodeJS.Timeout | undefined;
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        reject(
          new WnError('TIMEOUT', `Command timed out after ${opts.timeoutMs}ms`, {
            exitCode: ExitCode.Timeout,
          }),
        );
      }, opts.timeoutMs);
    }

    const handleChunk = (chunk: Buffer, stream: 'stdout' | 'stderr') => {
      const text = chunk.toString();
      if (stream === 'stdout') stdout += text;
      else stderr += text;
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (line.length) opts.onLog?.(line, stream);
      }
    };

    child.stdout?.on('data', (c) => handleChunk(c, 'stdout'));
    child.stderr?.on('data', (c) => handleChunk(c, 'stderr'));
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (killed) return;
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

/** Scrape a local URL from common framework serve banners. */
export function scrapeDevServerUrl(output: string): string | undefined {
  const patterns = [
    /Local:\s+(https?:\/\/[^\s]+)/i,
    /➜\s+Local:\s+(https?:\/\/[^\s]+)/i,
    /- Local:\s+(https?:\/\/[^\s]+)/i,
    /listening on\s+(https?:\/\/[^\s]+)/i,
    /Local server:\s+(https?:\/\/[^\s]+)/i,
    /http:\/\/localhost:\d+/,
    /http:\/\/127\.0\.0\.1:\d+/,
  ];
  for (const p of patterns) {
    const m = output.match(p);
    if (m) return m[1] || m[0];
  }
  return undefined;
}
