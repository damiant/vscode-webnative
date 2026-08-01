export interface NpmInfo {
  name: string;
  version: string;
  time?: Record<string, string>;
  repository?: { type: string; url: string };
  'dist-tags'?: { latest?: string; next?: string };
  versions?: Record<string, { peerDependencies?: Record<string, string> }>;
  bugs?: { url?: string };
  description?: string;
  author?: { name: string; email?: string; url?: string } | string;
  keywords?: string[];
  license?: string | { type: string; url?: string };
}

export async function getNpmInfo(name: string, latest: boolean): Promise<NpmInfo> {
  const url = latest ? `https://registry.npmjs.org/${name}/latest` : `https://registry.npmjs.org/${name}`;
  try {
    const np = (await httpGet(url, npmHeaders())) as NpmInfo;
    if (!np.name) throw new Error(`No name found in ${url}`);
    np.version = np['dist-tags']?.latest ?? np.version;
    return np;
  } catch (error) {
    const msg = `${error}`;
    if (!msg.includes("'Not found'")) {
      console.error(`getNpmInfo failed ${url}`, error);
    }
    return {} as NpmInfo;
  }
}

function npmHeaders(): RequestInit {
  const token = process.env.DATA_SCRIPTS_NPM_TOKEN;
  const headers: Record<string, string> = {
    'User-Agent': 'WebNative CLI',
    Accept: '*/*',
  };
  if (token) headers.Authorization = `bearer ${token}`;
  return { headers };
}

async function httpGet(url: string, opts: RequestInit): Promise<unknown> {
  const response = await fetch(url, opts);
  const data = await response.json();
  if (rateLimited(data)) {
    console.error(`The api call ${url} was rate limited.`);
  }
  return data;
}

function rateLimited(a: unknown): boolean {
  const msg = (a as { message?: string })?.message;
  return !!msg?.startsWith('API rate limit exceeded') || !!msg?.startsWith('You have exceeded a secondary rate limit');
}
