import { Project } from './project';
import { Command, Tip, TipType } from './tip';
import {
  exists,
  isGreaterOrEqual,
  isLessOrEqual,
  matchingBeginingWith,
  remotePackages,
  warnMinVersion,
} from './analyzer';
import { npmInstallAll, suggestInstallAll } from './node-commands';
import { exState } from './tree-provider';
import { existsSync } from 'fs';

/**
 * General Rules for packages like momentjs, jquery, etc
 * @param  {Project} project
 */
export function checkPackages(project: Project) {
  const nmf = project.getNodeModulesFolder();
  exState.hasNodeModules = true;
  exState.nodeModulesFolder = nmf;
  if (!existsSync(nmf) && !project.isModernYarn()) {
    exState.hasNodeModules = false;
    project.add(
      new Tip(
        'Install Node Modules',
        '',
        TipType.Idea,
        'Install Node Modules',
        npmInstallAll(),
        'Installing Node Modules...',
      )
        .performRun()
        .showProgressDialog(),
    );
    if (!exState.hasNodeModulesNotified) {
      suggestInstallAll(project);
    }
  }

  // Replace momentjs with date-fns
  project.recommendReplace(
    'moment',
    `momentjs`,
    `Migrate the deprecated moment.js to date-fns`,
    `Migrate away from the deprecated library moment. A good replacement is date-fns which is significantly smaller and built for modern tooling (https://date-fns.org/)`,
    'date-fns',
  );

  // Remove jquery
  project.recommendRemove(
    'jquery',
    'jQuery',
    `Refactor your code to remove the dependency on jquery. Much of the API for Jquery is now available in browsers and often Jquery code conflicts with code written in your framework of choice.`,
  );

  // Remove rxjs-compat by migrating v5 to v6+
  project.recommendRemove(
    'rxjs-compat',
    'rxjs-compat',
    `Migrate your code from rxjs v5 to v6+ so that rxjs-compat is not necessary.`,
    undefined,
    'https://ncjamieson.com/avoiding-rxjs-compat/',
  );

  // cordova-plugin-android-fingerprint-auth and Identity Vault clash with a duplicate resources error
  if (exists('@ionic-enterprise/identity-vault') && exists('cordova-plugin-android-fingerprint-auth')) {
    project.recommendRemove(
      'cordova-plugin-android-fingerprint-auth',
      `cordova-plugin-android-fingerprint-auth`,
      `This plugin should be removed as it cannot be used in conjunction with Identity Vault (which provides the same functionality).`,
    );
  }

  // node-sass deprecated and not required
  project.recommendRemove(
    'node-sass',
    'node-sass',
    `The dependency node-sass is deprecated and should be removed from package.json.`,
  );

  if (exists('cordova-plugin-file-opener2') && isLessOrEqual('cordova-plugin-file-opener2', '3.0.5')) {
    project.recommendRemove(
      'cordova-plugin-file-opener2',
      'cordova-plugin-file-opener2',
      'Your project uses cordova-plugin-file-opener2 which will be rejected from the Play Store due to use of REQUEST_INSTALL_PACKAGES permission. Upgrade to version 4+',
    );
  }

  // Ionic 3+
  if (exists('ionic-angular')) {
    if (exists('@ionic/angular')) {
      project.recommendRemove(
        'ionic-angular',
        'ionic-angular',
        'Your project has 2 versions of Ionic Angular installed (ionic-angular and @ionic/angular). You should remove ionic-angular',
      );
    } else {
      project.note(
        '@ionic/angular',
        'Your Ionic project should be migrated to @ionic/angular version 5 or higher',
        'https://ionicframework.com/docs/reference/migration#migrating-from-ionic-3-0-to-ionic-4-0',
      );
    }
  }

  // Angular 10 is in LTS until December 2021
  project.tip(
    warnMinVersion(
      '@angular/core',
      '10.0.0',
      '. Your version is no longer supported.',
      'https://angular.io/guide/releases#support-policy-and-schedule',
    ),
  );

  if (!exists('@awesome-cordova-plugins/core')) {
    const matching = matchingBeginingWith('@awesome-cordova-plugins');
    if (matching.length > 0) {
      project.recommendAdd(
        '@awesome-cordova-plugins/core',
        '@awesome-cordova-plugins/core',
        'Missing @awesome-cordova-plugins/core',
        'You are using awesome-cordova-plugins which require @awesome-cordova-plugins/core.',
        false,
      );
    }
  }

  if (isGreaterOrEqual('@angular/core', '11.0.0')) {
    project.checkNotExists(
      'codelyzer',
      'Codelyzer was popular in Angular projects before version 11 but has been superceded by angular-eslint. You can remove this dependency.',
    );
  }
}

export function checkRemoteDependencies(project: Project) {
  // Look for dependencies that come from github etc
  const packages = remotePackages();
  if (packages.length > 0) {
    project.add(
      new Tip(
        'Remote Dependencies',
        `Your project uses remote dependencies that can change at any time.`,
        TipType.Warning,
        `Using dependencies from locations like github or http mean that no 2 builds are guaranteed to produce the same binary. These packages should use versioned dependencies: ${packages.join(
          ', ',
        )}`,
        Command.NoOp,
      ).canIgnore(),
    );
  }
}
