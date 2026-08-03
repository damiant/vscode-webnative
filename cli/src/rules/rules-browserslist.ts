import { join } from 'path';
import { existsSync } from 'fs';
import { Project } from '../project/project';
import { FindingCollector } from './finding';

function defaultValues(): string[] {
  return ['Chrome >=61', 'ChromeAndroid >=61', 'Firefox >=63', 'Firefox ESR', 'Edge >=79', 'Safari >=13', 'iOS >=13'];
}

export function checkBrowsersList(project: Project, collector: FindingCollector): void {
  try {
    const list = project.analyzer.browsersList();
    if (list.length > 0) {
      if (list.includes('> 0.5%') || list.includes('last 1 version')) {
        collector.add({
          id: 'browserslist-poor-defaults',
          severity: 'info',
          category: 'browserslist',
          title: 'Fix browserslist',
          detail:
            'The browserslist in package.json may cause some older devices to show a white screen due to missing polyfills.',
          fixable: false,
        });
      }
      return;
    }

    const folder = project.projectFolder();
    let filename = join(folder, 'browserslist');
    if (!existsSync(filename)) {
      filename = join(folder, '.browserslistrc');
    }

    if (project.analyzer.exists('@angular/core') && !existsSync(filename)) {
      collector.add({
        id: 'browserslist-missing',
        severity: 'info',
        category: 'browserslist',
        title: 'Set browser support',
        detail:
          'Some older devices will not be supported. Updating your package.json to include browserslist will fix this.',
        fixable: false,
      });
    }
  } catch {
    // ignore
  }
}

export { defaultValues as browsersListDefaults };
