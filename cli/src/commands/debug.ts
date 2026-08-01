import { spawn } from 'child_process';
import { registerCommand } from '../cli/registry';
import { flagBool, flagString } from '../cli/args';
import { WnError } from '../cli/errors';
import { ExitCode } from '../cli/exit-codes';
import { requireChoice } from '../cli/prompt';
import { findDevices, findWebViews, forwardDebugger, verifyAndroidDebugBridge } from '../devices/adb';
import { Device, WebView } from '../devices/models';
import { CliContext } from '../core/context';
import { usageError } from './helpers';

async function debugAndroid(ctx: CliContext): Promise<unknown> {
  const adbPath = ctx.config.adbPath;
  await verifyAndroidDebugBridge({ adbPath });

  if (flagBool(ctx.args.flags, 'list')) {
    const devices = await findDevices({ adbPath });
    const webviews: Array<Record<string, unknown>> = [];
    for (const device of devices) {
      const wvs = await findWebViews(device, { adbPath });
      for (const wv of wvs) {
        webviews.push({
          id: `${device.serial}:${wv.socket}`,
          device: device.serial,
          deviceName: device.model || device.product,
          packageName: wv.packageName,
          socketName: wv.socket,
        });
      }
    }
    return { webviews };
  }

  const devices = await findDevices({ adbPath });
  if (devices.length === 0) {
    throw new WnError('NO_DEVICES', 'No Android devices found', { exitCode: ExitCode.MissingTool });
  }

  const deviceFlag = flagString(ctx.args.flags, 'device');
  let device: Device;
  if (deviceFlag) {
    const match = devices.find((d) => d.serial === deviceFlag);
    if (!match) {
      throw new WnError('MISSING_INPUT', `Device not found: ${deviceFlag}`, {
        exitCode: ExitCode.MissingInput,
        input: 'device',
        choices: devices.map((d) => ({ id: d.serial, name: d.model || d.serial })),
        hint: 'Re-run with --device <id>',
      });
    }
    device = match;
  } else if (devices.length === 1) {
    device = devices[0];
  } else {
    const chosen = await requireChoice(
      'device',
      devices.map((d) => ({ id: d.serial, name: d.model || d.product || d.serial, type: 'device' })),
      ctx.opts,
      'Re-run with --device <id>',
    );
    device = devices.find((d) => d.serial === chosen.id)!;
  }

  const webviews = await findWebViews(device, { adbPath });
  if (webviews.length === 0) {
    throw new WnError('NO_WEBVIEWS', 'No debuggable WebViews found', { exitCode: ExitCode.CommandFailed });
  }

  const webviewFlag = flagString(ctx.args.flags, 'webview');
  let webview: WebView;
  if (webviewFlag) {
    const match = webviews.find((w) => w.socket === webviewFlag || `${device.serial}:${w.socket}` === webviewFlag);
    if (!match) {
      throw new WnError('MISSING_INPUT', `WebView not found: ${webviewFlag}`, {
        exitCode: ExitCode.MissingInput,
        input: 'webview',
        choices: webviews.map((w) => ({
          id: `${device.serial}:${w.socket}`,
          name: w.packageName || w.socket,
        })),
        hint: 'Re-run with --webview <id>',
      });
    }
    webview = match;
  } else if (webviews.length === 1) {
    webview = webviews[0];
  } else {
    const chosen = await requireChoice(
      'webview',
      webviews.map((w) => ({
        id: `${device.serial}:${w.socket}`,
        name: w.packageName || w.socket,
        type: 'webview',
      })),
      ctx.opts,
      'Re-run with --webview <id>',
    );
    webview = webviews.find((w) => `${device.serial}:${w.socket}` === chosen.id)!;
  }

  const requestedPort = Number(flagString(ctx.args.flags, 'port') || 9222);
  const port = await forwardDebugger(webview, requestedPort, { adbPath });
  const cdpUrl = `ws://localhost:${port}/devtools/page`;
  return { cdpUrl, port, device: device.serial, webview: webview.socket };
}

async function debugWeb(ctx: CliContext): Promise<unknown> {
  const browser = flagString(ctx.args.flags, 'browser') || ctx.config.debugBrowser || 'chrome';
  const port = Number(flagString(ctx.args.flags, 'port') || 9222);
  const url = flagString(ctx.args.flags, 'url') || 'http://localhost:8100';

  const chromeArgs = [`--remote-debugging-port=${port}`, `--user-data-dir=/tmp/wn-chrome-debug`, url];
  let bin = 'google-chrome';
  if (process.platform === 'darwin') {
    bin =
      browser === 'edge'
        ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (process.platform === 'win32') {
    bin = browser === 'edge' ? 'msedge' : 'chrome';
  } else if (browser === 'edge') {
    bin = 'microsoft-edge';
  }

  if (!ctx.opts.dryRun) {
    spawn(bin, chromeArgs, { detached: true, stdio: 'ignore' }).unref();
  } else {
    ctx.logger.write(`[dry-run] ${bin} ${chromeArgs.join(' ')}`);
  }

  return { cdpUrl: `ws://localhost:${port}/devtools/browser`, port, browser, url };
}

async function runDebug(ctx: CliContext): Promise<unknown> {
  const target = ctx.args.positionals[0] || ctx.commandName.replace(/^debug\s*/, '');
  if (target === 'android' || ctx.commandName === 'debug android') return debugAndroid(ctx);
  if (target === 'web' || ctx.commandName === 'debug web') return debugWeb(ctx);
  throw usageError('Usage: wn debug <web|android>');
}

registerCommand({ name: 'debug', description: 'Attach a debugger', run: runDebug });
registerCommand({ name: 'debug web', description: 'Debug in Chrome/Edge', run: debugWeb });
registerCommand({ name: 'debug android', description: 'Debug Android WebViews via CDP', run: debugAndroid });
