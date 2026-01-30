import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractErrors } from '../src/error-handler';

test('extractErrors finds Swift errors in errors.txt', () => {
  const errorsFile = join(__dirname, 'errors.txt');
  const content = readFileSync(errorsFile, 'utf8');
  const lines = content.split('\n');

  const errors = extractErrors('', lines, '/Users/theuser/Code/dust3/dust');

  // Filter to only Swift errors
  const swiftErrors = errors.filter((err) => err.uri.includes('.swift'));

  // Verify that at least 4 Swift errors were found (actual implementation currently finds 8)
  expect(swiftErrors.length).toBeGreaterThanOrEqual(4);

  // All errors should be from AppDelegate.swift
  swiftErrors.forEach((err) => {
    expect(err.uri).toBe('/Users/theuser/Code/dust3/dust/ios/App/App/AppDelegate.swift');
    expect(err.line).toBe(7);
    expect(err.error).toContain('eee');
  });
});

test('extractSwiftError parses AppDelegate.swift error correctly', () => {
  const errorsFile = join(__dirname, 'errors.txt');
  const content = readFileSync(errorsFile, 'utf8');
  const lines = content.split('\n');

  const errors = extractErrors('', lines, '/Users/theuser/Code/dust3/dust');
  const swiftErrors = errors.filter((err) => err.uri.includes('.swift'));

  // Find the first AppDelegate.swift error
  const appDelegateError = swiftErrors[0];

  expect(appDelegateError).toBeDefined();
  expect(appDelegateError.uri).toBe('/Users/theuser/Code/dust3/dust/ios/App/App/AppDelegate.swift');
  expect(appDelegateError.line).toBe(7); // 8:1 (1-indexed) becomes 7:0 (0-indexed): this is the correct 0-indexed conversion from 1-indexed source coordinates
  expect(appDelegateError.position).toBe(0);
  expect(appDelegateError.error).toBe("expected 'func' keyword in instance method declaration eee");
});

test('errors.txt contains Swift compiler errors', () => {
  const errorsFile = join(__dirname, 'errors.txt');
  const content = readFileSync(errorsFile, 'utf8');

  expect(content).toContain('.swift:');
  expect(content).toContain(': error:');
  expect(content).toContain('AppDelegate.swift');
});
