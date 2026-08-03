import { existsSync } from 'fs';
import { Project } from '../project/project';
import { FindingCollector } from './finding';
import {
  checkMinVersion,
  checkNotExists,
  hasNodeModules,
  note,
  recommendAdd,
  recommendRemove,
  recommendReplace,
  warnMinVersion,
} from './factories';
import { npmInstallAll, commandContext } from '../build/node-commands';

/**
 * General rules for packages like momentjs, jquery, etc.
 */
export function checkPackages(project: Project, collector: FindingCollector): void {
  const nmf = project.getNodeModulesFolder();
  const nodeModulesPresent = existsSync(nmf) || project.isModernYarn();
  if (!nodeModulesPresent) {
    collector.add({
      id: 'missing-node-modules',
      severity: 'info',
      category: 'packages',
      title: 'Install node modules',
      detail: 'node_modules is missing. Install dependencies before building or running the project.',
      fixable: true,
      fix: { id: 'missing-node-modules', command: npmInstallAll(commandContext(project)) },
    });
  }

  recommendReplace(
    project,
    collector,
    'moment',
    'momentjs',
    'Migrate the deprecated moment.js to date-fns',
    'Migrate away from the deprecated library moment. A good replacement is date-fns which is significantly smaller and built for modern tooling (https://date-fns.org/)',
    'date-fns',
  );

  recommendRemove(
    project,
    collector,
    'jquery',
    'jQuery',
    'Refactor your code to remove the dependency on jquery. Much of the API for Jquery is now available in browsers and often Jquery code conflicts with code written in your framework of choice.',
  );

  recommendRemove(
    project,
    collector,
    'rxjs-compat',
    'rxjs-compat',
    'Migrate your code from rxjs v5 to v6+ so that rxjs-compat is not necessary.',
    undefined,
    'https://ncjamieson.com/avoiding-rxjs-compat/',
  );

  if (
    project.analyzer.exists('@ionic-enterprise/identity-vault') &&
    project.analyzer.exists('cordova-plugin-android-fingerprint-auth')
  ) {
    recommendRemove(
      project,
      collector,
      'cordova-plugin-android-fingerprint-auth',
      'cordova-plugin-android-fingerprint-auth',
      'This plugin should be removed as it cannot be used in conjunction with Identity Vault (which provides the same functionality).',
    );
  }

  recommendRemove(
    project,
    collector,
    'node-sass',
    'node-sass',
    'The dependency node-sass is deprecated and should be removed from package.json.',
  );

  if (
    project.analyzer.exists('cordova-plugin-file-opener2') &&
    project.analyzer.isLessOrEqual('cordova-plugin-file-opener2', '3.0.5')
  ) {
    recommendRemove(
      project,
      collector,
      'cordova-plugin-file-opener2',
      'cordova-plugin-file-opener2',
      'Your project uses cordova-plugin-file-opener2 which will be rejected from the Play Store due to use of REQUEST_INSTALL_PACKAGES permission. Upgrade to version 4+',
    );
  }

  if (project.analyzer.exists('ionic-angular')) {
    if (project.analyzer.exists('@ionic/angular')) {
      recommendRemove(
        project,
        collector,
        'ionic-angular',
        'ionic-angular',
        'Your project has 2 versions of Ionic Angular installed (ionic-angular and @ionic/angular). You should remove ionic-angular',
      );
    } else {
      note(
        project,
        collector,
        '@ionic/angular',
        'Your Ionic project should be migrated to @ionic/angular version 5 or higher',
        'https://ionicframework.com/docs/reference/migration#migrating-from-ionic-3-0-to-ionic-4-0',
      );
    }
  }

  warnMinVersion(
    project,
    collector,
    '@angular/core',
    '10.0.0',
    '. Your version is no longer supported.',
    'https://angular.io/guide/releases#support-policy-and-schedule',
    'angular',
  );

  if (!project.analyzer.exists('@awesome-cordova-plugins/core')) {
    const matching = project.analyzer.matchingBeginingWith('@awesome-cordova-plugins');
    if (matching.length > 0) {
      recommendAdd(
        project,
        collector,
        '@awesome-cordova-plugins/core',
        '@awesome-cordova-plugins/core',
        'Missing @awesome-cordova-plugins/core',
        'You are using awesome-cordova-plugins which require @awesome-cordova-plugins/core.',
        false,
      );
    }
  }

  if (project.analyzer.isGreaterOrEqual('@angular/core', '11.0.0')) {
    checkNotExists(
      project,
      collector,
      'codelyzer',
      'was popular in Angular projects before version 11 but has been superceded by angular-eslint. You can remove this dependency.',
      'angular',
    );
  }
}

export function checkRemoteDependencies(project: Project, collector: FindingCollector): void {
  const packages = project.analyzer.remotePackages();
  if (packages.length > 0) {
    collector.add({
      id: 'remote-dependencies',
      severity: 'warning',
      category: 'packages',
      title: 'Remote dependencies detected',
      detail: `Using dependencies from locations like github or http mean that no 2 builds are guaranteed to produce the same binary. These packages should use versioned dependencies: ${packages.join(', ')}`,
      fixable: false,
    });
  }
}

export { hasNodeModules };
