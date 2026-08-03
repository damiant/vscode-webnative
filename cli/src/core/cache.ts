import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

export function cacheDir(): string {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'wn');
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function keyPath(namespace: string, key: string): string {
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
  const safe = key.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 40);
  return path.join(cacheDir(), namespace, `${safe}-${hash}.json`);
}

export interface CacheEntry<T> {
  value: T;
  storedAt: number;
}

export function getCache<T>(namespace: string, key: string, maxAgeMs: number): T | undefined {
  const file = keyPath(namespace, key);
  try {
    if (!fs.existsSync(file)) return undefined;
    const entry = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheEntry<T>;
    if (Date.now() - entry.storedAt > maxAgeMs) return undefined;
    return entry.value;
  } catch {
    return undefined;
  }
}

export function setCache<T>(namespace: string, key: string, value: T): void {
  const file = keyPath(namespace, key);
  ensureDir(path.dirname(file));
  const entry: CacheEntry<T> = { value, storedAt: Date.now() };
  fs.writeFileSync(file, JSON.stringify(entry));
}

export function clearCache(namespace?: string): void {
  const dir = namespace ? path.join(cacheDir(), namespace) : cacheDir();
  fs.rmSync(dir, { recursive: true, force: true });
}
