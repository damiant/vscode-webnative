import { existsSync } from 'fs';
import { TextDocument } from 'vscode';
import { autoFixAngularImports } from './imports-angular';

enum Framework {
  Angular,
  React,
  Vue,
  Unknown,
}

export const IonicComponents = [
  'ion-action-sheet',
  'ion-accordion',
  'ion-accordion-group',
  'ion-alert',
  'ion-badge',
  'ion-breadcrumb',
  'ion-button',
  'ion-ripple-effect',
  'ion-card',
  'ion-card-content',
  'ion-card-header',
  'ion-card-subtitle',
  'ion-card-title',
  'ion-checkbox',
  'ion-chip',
  'ion-app',
  'ion-content',
  'ion-datetime',
  'ion-datetime-button',
  'ion-picker',
  'ion-fab',
  'ion-fab-button',
  'ion-fab-list',
  'ion-grid',
  'ion-col',
  'ion-row',
  'ion-infinite-scroll',
  'ion-infinite-scroll-content',
  'ion-icon',
  'ion-input',
  'ion-textarea',
  'ion-item',
  'ion-item-divider',
  'ion-item-group',
  'ion-item-sliding',
  'ion-item-options',
  'ion-item-option',
  'ion-label',
  'ion-note',
  'ion-list',
  'ion-list-header',
  'ion-avatar',
  'ion-img',
  'ion-split-pane',
  'ion-modal',
  'ion-backdrop',
  'ion-nav',
  'ion-nav-link',
  'ion-popover',
  'ion-loading',
  'ion-progress-bar',
  'ion-skeleton-text',
  'ion-spinner',
  'ion-radio',
  'ion-radio-group',
  'ion-range',
  'ion-refresher',
  'ion-refresher-content',
  'ion-reorder',
  'ion-reorder-group',
  'ion-router',
  'ion-router-link',
  'ion-router-outlet',
  'ion-route',
  'ion-route-redirect',
  'ion-searchbar',
  'ion-segment',
  'ion-segment-button',
  'ion-tabs',
  'ion-tab',
  'ion-tab-bar',
  'ion-tab-button',
  'ion-toast',
  'ion-toggle',
  'ion-toolbar',
  'ion-header',
  'ion-footer',
  'ion-title',
  'ion-buttons',
  'ion-back-button',
  'ion-text',
];

export async function autoFixImports(document: TextDocument, component: string): Promise<boolean> {
  let framework = Framework.Unknown;
  // Validate that the file changed was a .html file that also has a .ts file which uses @ionic standalone
  if (document.fileName.endsWith('.html')) {
    const tsFile = document.fileName.replace(new RegExp('.html$'), '.ts');
    if (existsSync(tsFile)) {
      framework = Framework.Angular;
    }
  }
  if (document.fileName.endsWith('.tsx')) {
    framework = Framework.React; // React already has import completion (so we dont do anything with it)
  }

  switch (framework) {
    case Framework.Angular:
      return await autoFixAngularImports(document, component);
    default:
      return false;
  }
}
