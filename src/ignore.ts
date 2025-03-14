import { ExtensionContext } from 'vscode';
import { Tip } from './tip';

/**
 * Allows recommendations to be ignored. We need to store the recommendation text from the tip
 * @param  {Tip} tip
 * @param  {vscode.ExtensionContext} context
 */
export function ignore(tip: Tip, context: ExtensionContext) {
  const key = 'ignoredRecommendations';
  const txt = `${tip.message}+${tip.title}`;
  const listJSON: string = context.workspaceState.get(key);
  let list = [];

  if (listJSON) {
    list = JSON.parse(listJSON);
  }
  if (!list.includes(txt)) {
    list.push(txt);
  }

  context.workspaceState.update(key, JSON.stringify(list));
}

export function getIgnored(context: ExtensionContext): Array<string> {
  const key = 'ignoredRecommendations';
  const listJSON: string = context.workspaceState.get(key);
  let list = [];
  try {
    list = JSON.parse(listJSON);
    return list;
  } catch {
    return [];
  }
}

export function clearIgnored(context: ExtensionContext) {
  const key = 'ignoredRecommendations';
  context.workspaceState.update(key, undefined);
}

export function excludeIgnoredTips(tips: Array<Tip>, context: ExtensionContext): Array<Tip> {
  const key = 'ignoredRecommendations';
  const listJSON: string = context.workspaceState.get(key);
  let list = [];

  if (listJSON) {
    try {
      list = JSON.parse(listJSON);
      return tips.filter((tip) => {
        return tip && !list.includes(`${tip.message}+${tip.title}`);
      });
    } catch {
      context.workspaceState.update(key, '[]');
      return tips;
    }
  } else {
    return tips;
  }
}
