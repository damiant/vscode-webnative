import { exists } from './analyzer';
import { MonoRepoType } from './monorepo';
import { npmRun } from './node-commands';
import { Project } from './project';
import { Tip, TipType } from './tip';
import { getPackageJSON, PackageFile } from './utilities';

// Look in package.json for scripts and add options to execute
export function addScripts(project: Project) {
  const expand = !(exists('@capacitor/core') || exists('cordova-ios') || exists('cordova-android'));
  project.setGroup(`Scripts`, `The scripts from package.json`, TipType.Files, expand);

  addScriptsFrom(getPackageJSON(project.projectFolder()), project);

  if (project.repoType == MonoRepoType.nx) {
    addScriptsFrom(getPackageJSON(project.folder), project);
    addNXScripts(['build', 'test', 'lint', 'e2e'], project);
  }
}

function addScriptsFrom(packages: PackageFile, project: Project) {
  if (packages.scripts) {
    for (const script of Object.keys(packages.scripts)) {
      project.add(
        new Tip(script, '', TipType.Run, '', npmRun(script), `Running ${script}`, `Ran ${script}`)
          .canStop()
          .canAnimate()
          .setTooltip(`Runs 'npm run ${script}' found in package.json`),
      );
    }
  }

  // We may be able to migrate a Capacitor Plugin
  project.isCapacitorPlugin = !!(packages.capacitor?.ios || packages.capacitor?.android);
}

function addNXScripts(names: Array<string>, project: Project) {
  for (const name of names) {
    project.add(
      new Tip(
        `${project.monoRepo.name} ${name}`,
        '',
        TipType.Run,
        '',
        `npx nx run ${project.monoRepo.name}:${name}`,
        `Running ${name}`,
        `Ran ${name}`,
      ),
    );
  }
}
