import { isGreaterOrEqual, isLess } from './analyzer';
import { CapacitorMigrationOptions, migrateCapacitor } from './capacitor-migrate';
import { Project } from './project';
import { Tip, TipType } from './tip';
import { getPackageVersion } from './analyzer';
import { exState } from './tree-provider';

export function suggestCapacitorMigration5To6(project: Project) {
  suggestCapacitorMigration('5.0.0', '6.0.0', TipType.Capacitor, project, {
    coreVersion: '6.0.0',
    versionTitle: '6',
    versionFull: '6.0.0',
    changesLink: 'https://capacitorjs.com/docs/updating/6-0',
    androidStudioMin: '231.9392.1',
    androidStudioName: 'Android Studio Hedgehog (2023.1.1)',
    androidStudioReason: '(It comes with Gradle 8.2)',
    minJavaVersion: 17,
    migrateInfo: 'Capacitor 6 sets a deployment target of iOS 13 and Android 14 (SDK 34).',
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
