import { expect, test } from 'vitest';
import { getServeScriptArgumentSeparator } from '../src/web-run';
import { PackageManager } from '../src/node-commands';

test('omits the script argument separator for Yarn on Windows', () => {
  expect(getServeScriptArgumentSeparator(PackageManager.yarn, 'win32')).toBe(' ');
});

test('keeps the script argument separator for other package managers on Windows', () => {
  expect(getServeScriptArgumentSeparator(PackageManager.npm, 'win32')).toBe(' -- ');
});

test('keeps the script argument separator for Yarn on other platforms', () => {
  expect(getServeScriptArgumentSeparator(PackageManager.yarn, 'linux')).toBe(' -- ');
});
