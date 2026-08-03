import { Project } from '../project/project';
import { createCollector, Finding } from './finding';
import { recommendRemove } from './factories';
import { checkCapacitorRules } from './rules-capacitor';
import { checkCordovaPlugins, checkCordovaRules } from './rules-cordova';
import { checkDeprecatedPlugins } from './rules-deprecated-plugins';
import { checkIonicNativePackages } from './rules-ionic-native';
import { checkPackages, checkRemoteDependencies } from './rules-packages';
import { checkDeprecatedTsconfig } from './rules-typescript-config';
import { checkWebProject } from './rules-web-project';

export async function runChecks(project: Project, packages: Record<string, any> = {}): Promise<Finding[]> {
  const collector = createCollector();

  checkDeprecatedTsconfig(project, collector);
  checkPackages(project, collector);

  for (const deprecated of project.analyzer.deprecatedPackages(packages)) {
    recommendRemove(
      project,
      collector,
      deprecated.name,
      deprecated.name,
      `${deprecated.name} is deprecated: ${deprecated.message}`,
    );
  }

  checkRemoteDependencies(project, collector);
  checkDeprecatedPlugins(project, collector);

  if (project.isCordova) {
    checkCordovaRules(project, collector);
  }

  if (project.isCapacitor) {
    await checkCapacitorRules(project, collector);
    checkIonicNativePackages(packages, project, collector);
    checkCordovaPlugins(packages, project, collector);
  }

  if (!project.isCapacitor && !project.isCordova) {
    checkWebProject(project, collector);
  }

  return collector.findings;
}
