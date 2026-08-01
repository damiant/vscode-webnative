import { getCache, setCache } from '../core/cache';

export interface PluginCatalogEntry {
  name: string;
  description?: string;
  repo?: string;
  platforms?: string[];
  official?: boolean;
  keywords?: string[];
}

export interface PluginCatalog {
  plugins: PluginCatalogEntry[];
}

const CATALOG_URL = 'https://capacitorjs.com/directory/plugin-data-raw.json';
const CACHE_KEY = 'plugin-catalog';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function fetchPluginCatalog(force = false): Promise<PluginCatalog> {
  if (!force) {
    const cached = getCache<PluginCatalog>('plugins', CACHE_KEY, CACHE_TTL_MS);
    if (cached) return normalizeCatalog(cached);
  }
  const response = await fetch(CATALOG_URL, { headers: { Accept: 'application/json', 'User-Agent': 'WebNative CLI' } });
  if (!response.ok) throw new Error(`Failed to fetch plugin catalog: ${response.status}`);
  const json = (await response.json()) as PluginCatalog;
  const catalog = normalizeCatalog(json);
  setCache('plugins', CACHE_KEY, catalog);
  return catalog;
}

function normalizeCatalog(raw: PluginCatalog): PluginCatalog {
  const plugins = (raw.plugins ?? []).map((p) => ({
    ...p,
    official: p.name?.startsWith('@capacitor/') ?? false,
  }));
  return { plugins };
}
