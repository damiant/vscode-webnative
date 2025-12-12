import { isGreaterOrEqual, isLess } from './analyzer';
import { CapacitorMigrationOptions, migrateCapacitor } from './capacitor-migrate';
import { Project } from './project';
import { Tip, TipType } from './tip';
import { getPackageVersion } from './analyzer';
import { exState } from './tree-provider';

export function suggestCapacitorMigration4To5(project: Project) {
  suggestCapacitorMigration('4.0.0', '5.0.0', TipType.Capacitor, project, {
    coreVersion: '5',
    versionTitle: '5',
    versionFull: '5.0.0',
    changesLink: 'https://capacitorjs.com/docs/updating/5-0',
    androidStudioMin: '222.4459.24',
    androidStudioName: 'Android Studio Flamingo (2022.2.1)',
    androidStudioReason: '(It comes with Java 17 and Gradle 8)',
    minJavaVersion: 17,
    migrateInfo: 'Capacitor 5 sets a deployment target of iOS 13 and Android 13 (SDK 33).',
    ignorePeerDependencies: ['@capacitor/'],
    minPlugins: [
      { dep: '@ionic-enterprise/identity-vault', version: '5.10.1' },
      { dep: '@ionic-enterprise/google-pay', version: '2.0.0' },
      { dep: '@ionic-enterprise/apple-pay', version: '2.0.0' },
      { dep: '@ionic-enterprise/zebra-scanner', version: '2.0.0' },
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
