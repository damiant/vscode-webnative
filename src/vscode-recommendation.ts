import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';

export function checkRecommendedExtensions(folder: string): void {
  const recFile = join(folder, '.vscode', 'extensions.json');
  if (getSetting(WorkspaceSetting.recCheck) == true) {
    return;
  }
  if (existsSync(recFile)) {
    const data = readFileSync(recFile, 'utf8');
    const jsonData = JSON.parse(data);
    jsonData.recommendations = jsonData.recommendations.filter((ext: string) => ext !== 'ionic.ionic');
    jsonData.recommendations.push('Webnative.webnative');
    writeFileSync(recFile, JSON.stringify(jsonData, null, 2), 'utf8');
  }
  setSetting(WorkspaceSetting.recCheck, true);
}

export function recommendWebNativeExtension(folder: string): void {
  const recFile = join(folder, '.vscode', 'extensions.json');
  try {
    if (!existsSync(recFile)) {
      const data = {
        recommendations: ['Webnative.webnative'],
      };
      writeFileSync(recFile, JSON.stringify(data, null, 2), 'utf8');
    } else {
      const data = readFileSync(recFile, 'utf8');
      const jsonData = JSON.parse(data);
      if (jsonData.recommendations) {
        if (jsonData.recommendations.includes('ionic.ionic')) {
          jsonData.recommendations = jsonData.recommendations.filter((r) => r !== 'ionic.ionic');
        }
        if (!jsonData.recommendations.includes('Webnative.webnative')) {
          jsonData.recommendations.push('Webnative.webnative');
          writeFileSync(recFile, JSON.stringify(jsonData, null, 2), 'utf8');
        }
      }
    }
  } catch (e) {
    console.error('Error updating extension recommendations', e);
  }
}
