import { Project } from '../project/project';
import { FindingCollector } from './finding';
import { npx } from '../build/node-commands';

export function checkCapacitorPluginMigration(project: Project, collector: FindingCollector): void {
  suggestCapacitorPluginMigration(project, collector, '6.0.0', '7.0.0', {
    changesLink: 'https://capacitorjs.com/docs/updating/plugins/7-0',
    migrateCommand: '@capacitor/plugin-migration-v6-to-v7@latest',
  });
  suggestCapacitorPluginMigration(project, collector, '5.0.0', '6.0.0', {
    changesLink: 'https://capacitorjs.com/docs/updating/plugins/6-0',
    migrateCommand: '@capacitor/plugin-migration-v5-to-v6@latest',
  });

  if (
    project.analyzer.isGreaterOrEqual('@capacitor/core', '4.0.0') &&
    project.analyzer.isLess('@capacitor/core', '5.0.0')
  ) {
    collector.add({
      id: 'capacitor-plugin-migrate-to-5',
      severity: 'error',
      category: 'capacitor',
      title: 'Migrate Capacitor plugin to version 5',
      detail: 'Your Capacitor 4 plugin can be migrated to Capacitor 5.',
      url: 'https://capacitorjs.com/docs/updating/plugins/5-0',
      fixable: true,
      fix: {
        id: 'capacitor-plugin-migrate-to-5',
        command: `${npx(project)} @capacitor/plugin-migration-v4-to-v5@latest`,
      },
    });
  }
}

function suggestCapacitorPluginMigration(
  project: Project,
  collector: FindingCollector,
  minCapacitorCore: string,
  maxCapacitorCore: string,
  migrateOptions: { changesLink: string; migrateCommand: string },
): void {
  if (project.analyzer.isLess('@capacitor/core', maxCapacitorCore)) {
    if (project.analyzer.isGreaterOrEqual('@capacitor/core', minCapacitorCore)) {
      const id = `capacitor-plugin-migrate-to-${maxCapacitorCore.replace(/\./g, '-')}`;
      collector.add({
        id,
        severity: 'info',
        category: 'capacitor',
        title: `Migrate Capacitor plugin to ${maxCapacitorCore}`,
        detail: `This Capacitor plugin can be migrated from ${minCapacitorCore} to version ${maxCapacitorCore}.`,
        url: migrateOptions.changesLink,
        fixable: true,
        fix: {
          id,
          command: `${npx(project)} ${migrateOptions.migrateCommand}`,
        },
      });
    }
  }
}
