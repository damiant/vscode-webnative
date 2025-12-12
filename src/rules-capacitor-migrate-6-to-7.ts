import { isGreaterOrEqual, isLess } from './analyzer';
import { CapacitorMigrationOptions, migrateCapacitor } from './capacitor-migrate';
import { Project } from './project';
import { Tip, TipType } from './tip';
import { getPackageVersion } from './analyzer';
import { exState } from './tree-provider';

export function suggestCapacitorMigration6To7(project: Project) {
  suggestCapacitorMigration('6.0.0', '7.0.0', TipType.Capacitor, project, {
    coreVersion: '7.0.1',
    versionTitle: '7',
    versionFull: '7.0.0',
    changesLink: 'https://capacitorjs.com/docs/updating/7-0',
    androidStudioMin: '231.9392.1',
    androidStudioName: 'Android Studio Ladybug (2024.2.1)',
    androidStudioReason: '(It comes with Gradle 8.7.2)',
    minJavaVersion: 21,
    migrateInfo: 'Capacitor 7 sets a deployment target of iOS 14 and Android 15 (SDK 35).',
    minPlugins: [
      { dep: '@ionic-enterprise/identity-vault', version: '5.10.1' },
      { dep: '@ionic-enterprise/google-pay', version: '2.0.0' },
      { dep: '@ionic-enterprise/apple-pay', version: '2.0.0' },
      { dep: '@ionic-enterprise/zebra-scanner', version: '2.0.0' },
    ],
    ignorePeerDependencies: [
      '@capacitor/action-sheet',
      '@capacitor/app',
      '@capacitor/app-launcher',
      '@capacitor/browser',
      '@capacitor/camera',
      '@capacitor/clipboard',
      '@capacitor/device',
      '@capacitor/dialog',
      '@capacitor/filesystem',
      '@capacitor/geolocation',
      '@capacitor/haptics',
      '@capacitor/keyboard',
      '@capacitor/local-notifications',
      '@capacitor/motion',
      '@capacitor/network',
      '@capacitor/preferences',
      '@capacitor/push-notifications',
      '@capacitor/screen-reader',
      '@capacitor/screen-orientation',
      '@capacitor/share',
      '@capacitor/splash-screen',
      '@capacitor/status-bar',
      '@capacitor/text-zoom',
      '@capacitor/toast',
    ],
  });
}

function suggestCapacitorMigration(
  minCapacitorCore: string,
  maxCapacitorCore: string,
  type: TipType,
  project: Project,
  migrateOptions: CapacitorMigrationOptions,
) {
  if (isLess('@capacitor/core', maxCapacitorCore)) {
    if (exState.hasNodeModules && isGreaterOrEqual('@capacitor/core', minCapacitorCore)) {
      project.tip(
        new Tip(`Migrate to Capacitor ${migrateOptions.versionTitle}`, '', type)
          .setQueuedAction(migrateCapacitor, project, getPackageVersion('@capacitor/core'), migrateOptions)
          .canIgnore(),
      );
    }
  }
}
