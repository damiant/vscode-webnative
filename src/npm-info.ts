import { NpmInfo } from './npm-info-data';

export async function getNpmInfo(name: string, latest: boolean): Promise<NpmInfo> {
  let url = '';
  try {
    url = latest ? `https://registry.npmjs.org/${name}/latest` : `https://registry.npmjs.org/${name}`;
    const np: NpmInfo = await httpGet(url, npmHeaders());
    if (!np.name) throw new Error(`No name found in ${url}`); // This error is happening for some reason
    //np.versions = undefined;
    np.version = np['dist-tags'] ? np['dist-tags'].latest : np.version;
    return np;
  } catch (error) {
    const msg = `${error}`;
    if (msg.includes(`'Not found'`)) {
      console.error(`[error] ${name} was not found on npm.`);
    } else {
      console.error(`getNpmInfo Failed ${url}`, error);
    }
    return {} as NpmInfo;
  }
}

function npmHeaders(): any {
  return {
    headers: {
      Authorization: `bearer ${getNpmToken()}`,
      'User-Agent': 'Ionic VSCode Extension',
      Accept: '*/*',
    },
  };
}

export async function httpGet(url: string, opts: any): Promise<any> {
  const response = await fetch(url, opts);
  try {
    const data = await response.json();
    if (rateLimited(data)) {
      console.log(`The api call ${url} was rate limited.`);
    }
    return data;
  } catch (error) {
    throw new Error(`Error: get ${url}: ${response.status} ${response.statusText}`);
  }
}

function rateLimited(a: any): boolean {
  return (
    (a as any).message?.startsWith('API rate limit exceeded') ||
    (a as any).message?.startsWith('You have exceeded a secondary rate limit')
  );
}

export function getNpmToken() {
  return process.env.DATA_SCRIPTS_NPM_TOKEN;
}
