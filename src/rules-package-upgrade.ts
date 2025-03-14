import { fixIssue } from './extension';
import { npmInstall } from './node-commands';
import { Tip } from './tip';
import { getRunOutput, showProgress } from './utilities';
import { QuickPickItem, window } from 'vscode';
import { QuickPickItemKind } from 'vscode';

interface PackageInfo {
  name: string;
  version: string;
}
/**
 * Upgrade a package by allowing a user to select from the available versions
 * @param  {PackageInfo} info
 * @param  {string} folder
 */
export async function packageUpgrade(info: PackageInfo, folder: string): Promise<boolean> {
  let txt = '';
  await showProgress(`Finding versions of ${info.name}`, async () => {
    txt = await getRunOutput(`npm view ${info.name} versions --json`, folder);
  });
  const versions: Array<string> = JSON.parse(txt).reverse();
  const idx = versions.findIndex((version) => info.version == version);
  versions.splice(idx, 1);
  const picks: QuickPickItem[] = [];
  const betas: string[] = [];
  picks.push({ label: 'Releases', kind: QuickPickItemKind.Separator });
  for (const version of versions) {
    if (version.includes('-')) {
      betas.push(version);
    } else {
      picks.push({ label: version });
    }
  }
  if (betas.length > 0) {
    picks.push({ label: 'Betas', kind: QuickPickItemKind.Separator });
    for (const version of betas) {
      picks.push({ label: version });
    }
  }
  const selection: QuickPickItem = await window.showQuickPick(picks, {
    placeHolder: `Update to version of ${info.name}`,
  });
  if (!selection) return;

  const message = `Update ${info.name} to ${selection.label}`;
  await fixIssue(
    npmInstall(`${info.name}@${selection.label}`),
    folder,
    undefined,
    new Tip(message, undefined).showProgressDialog(),
    undefined,
    message,
  );
  return true;
}
