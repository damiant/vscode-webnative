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
  expect(await project.parse()).toBeUndefined();
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
// test("IOS project has a bundle id", async () => {
// 	const project = new IosProject("ios/App/App.xcodeproj");
// 	await project.parse();
// 	const appTargets = project.getAppTargets();
// 	for (const target of appTargets) {
// 		expect(project.getBundleId(target.name)).toBe("scratch.ts");
// 	}
// });
