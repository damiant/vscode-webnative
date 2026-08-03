import { CapacitorMigrationOptions } from './capacitor';

export const migration4To5: CapacitorMigrationOptions = {
  from: '4.0.0',
  to: '5.0.0',
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
};
