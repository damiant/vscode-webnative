import { describe, expect, it } from 'vitest';
import { parseArgs, flagBool, flagString } from '../src/cli/args';

describe('parseArgs', () => {
  it('parses global flags and tokens', () => {
    const parsed = parseArgs(['info', '--json', '--cwd', '/tmp/app', '--verbose']);
    expect(parsed.tokens).toEqual(['info']);
    expect(parsed.global.json).toBe(true);
    expect(parsed.global.noInput).toBe(true);
    expect(parsed.global.cwd).toBe('/tmp/app');
    expect(parsed.global.verbose).toBe(true);
  });

  it('keeps project name as a positional for new', () => {
    const parsed = parseArgs(['new', 'storefront', '--template', 'vite-react']);
    expect(parsed.tokens).toEqual(['new', 'storefront']);
    expect(flagString(parsed.flags, 'template')).toBe('vite-react');
  });

  it('supports passthrough after --', () => {
    const parsed = parseArgs(['scripts', 'run', 'test', '--', '--coverage']);
    expect(parsed.tokens).toEqual(['scripts', 'run', 'test']);
    expect(parsed.passthrough).toEqual(['--coverage']);
  });

  it('parses boolean command flags', () => {
    const parsed = parseArgs(['build', '--prod', '--no-copy']);
    expect(flagBool(parsed.flags, 'prod')).toBe(true);
    expect(flagBool(parsed.flags, 'no-copy')).toBe(true);
  });
});
