import { loadConfig, projectConfigPath, saveConfig } from '../core/config';
import { GlobalOptions } from '../cli/args';

export function getIgnoredIds(cwd: string, globalOpts: GlobalOptions = { cwd } as GlobalOptions): string[] {
  const config = loadConfig(cwd, globalOpts);
  return config.check?.ignore ?? [];
}

export function addIgnoredId(cwd: string, id: string, globalOpts: GlobalOptions = { cwd } as GlobalOptions): void {
  const config = loadConfig(cwd, globalOpts);
  const ignore = config.check?.ignore ?? [];
  if (!ignore.includes(id)) {
    ignore.push(id);
  }
  saveConfig(projectConfigPath(cwd), { check: { ...config.check, ignore } });
}

export function isIgnored(id: string, ignored: string[]): boolean {
  return ignored.includes(id);
}
