import { enableProdMode } from '@angular/core';
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeCheckbox,
  vsCodeDivider,
  vsCodeLink,
  vsCodePanelView,
  vsCodeProgressRing,
  vsCodeRadio,
  vsCodeRadioGroup,
  vsCodeTag,
  vsCodeTextField,
} from '@vscode/webview-ui-toolkit';
import { environment } from './environments/environment';
import { AppComponent } from './app/app.component';
import { bootstrapApplication } from '@angular/platform-browser';

if (environment.production) {
  enableProdMode();
}

// In order to use the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeTextField(),
  vsCodePanelView(),
  vsCodeLink(),
  vsCodeTag(),
  vsCodeCheckbox(),
  vsCodeDivider(),
  vsCodeRadio(),
  vsCodeRadioGroup(),
  vsCodeProgressRing(),
);

bootstrapApplication(AppComponent).catch((err) => console.error(err));
