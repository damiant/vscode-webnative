import { writeFileSync } from 'fs';
import { join } from 'path';

let log = '';

export function aiLog(message: string) {
  log += message + '\n';
}

export function aiWriteLog(folder: string) {
  writeFileSync(join(folder, 'ai.md'), log);
  log = '';
}
