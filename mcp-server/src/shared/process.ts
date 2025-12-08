/**
 * Process execution utilities for MCP server
 * Adapted from ../../../src/utilities.ts
 */

import { exec, ExecOptions, spawn } from 'child_process';
import { existsSync } from 'fs';

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  timeout?: number;
}

export interface RunResult {
  exitCode: number;
  output: string;
  success: boolean;
}

export function isMac(): boolean {
  return process.platform === 'darwin';
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Execute a command and return the output
 */
export async function runCommand(command: string, options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const env = { ...process.env, ...options.env };

    // Set LANG for Cocoapods
    if (!env.LANG) {
      env.LANG = 'en_US.UTF-8';
    }

    // Set JAVA_HOME if not set
    if (!env.JAVA_HOME && process.platform !== 'win32') {
      const jHome = '/Applications/Android Studio.app/Contents/jre/Contents/Home';
      if (existsSync(jHome)) {
        env.JAVA_HOME = jHome;
      }
    }

    const execOptions: ExecOptions = {
      cwd: options.cwd,
      env: env,
      maxBuffer: 10485760,
      shell: options.shell || process.env.SHELL,
      timeout: options.timeout,
    };

    exec(command, execOptions, (error, stdout, stderr) => {
      const output = stdout + stderr;
      resolve({
        exitCode: error?.code || 0,
        output: output.trim(),
        success: !error || error.code === 0,
      });
    });
  });
}

/**
 * Execute a command with streaming output
 */
export async function runCommandStreaming(
  command: string,
  options: RunOptions = {},
  onOutput?: (line: string) => void,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const env = { ...process.env, ...options.env };

    if (!env.LANG) {
      env.LANG = 'en_US.UTF-8';
    }

    const proc = spawn(command, {
      cwd: options.cwd,
      env: env,
      shell: true,
    });

    let output = '';

    proc.stdout?.on('data', (data) => {
      const str = data.toString();
      output += str;
      if (onOutput) {
        str.split('\n').forEach((line: string) => {
          if (line.trim()) {
            onOutput(line);
          }
        });
      }
    });

    proc.stderr?.on('data', (data) => {
      const str = data.toString();
      output += str;
      if (onOutput) {
        str.split('\n').forEach((line: string) => {
          if (line.trim()) {
            onOutput(line);
          }
        });
      }
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        output: output.trim(),
        success: code === 0,
      });
    });

    proc.on('error', (err) => {
      resolve({
        exitCode: 1,
        output: output + '\nError: ' + err.message,
        success: false,
      });
    });
  });
}
