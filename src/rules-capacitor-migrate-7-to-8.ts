import { isGreaterOrEqual, isLess } from './analyzer';
import { CapacitorMigrationOptions, migrateCapacitor } from './capacitor-migrate';
import { Project } from './project';
import { Tip, TipType } from './tip';
import { getPackageVersion } from './analyzer';
import { exState } from './tree-provider';

export function suggestCapacitorMigration7To8(project: Project) {
  suggestCapacitorMigration('7.0.0', '8.0.0', TipType.Capacitor, project, {
    coreVersion: '8.0.0',
    versionTitle: '8',
    versionFull: '8.0.0',
    changesLink: 'https://capacitorjs.com/docs/updating/8-0',
    androidStudioMin: '242.23339.11',
    androidStudioName: 'Android Studio Otter (2025.2.1)',
    androidStudioReason: '(It comes with Gradle 8.14.3)',
    minJavaVersion: 21,
    migrateInfo:
      'Capacitor 8 requires NodeJS 22+, xCode 26+, sets a deployment target of iOS 15 and Android 16 (SDK 36), and uses SPM by default for new iOS projects.',
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
      '@capacitor/background-runner',
      '@capacitor/barcode-scanner',
      '@capacitor/browser',
      '@capacitor/camera',
      '@capacitor/clipboard',
      '@capacitor/cookies',
      '@capacitor/device',
      '@capacitor/dialog',
      '@capacitor/file-transfer',
      '@capacitor/file-viewer',
      '@capacitor/filesystem',
      '@capacitor/geolocation',
      '@capacitor/google-maps',
      '@capacitor/haptics',
      '@capacitor/http',
      '@capacitor/inappbrowser',
      '@capacitor/keyboard',
      '@capacitor/local-notifications',
      '@capacitor/motion',
      '@capacitor/network',
      '@capacitor/preferences',
      '@capacitor/privacy-screen',
      '@capacitor/push-notifications',
      '@capacitor/screen-orientation',
      '@capacitor/screen-reader',
      '@capacitor/share',
      '@capacitor/splash-screen',
      '@capacitor/status-bar',
      '@capacitor/system-bars',
      '@capacitor/text-zoom',
      '@capacitor/toast',
      '@capacitor/watch',
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
