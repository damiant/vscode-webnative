import { getPackageVersion, isGreaterOrEqual, isLess } from './analyzer';
import { showOutput, write, writeIonic } from './logging';
import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { window } from 'vscode';
import { openUri, showProgress } from './utilities';
import { npx } from './node-commands';
import { ActionResult } from './command-name';
import { ionicState } from './wn-tree-provider';

export interface CapacitorPluginMigrationOptions {
  changesLink: string;
  migrateCommand: string;
}

export function checkCapacitorPluginMigration(project: Project) {
  suggestCapacitorPluginMigration('6.0.0', '7.0.0', TipType.Capacitor, project, {
    changesLink: 'https://capacitorjs.com/docs/updating/plugins/7-0',
    migrateCommand: '@capacitor/plugin-migration-v6-to-v7@latest',
  });
  suggestCapacitorPluginMigration('5.0.0', '6.0.0', TipType.Capacitor, project, {
    changesLink: 'https://capacitorjs.com/docs/updating/plugins/6-0',
    migrateCommand: '@capacitor/plugin-migration-v5-to-v6@latest',
  });

  if (isGreaterOrEqual('@capacitor/core', '4.0.0') && isLess('@capacitor/core', '5.0.0')) {
    // Capacitor 4 to 5 plugin migration
    project.add(
      new Tip('Migrate Plugin to Capacitor 5', undefined, TipType.Error).setQueuedAction(
        migratePluginToCapacitor5,
        project,
      ),
    );
  }
}

export async function migrateCapacitorPlugin(
  queueFunction: QueueFunction,
  project: Project,
  currentVersion: string,
  migrateVersion: string,
  migrateOptions: CapacitorPluginMigrationOptions,
): Promise<ActionResult> {
  const result = await window.showInformationMessage(
    `Migrate this Capacitor Plugin from ${currentVersion} to version ${migrateVersion}?`,
    `Migrate to v${migrateVersion}`,
    'Ignore',
  );
  if (result == 'Ignore') {
    return ActionResult.Ignore;
  }
  if (!result) {
    return;
  }
  queueFunction();
  const cmd = `${npx(project)} ${migrateOptions.migrateCommand}`;
  write(`> ${cmd}`);
  try {
    await showProgress('Migrating Plugin...', async () => {
      await project.run2(cmd, false);
    });
  } finally {
    const message = `Capacitor Plugin migration to v${migrateVersion} completed.`;
    writeIonic(message);
    showOutput();
    const changesTitle = 'View Changes';
    window.showInformationMessage(message, changesTitle, 'OK').then((res) => {
      if (res == changesTitle) {
        openUri(migrateOptions.changesLink);
      }
    });
  }
  //)
}

function suggestCapacitorPluginMigration(
  minCapacitorCore: string,
  maxCapacitorCore: string,
  type: TipType,
  project: Project,
  migrateOptions: CapacitorPluginMigrationOptions,
) {
  if (isLess('@capacitor/core', maxCapacitorCore)) {
    if (ionicState.hasNodeModules && isGreaterOrEqual('@capacitor/core', minCapacitorCore)) {
      project.tip(
        new Tip(`Migrate Capacitor Plugin to ${maxCapacitorCore}`, '', type)
          .setQueuedAction(
            migrateCapacitorPlugin,
            project,
            getPackageVersion('@capacitor/core'),
            maxCapacitorCore,
            migrateOptions,
          )
          .canIgnore(),
      );
    }
  }
}

async function migratePluginToCapacitor5(queueFunction: QueueFunction, project: Project) {
  const txt = 'Migrate Plugin';
  const res = await window.showInformationMessage(
    `Your Capacitor 4 plugin can be migrated to Capacitor 5.`,
    txt,
    'Exit',
  );
  if (!res || res != txt) return;

  queueFunction();
  showOutput();

  await showProgress('Migrating Plugin...', async () => {
    await project.run2('npx @capacitor/plugin-migration-v4-to-v5@latest', false);
    const msg = `Plugin has been migrated. Please read migration docs and verify your plugin before publishing.`;
    writeIonic(msg);
    window.showInformationMessage(msg, 'OK');
  });
}
