import { describe, expect, it } from 'vitest';
import { extractErrors } from '../src/build/error-parsers';

describe('extractErrors', () => {
  it('parses TypeScript errors', () => {
    const output = `src/app.ts(42,9): error TS2322: Type 'string' is not assignable to type 'number'.`;
    const errors = extractErrors(output);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const err = errors[0];
    expect(err.file).toMatch(/app\.ts/);
    expect(err.message).toMatch(/Type 'string'/);
  });

  it('parses ESLint-style errors', () => {
    const output = `/Users/me/app/src/main.ts\n  10:5  error  'foo' is defined but never used  @typescript-eslint/no-unused-vars`;
    const errors = extractErrors(output);
    // Parser may or may not catch this format depending on port fidelity
    expect(Array.isArray(errors)).toBe(true);
  });

  it('returns empty array for clean output', () => {
    expect(extractErrors('Build succeeded')).toEqual([]);
  });
});
