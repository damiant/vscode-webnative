import { fetchPluginCatalog, PluginCatalogEntry } from './catalog';

export interface PluginSearchOptions {
  query: string;
  platform?: string;
  official?: boolean;
  limit?: number;
}

export async function searchPlugins(options: PluginSearchOptions): Promise<PluginCatalogEntry[]> {
  const catalog = await fetchPluginCatalog();
  const q = options.query.toLowerCase();
  let results = catalog.plugins.filter((p) => {
    if (options.official && !p.official && !p.name.startsWith('@capacitor/')) return false;
    if (options.platform) {
      const platforms = (p.platforms ?? []).map((x) => x.toLowerCase());
      if (!platforms.includes(options.platform.toLowerCase())) return false;
    }
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q) ||
      (p.keywords ?? []).some((k) => k.toLowerCase().includes(q))
    );
  });
  results = results.sort((a, b) => a.name.localeCompare(b.name));
  if (options.limit) results = results.slice(0, options.limit);
  return results;
}
