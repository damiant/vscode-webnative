import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadConfig, saveConfig, projectConfigPath, getConfigDefaults } from '../src/core/config';
import { createDefaultGlobalOptions } from '../src/cli/args';

describe('config precedence', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wn-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('uses defaults when no files exist', () => {
    const cfg = loadConfig(tmp, createDefaultGlobalOptions());
    expect(cfg.defaultPort).toBe(8100);
    expect(cfg.buildForProduction).toBe(false);
  });

  it('project wn.json overrides defaults', () => {
    saveConfig(projectConfigPath(tmp), { defaultPort: 4200 });
    const cfg = loadConfig(tmp, createDefaultGlobalOptions());
    expect(cfg.defaultPort).toBe(4200);
  });

  it('CLI packageManager flag overrides wn.json', () => {
    saveConfig(projectConfigPath(tmp), { packageManager: 'npm' });
    const opts = createDefaultGlobalOptions();
    opts.packageManager = 'pnpm';
    const cfg = loadConfig(tmp, opts);
    expect(cfg.packageManager).toBe('pnpm');
  });

  it('exposes defaults separately', () => {
    expect(getConfigDefaults().defaultPort).toBe(8100);
  });
});
