import { writeError } from './logging';
import { ExtensionSetting, getExtSetting } from './workspace-state';

export function apiKey() {
  const key = getExtSetting(ExtensionSetting.aiKey);
  if (!key) {
    writeError(`A key is require to use AI Chat. Set it in settings.`);
    return undefined;
  }
  return key;
}
