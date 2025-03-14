import {
  CancellationToken,
  DebugConfiguration,
  DebugConfigurationProvider,
  ProgressLocation,
  WorkspaceFolder,
  window,
} from 'vscode';
import { findDevices, findWebViews, forwardDebugger, verifyAndroidDebugBridge } from './android-debug-bridge';
import { Device, WebView } from './android-debug-models';

export class AndroidDebugProvider implements DebugConfigurationProvider {
  public async resolveDebugConfiguration?(
    folder: WorkspaceFolder | undefined,
    debugConfiguration: DebugConfiguration,
    token?: CancellationToken,
  ): Promise<DebugConfiguration | null | undefined> {
    if (!debugConfiguration.type || !debugConfiguration.request || debugConfiguration.request !== 'attach') {
      return null;
    }

    debugConfiguration.type = 'pwa-chrome';

    await verifyAndroidDebugBridge();

    return await window.withProgress(
      {
        location: ProgressLocation.Window,
      },
      async (progress) => {
        let device: Device | undefined;
        let webView: WebView | undefined;

        progress.report({ message: 'Connecting' });

        // Find the connected devices
        const devices = await findDevices();
        if (devices.length < 1) {
          window.showErrorMessage(`No devices found`);
          return undefined;
        }

        if (debugConfiguration.packageName) {
          const webViews = await withTimeoutRetries(debugConfiguration.connectTimeout ?? 0, 500, async () => {
            // Find all devices that have the application running
            const promises = devices.map(async (dev) => {
              const webViews = await findWebViews(dev).catch((err: Error): WebView[] => {
                window.showWarningMessage(err.message);
                return [];
              });
              return webViews.find((el) => el.packageName === debugConfiguration.packageName);
            });
            const result = await Promise.all(promises);

            const filtered = result.filter((el) => (el ? true : false)) as WebView[];
            if (filtered.length < 1) {
              return undefined;
            }

            return filtered;
          });

          if (!webViews || webViews.length < 1) {
            window.showErrorMessage(`Webview is not running on a device`);
            return undefined;
          }

          if (webViews.length === 1) {
            device = webViews[0].device;
            webView = webViews[0];
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }

        if (!webView) {
          const webViews = await withTimeoutRetries(debugConfiguration.connectTimeout ?? 1000, 1000, async () => {
            // Find the running applications
            const webViews = await findWebViews(device!);
            if (webViews.length < 1) {
              return undefined;
            }

            if (debugConfiguration.packageName) {
              // Try to find the configured application
              const filtered = webViews.filter((el) => el.packageName === debugConfiguration.packageName);
              if (filtered.length < 1) {
                return undefined;
              }

              return filtered;
            } else {
              return webViews;
            }
          });

          if (!webViews || webViews.length < 1) {
            window.showErrorMessage(`WebView not found`);
            return undefined;
          }
          return undefined;
        }

        // Forward to the local port
        debugConfiguration.port = await forwardDebugger(webView, debugConfiguration.port);
        debugConfiguration.browserAttachLocation = 'workspace';
        return debugConfiguration;
      },
    );
  }
}

function withTimeoutRetries<T>(timeout: number, interval: number, func: () => Promise<T>): Promise<T> {
  const startTime = new Date().valueOf();
  const run = async (): Promise<T> => {
    const result = await func();
    if (result || startTime + timeout <= new Date().valueOf()) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));

    return run();
  };
  return run();
}
