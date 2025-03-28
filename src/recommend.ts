import { deprecatedPackages, exists, isGreaterOrEqual } from './analyzer';
import { reviewCapacitorConfig } from './capacitor-configure';
import { build } from './build';
import { serve } from './ionic-serve';
import { Project } from './project';
import { addSplashAndIconFeatures } from './splash-icon';
import { QueueFunction, RunPoint, RunStatus, Tip, TipFeature, TipType } from './tip';
import { capacitorMigrationChecks as checkCapacitorMigrationRules } from './rules-capacitor-migration';
import { reviewPackages } from './process-packages';
import { capacitorDevicesCommand, capacitorRun } from './capacitor-run';
import { capacitorRecommendations, checkCapacitorRules } from './rules-capacitor';
import { checkCordovaPlugins, checkCordovaRules } from './rules-cordova';
import { webProject } from './rules-web-project';
import { checkPackages, checkRemoteDependencies } from './rules-packages';
import { checkDeprecatedPlugins } from './rules-deprecated-plugins';
import { capacitorSync } from './capacitor-sync';
import { capacitorOpen } from './capacitor-open';
import { CapacitorPlatform } from './capacitor-platform';
import { addScripts } from './scripts';
import { Context } from './context-variables';
import { exState } from './wn-tree-provider';
import { getAndroidWebViewList } from './android-debug-list';
import { getDebugBrowserName } from './preview';
import { checkIonicNativePackages } from './rules-ionic-native';
import { alt, getRunOutput, showProgress, tEnd, tStart } from './utilities';
import { startStopLogServer } from './log-server';
import { getConfigurationName } from './build-configuration';
import { liveReloadSSL } from './live-reload';
import { npmInstall, npmUninstall, PackageManager } from './node-commands';
import { capacitorBuild } from './capacitor-build';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { updateMinorDependencies } from './update-minor';
import { audit } from './audit';
import { analyzeSize } from './analyze-size';
import { ionicExport } from './ionic-export';
import { angularGenerate } from './angular-generate';
import { LoggingSettings } from './log-settings';
import { writeWN } from './logging';
import { cancelLastOperation } from './tasks';
import { CommandName } from './command-name';
import { CommandTitle } from './command-title';
import { ExtensionContext, commands } from 'vscode';
import {
  builderSettingsRules,
  builderDevelopInteractive,
  checkBuilderIntegration,
  builderDevelopAuth,
  builderDevelopPrompt,
  builderOpen,
} from './integrations-builder';
import { webProjectPackages } from './web-configuration';

function hasWebPackages() {
  for (const pkg of webProjectPackages) {
    if (exists(pkg)) {
      return true;
    }
  }
  return false;
}

export async function getRecommendations(project: Project, context: ExtensionContext, packages: any): Promise<void> {
  tStart('getRecommendations');

  const isWebProjectOnly = !exists('@capacitor/core') && hasWebPackages();

  if (project.isCapacitor || isWebProjectOnly) {
    if (isWebProjectOnly) {
      project
        .setGroup('Project', 'Project Actions', TipType.WebNative, true)
        .setData(project)
        .setContext(Context.selectAction);
    } else {
      project.setGroup('Run', `Press ${alt('R')} to run the last chosen platform or Web.`, TipType.WebNative, true);
    }

    const hasCapIos = project.hasCapacitorProject(CapacitorPlatform.ios);
    const hasCapAndroid = project.hasCapacitorProject(CapacitorPlatform.android);
    const title = isWebProjectOnly ? 'Run' : CommandTitle.RunForWeb;
    const runWeb = new Tip(
      title,
      '',
      TipType.Run,
      'Serve',
      undefined,
      'Running', // Status Bar Text
      `Project Served`,
    )
      .setDynamicCommand(serve, project, false)
      .requestIPSelection()
      .setData(project.name)
      .setContextValue(Context.webConfig)
      .setFeatures([TipFeature.welcome])
      .setRunStatus((status) => {
        exState.runStatusBar.text = status == RunStatus.Running ? '$(debug-stop)' : '$(play)';
        exState.openEditorStatusBar.hide();
        exState.openWebStatusBar.hide();
      })
      .setRunPoints([
        { title: 'Building...', text: 'Generating browser application bundles' },
        { title: 'Serving', text: 'Development server running' },
      ])
      .canStop()
      .willNotBlock()
      .setVSCommand(CommandName.RunForWeb)
      .canAnimate()
      .setTooltip(`Run a development server and open using the default web browser (${alt('R')})`);
    project.add(runWeb, CommandTitle.RunForWeb);
    exState.runWeb = runWeb;

    const runPoints: Array<RunPoint> = [
      { text: 'Copying web assets', title: 'Copying...' },
      { text: 'ng run app:build', title: 'Building Web...' },
      { text: 'capacitor run', title: 'Syncing...' },
      { text: '✔ update ios', title: 'Building Native...' },
      { text: '✔ update android', title: 'Building Native...' },
      { text: 'Running Gradle build', title: 'Deploying...' },
      { text: 'Running xcodebuild', title: 'Deploying...' },
      { text: 'App deployed', title: 'Waiting for Code Changes', refresh: true },
    ];

    if (hasCapAndroid) {
      const runAndroid = new Tip(
        CommandTitle.RunForAndroid,
        exState.selectedAndroidDeviceName ?? '',
        TipType.Run,
        'Run',
        undefined,
        'Running',
        'Project is running',
      )
        .requestDeviceSelection()
        .requestIPSelection()
        .setDynamicCommand(capacitorRun, project, CapacitorPlatform.android)
        .setSecondCommand('Getting Devices', capacitorDevicesCommand(CapacitorPlatform.android, project))
        .setData(project.projectFolder())
        .setRunPoints(runPoints)
        .canStop()
        .willNotBlock()
        .canAnimate()
        .canRefreshAfter()
        .setVSCommand(CommandName.RunForAndroid)
        .setSyncOnSuccess(CapacitorPlatform.android)
        .setContextValue(Context.selectDevice);

      project.add(runAndroid);
      exState.runAndroid = runAndroid;
    }
    if (hasCapIos) {
      const runIos = new Tip(
        CommandTitle.RunForIOS,
        exState.selectedIOSDeviceName ?? '',
        TipType.Run,
        'Run',
        undefined,
        'Running',
        'Project is running',
      )
        .requestDeviceSelection()
        .requestIPSelection()
        .setDynamicCommand(capacitorRun, project, CapacitorPlatform.ios)
        .setSecondCommand('Getting Devices', capacitorDevicesCommand(CapacitorPlatform.ios, project))
        .setData(project.projectFolder())
        .setRunPoints(runPoints)
        .canStop()
        .willNotBlock()
        .canAnimate()
        .canRefreshAfter()
        .setVSCommand(CommandName.RunForIOS)
        .setSyncOnSuccess(CapacitorPlatform.ios)
        .setContextValue(Context.selectDevice);
      project.add(runIos);
      exState.runIOS = runIos;
    }

    if (isWebProjectOnly) {
      project.add(debugOnWeb(project, 'Debug'));
    } else {
      const r = project.setGroup(
        'Debug',
        `Running Ionic applications you can debug (${alt('D')})`,
        TipType.WebNative,
        exState.refreshDebugDevices || isWebProjectOnly,
        Context.refreshDebug,
      );

      r.whenExpanded = async () => {
        return [
          project.asRecommendation(debugOnWeb(project, 'Web')),
          ...(await getAndroidWebViewList(hasCapAndroid, project.getDistFolder())),
        ];
      };
    }

    if (!isWebProjectOnly) {
      project
        .setGroup('Project', 'Capacitor Features', TipType.Capacitor, true)
        .setData(project)
        .setContext(Context.selectAction);
    }
    if (project.isCapacitor) {
      if (exists('@angular/core')) {
        project.setSubGroup('New', TipType.Add, 'Create new Angular Components, Pages and more');

        ['Page', 'Component', 'Service', 'Module', 'Class', 'Directive'].forEach((item) => {
          project.add(
            new Tip(item, '', TipType.Angular)
              .setQueuedAction(angularGenerate, project, item.toLowerCase())
              .setTooltip(`Create a new Angular ${item.toLowerCase()}`)
              .canRefreshAfter(),
          );
        });
        project.clearSubgroup();
      }
    }

    project.add(buildAction(project));

    if (hasCapIos || hasCapAndroid) {
      project.add(
        new Tip(CommandTitle.Sync, '', TipType.Sync, 'Capacitor Sync', undefined, 'Syncing', undefined)
          .setDynamicCommand(capacitorSync, project)
          .canStop()
          .canAnimate()
          .setVSCommand(CommandName.Sync)
          .setTooltip(
            'Capacitor Sync copies the web app build assets to the native projects and updates native plugins and dependencies.',
          ),
      );
    }
    if (hasCapIos) {
      project.add(
        new Tip(
          CommandTitle.OpenInXCode,
          '',
          TipType.Edit,
          'Opening Project in Xcode',
          undefined,
          'Open Project in Xcode',
        )
          .showProgressDialog()
          .setVSCommand(CommandName.OpenInXCode)
          .setDynamicCommand(capacitorOpen, project, CapacitorPlatform.ios)
          .setTooltip('Opens the native iOS project in XCode'),
      );
    }
    if (hasCapAndroid) {
      project.add(
        new Tip(
          CommandTitle.OpenInAndroidStudio,
          '',
          TipType.Edit,
          'Opening Project in Android Studio',
          undefined,
          'Open Android Studio',
        )
          .showProgressDialog()
          .setVSCommand(CommandName.OpenInAndroidStudio)
          .setDynamicCommand(capacitorOpen, project, CapacitorPlatform.android)
          .setTooltip('Opens the native Android project in Android Studio'),
      );
    }
    if (hasCapAndroid || hasCapIos) {
      // cap build was added in v4.4.0
      if (isGreaterOrEqual('@capacitor/core', '4.4.0')) {
        project.add(
          new Tip(
            'Prepare Release',
            '',
            TipType.Build,
            'Capacitor Build',
            undefined,
            'Preparing Release Build',
            undefined,
          )
            .setQueuedAction(capacitorBuild, project)
            .canAnimate()
            .setTooltip('Prepares native binaries suitable for uploading to the App Store or Play Store.'),
        );
      }
    }
  }

  // Script Running
  addScripts(project, isWebProjectOnly);

  if (project.isCapacitor || project.hasACapacitorProject()) {
    // Capacitor Configure Features
    project.setGroup(
      `Configuration`,
      'Configurations for native project. Changes made apply to both the iOS and Android projects',
      TipType.Capacitor,
      false,
    );

    await reviewCapacitorConfig(project, context);

    // Splash Screen and Icon Features
    addSplashAndIconFeatures(project);

    // Not needed: only shows Android permissions and features used
    //reviewPluginProperties(packages, project);

    project.add(
      new Tip('Check for Minor Updates', '', TipType.Dependency)
        .setQueuedAction(updateMinorDependencies, project, packages)
        .setTooltip('Find minor updates for project dependencies'),
    );
    if (project.packageManager == PackageManager.npm) {
      project.add(
        new Tip('Security Audit', '', TipType.Files)
          .setQueuedAction(audit, project)
          .setTooltip('Analyze dependencies using npm audit for security vulnerabilities'),
      );
    }
    project.add(
      new Tip('Statistics', '', TipType.Files)
        .setQueuedAction(analyzeSize, project)
        .setTooltip('Analyze the built project assets and Javascript bundles'),
    );
    project.add(
      new Tip('Export', '', TipType.Media)
        .setQueuedAction(ionicExport, project, exState.context)
        .setTooltip('Export a markdown file with all project dependencies and plugins'),
    );
  }

  project.setGroup(
    `Recommendations`,
    `The following recommendations were made by analyzing the package.json file of your ${project.type} app.`,
    TipType.Idea,
    true,
    // !isWebProjectOnly, TODO: Having this expanded is a little annoying maybe remember if the user closes it
  );

  // General Rules around node modules (eg Jquery)
  checkPackages(project);

  // Deprecated removals
  for (const deprecated of deprecatedPackages(packages)) {
    project.recommendRemove(
      deprecated.name,
      deprecated.name,
      `${deprecated.name} is deprecated: ${deprecated.message}`,
    );
  }

  checkRemoteDependencies(project);

  // Deprecated plugins
  checkDeprecatedPlugins(project);

  if (project.isCordova) {
    checkCordovaRules(project);
    if (!project.isCapacitor) {
      await checkCapacitorMigrationRules(packages, project);
    }
  }

  tEnd('getRecommendations');

  if (project.isCapacitor) {
    tStart('checkCapacitorRules');
    await checkCapacitorRules(project, context);
    tEnd('checkCapacitorRules');
    tStart('capacitorRecommendations');
    checkIonicNativePackages(packages, project);
    checkCordovaPlugins(packages, project);
    project.tips(await capacitorRecommendations(project, false));
    tEnd('capacitorRecommendations');
  }

  tStart('reviewPackages');
  if (!project.isCapacitor && !project.isCordova) {
    // The project is not using Cordova or Capacitor
    webProject(project);
  }

  // Builder
  project.setGroup(`Builder`, `These tasks are available for Builder.io`, TipType.Builder, true, undefined, true);
  project.tips(checkBuilderIntegration());
  project.tips(builderDevelopAuth());
  project.add(builderDevelopInteractive());
  project.add(builderDevelopPrompt(project));
  project.add(builderSettingsRules(project));
  project.add(builderOpen());

  // Package Upgrade Features
  reviewPackages(packages, project);

  project.setGroup(`Advanced`, 'Advanced Options', TipType.Settings, false);
  if (project.isCapacitor) {
    // if (exists('@capacitor/ios') || exists('@capacitor/android')) {
    //   project.add(liveReload());
    // }
    project.add(useHttps(project));

    //project.add(remoteLogging(project));
    project.add(
      new Tip('Logging', undefined, TipType.Settings, undefined)
        .setTooltip('Settings for logging displayed in the output window')
        .setQueuedAction(LoggingSettings, project),
    );
  }

  project.add(new Tip('Settings', '', TipType.Settings).setQueuedAction(settings));
  project.add(new Tip('Show Logs', '', TipType.Files).setQueuedAction(showLogs));

  tEnd('reviewPackages');
}

async function showLogs(queueFunction: QueueFunction) {
  queueFunction();
  await commands.executeCommand(CommandName.ShowLogs);
}

async function settings(queueFunction: QueueFunction) {
  queueFunction();
  await commands.executeCommand('workbench.action.openSettings', '@ext:webnative.webnative');
}

export function debugOnWeb(project: Project, title: string): Tip {
  return new Tip(title, `(${getDebugBrowserName()})`, TipType.Debug, 'Serve', undefined, 'Debugging', `Project Served`)
    .setDynamicCommand(serve, project, true, true)
    .setFeatures([TipFeature.debugOnWeb])
    .setRunPoints([
      { title: 'Building...', text: 'Generating browser application bundles' },
      { title: 'Serving', text: 'Development server running' },
    ])
    .canStop()
    .setContextValue(Context.webDebugConfig)
    .setVSCommand(CommandName.Debug)
    .willNotBlock()
    .canAnimate()
    .setTooltip(`Debug using ${getDebugBrowserName()}. (${alt('D')})`);
}

export function buildAction(project: Project) {
  return new Tip('Build', getConfigurationName(), TipType.Build, 'Build', undefined, 'Building', undefined)
    .setDynamicCommand(build, project, {})
    .setContextValue(Context.buildConfig)
    .canStop()
    .canAnimate()
    .setVSCommand(CommandName.Build)
    .setTooltip('Builds the web project (and copies to native platforms)');
}

function liveReload(): Tip {
  const liveReload = getSetting(WorkspaceSetting.liveReload);
  return new Tip('Live Reload', undefined, liveReload ? TipType.Check : TipType.Box, undefined)
    .setTooltip('Live reload will refresh the app whenever source code is changed.')
    .setQueuedAction(toggleLiveReload, liveReload)
    .canRefreshAfter();
}

function useHttps(project: Project): Tip {
  if (!exists('@angular/core')) return;
  const useHttps = getSetting(WorkspaceSetting.httpsForWeb);
  return new Tip('Use HTTPS', undefined, useHttps ? TipType.Check : TipType.Box, undefined)
    .setTooltip('Use HTTPS when running with web or Live Reload.')
    .setQueuedAction(toggleHttps, useHttps, project)
    .canRefreshAfter();
}

async function toggleRemoteLogging(project: Project, current: boolean): Promise<void> {
  if (await startStopLogServer(project.folder)) {
    exState.remoteLogging = !current;
  }
  await cancelLastOperation();
  return Promise.resolve();
}

async function toggleLiveReload(queueFunction: QueueFunction, current: boolean) {
  queueFunction();
  await setSetting(WorkspaceSetting.liveReload, !current);
}

async function toggleHttps(queueFunction: QueueFunction, current: boolean, project: Project) {
  queueFunction();
  await setSetting(WorkspaceSetting.httpsForWeb, !current);
  if (!current) {
    await showProgress('Enabling HTTPS', async () => {
      writeWN('Installing @jcesarmobile/ssl-skip');
      await getRunOutput(npmInstall('@jcesarmobile/ssl-skip'), project.folder);
      await liveReloadSSL(project);
    });
  } else {
    await showProgress('Disabling HTTPS', async () => {
      writeWN('Uninstalling @jcesarmobile/ssl-skip');
      await getRunOutput(npmUninstall('@jcesarmobile/ssl-skip'), project.folder);
    });
  }
  await cancelLastOperation();
}
