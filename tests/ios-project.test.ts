import { IosProject } from '../src/native-project-ios';
import { join } from 'path';
import { expect, test } from 'vitest';

function exampleIoSProject(): string {
  return join(__dirname, 'ios', 'App');
}

test('IOS project exists', () => {
  const project = new IosProject(exampleIoSProject());
  expect(project.exists()).toBe(true);
});

test('IOS project parses', async () => {
  const project = new IosProject(exampleIoSProject());
  expect(await project.parse()).toBe(true);
});

test('Ios project has a target', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const appTargets = project.getAppTargets();
  expect(appTargets.length).toBeGreaterThan(0);
});

test('Ios project get build configurations', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const appTargets = project.getAppTargets();
  expect(appTargets.length).toEqual(2);
  for (const target of appTargets) {
    const buildConfigs = project.getBuildConfigurations(target.name);
    expect(buildConfigs.length).toEqual(2);
    expect(buildConfigs[0].name).toBe('Debug');
  }
});
test('Get bundle id', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const appTargets = project.getAppTargets();
  for (const target of appTargets) {
    expect(project.getBundleId(target.name)).toBe('scratch.ts');
  }
});

test('Get display name', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const appTargets = project.getAppTargets();
  for (const target of appTargets) {
    expect(await project.getDisplayName()).toBe('Scratch');
  }
});

test('Get version', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const appTargets = project.getAppTargets();
  for (const target of appTargets) {
    for (const buildConfig of project.getBuildConfigurations(target.name)) {
      expect(project.getVersion(target.name, buildConfig.name)).toBe('1.0');
    }
  }
  const target = project.getAppTarget();
  expect(project.getVersion(target.name, 'Release')).toBe('1.0');
  expect(project.getVersion(target.name, 'Debug')).toBe('1.0');
  expect(() => {
    project.getVersion(target.name, 'Stuff');
  }).toThrowError();
});

test('Get build', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const target = project.getAppTarget();
  expect(await project.getBuild(target.name, 'Release')).toBe(1);
});

test('Set version', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const target = project.getAppTarget();
  const originalVersion = project.getVersion(target.name, 'Release');
  project.setVersion(target.name, 'Release', '1.3');
  project.setVersion(target.name, 'Debug', '1.3');
  const project2 = new IosProject(exampleIoSProject());
  await project2.parse();
  expect(project2.getVersion(target.name, 'Debug')).toBe('1.3');
  expect(project2.getVersion(target.name, 'Release')).toBe('1.3');
  project.setVersion(target.name, 'Release', originalVersion);
  project.setVersion(target.name, 'Debug', originalVersion);
});

test('Set build', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const target = project.getAppTarget();
  await project.setBuild(target.name, 'Release', 123);
  expect(await project.getBuild(target.name, 'Release')).toEqual(123);
  await project.setBuild(target.name, 'Release', 1);
});

test('Set Display Name', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const target = project.getAppTarget();
  await project.setDisplayName('ignored', 'ignored', 'Scratch2');
  const project2 = new IosProject(exampleIoSProject());
  await project2.parse();
  expect(await project2.getDisplayName()).toBe('Scratch2');
  await project.setDisplayName('ignored', 'ignored', 'Scratch');
});

test('Set Bundle Id', async () => {
  const project = new IosProject(exampleIoSProject());
  await project.parse();
  const target = project.getAppTarget();
  await project.setBundleId(target.name, 'ignored', 'com.example.scratch');
  const project2 = new IosProject(exampleIoSProject());
  await project2.parse();
  expect(project2.getBundleId(target.name)).toBe('com.example.scratch');
  await project.setBundleId(target.name, 'ignored', 'scratch.ts');
  expect(project.getBundleId(target.name)).toEqual('scratch.ts');
});
// test("IOS project has a bundle id", async () => {
// 	const project = new IosProject("ios/App/App.xcodeproj");
// 	await project.parse();
// 	const appTargets = project.getAppTargets();
// 	for (const target of appTargets) {
// 		expect(project.getBundleId(target.name)).toBe("scratch.ts");
// 	}
// });
