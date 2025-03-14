import { existsSync, readFileSync } from 'fs';
import { replaceAll } from './utilities';

export function gradleToJson(filename: string): any | undefined {
  if (!existsSync(filename)) {
    return undefined;
  }
  try {
    const lines = readFileSync(filename, 'utf8').split('\n');
    const result = {};
    let at = result;
    const stack = [at];
    for (const line of lines) {
      if (line.trim().endsWith('{')) {
        const key = replaceAll(line, '{', '').trim();
        at[key] = {};
        stack.push(at);
        at = at[key];
      } else if (line.trim().endsWith('}')) {
        at = stack.pop();
      } else if (line.trim() !== '') {
        const kv = line.trim().split(' ');
        if (kv.length == 2) {
          at[kv[0]] = kv[1];
        } else {
          at[kv[0]] = [];
          for (let i = 1; i < kv.length; i++) {
            at[kv[0]].push(kv[i]);
          }
        }
      }
    }
    return result;
  } catch {
    return undefined;
  }
}
