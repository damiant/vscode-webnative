import { getNpmPackageView } from '../packages/peer-dependencies';
import { RunCallback } from '../packages/minor';
import { Project } from '../project/project';

export interface PluginInfo {
  name: string;
  version?: string;
  description?: string;
  author?: unknown;
  bugs?: string;
  keywords?: string[];
  repo?: string;
  license?: string;
  published?: string;
  stars?: number;
  image?: string;
  fork?: boolean;
  compatibleVersion?: string;
}

export async function getPluginInfo(
  name: string,
  project: Project,
  run: RunCallback,
  compatibleVersion?: string,
): Promise<PluginInfo | undefined> {
  if (!name) return undefined;
  try {
    const p = await getNpmPackageView(name, project.projectFolder(), run);
    if (!p?.name) return undefined;
    const gh = p.repository?.url ? await getGHInfo(p.repository.url) : undefined;
    return {
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      bugs: p.bugs?.url,
      keywords: p.keywords,
      repo: cleanRepo(p.repository?.url),
      license: p.license,
      published: p.time?.modified,
      stars: gh?.stargazers_count,
      image: gh?.owner?.avatar_url,
      fork: gh?.fork,
      compatibleVersion,
    };
  } catch {
    return undefined;
  }
}

async function getGHInfo(repo: string): Promise<any> {
  try {
    const part = repo
      .replace('https://github.com/', '')
      .replace('.git', '')
      .replace('ssh://git@', '')
      .replace('git+', '')
      .replace('git://github.com/', '');
    const response = await fetch(`https://api.github.com/repos/${part}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'WebNative CLI' },
    });
    if (!response.ok) return undefined;
    return response.json();
  } catch {
    return undefined;
  }
}

function cleanRepo(url?: string): string | undefined {
  if (!url) return undefined;
  return url
    .replace('git+', '')
    .replace('ssh://git@', '')
    .replace('.git', '')
    .replace('git://github.com/', 'https://github.com/');
}
