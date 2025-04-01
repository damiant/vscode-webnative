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

test('Android project parses', async () => {
  const project = new AndroidProject(exampleProject());
  expect(await project.parse()).toBeUndefined();
});

test('Android project has a display name', async () => {
  const project = new AndroidProject(exampleProject());
  await project.parse();
  expect(project.getDisplayName()).toBe('Scratch');
});

test('Android project has a package name', async () => {
  const project = new AndroidProject(exampleProject());
  await project.parse();
  expect(project.getPackageName()).toBe('scratch.ts');
});

test('Android project has a version name', async () => {
  const project = new AndroidProject(exampleProject());
  await project.parse();
  expect(project.getVersionName()).toBe('1.0');
});

test('Android project has a version code', async () => {
  const project = new AndroidProject(exampleProject());
  await project.parse();
  expect(project.getVersionCode()).toBe(1);
});

test('Android project change package name', async () => {
  const project = new AndroidProject(exampleProject());
  await project.parse();
  await project.setPackageName('com.example.scratch');
  expect(project.getPackageName()).toBe('com.example.scratch');
  await project.setPackageName('scratch.ts');
});

test('Android project set version name', async () => {
  const project = new AndroidProject(exampleProject());
  await project.parse();
  await project.setVersionName('1.1');
  expect(project.getVersionName()).toBe('1.1');
  await project.setVersionName('1.0');
});

test('Android project set version code', async () => {
  const project = new AndroidProject(exampleProject());
  await project.parse();
  await project.setVersionCode(2);
  expect(project.getVersionCode()).toBe(2);
  await project.setVersionCode(1);
});

test('Android project set display name', async () => {
  const project = new AndroidProject(exampleProject());
  await project.parse();
  project.setDisplayName('Scratch 2');
  expect(project.getDisplayName()).toBe('Scratch 2');
  project.setDisplayName('Scratch');
});
