import { exec } from 'child_process';

export function replaceAll(str: string, find: string, replace: string): string {
  return str.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
}

export async function getRunOutput(command: string, folder: string, shell?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: folder,
        encoding: 'utf8',
        shell: shell || (process.platform === 'win32' ? 'powershell.exe' : '/bin/sh'),
        env: { ...process.env, LANG: process.env.LANG || 'en_US.UTF-8' },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}
