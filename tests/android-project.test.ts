import { expect, test } from 'vitest';
import { AndroidProject } from '../src/native-project-android';
import { join } from 'path';

function exampleProject(): string {
  return join(__dirname, 'android');
}

test('Android project exists', () => {
  const project = new AndroidProject(exampleProject());
  expect(project.exists()).toBe(true);
});
