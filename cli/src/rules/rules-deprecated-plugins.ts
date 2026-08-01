import { Project } from '../project/project';
import { FindingCollector } from './finding';
import { deprecatedPlugin, recommendRemove } from './factories';

export function checkDeprecatedPlugins(project: Project, collector: FindingCollector): void {
  deprecatedPlugin(
    project,
    collector,
    'adobe-mobile-services',
    'Mobile Services reaches end-of-life on December 31, 2022',
    'https://experienceleague.adobe.com/docs/mobile-services/using/eol.html?lang=en',
  );

  deprecatedPlugin(
    project,
    collector,
    'cordova-plugin-crop',
    'cordova-plugin-crop is deprecated and does not support Android 11+',
    'https://github.com/jeduan/cordova-plugin-crop#readme',
  );

  deprecatedPlugin(
    project,
    collector,
    'cordova-plugin-appcenter-analytics',
    'App Center is deprecating support for Cordova SDK in April 2022',
    'https://devblogs.microsoft.com/appcenter/announcing-apache-cordova-retirement',
  );
  deprecatedPlugin(
    project,
    collector,
    'cordova-plugin-appcenter-crashes',
    'App Center is deprecating support for Cordova SDK in April 2022',
    'https://devblogs.microsoft.com/appcenter/announcing-apache-cordova-retirement',
  );
  deprecatedPlugin(
    project,
    collector,
    'cordova-plugin-appcenter-shared',
    'App Center is deprecating support for Cordova SDK in April 2022',
    'https://devblogs.microsoft.com/appcenter/announcing-apache-cordova-retirement',
  );

  deprecatedPlugin(
    project,
    collector,
    'cordova-plugin-contacts',
    'Consider migration to @capacitor-community/contacts',
  );

  deprecatedPlugin(
    project,
    collector,
    '@ionic-enterprise/offline-storage',
    'Replace this plugin with @ionic-enterprise/secure-storage',
  );

  recommendRemove(
    project,
    collector,
    'jetifier',
    'jetifier',
    'This tool was used to transition non-AndroidX libraries. By now though all plugins support Android 10 and this tool should be removed.',
  );
}
