export interface WebView {
  device: Device;
  socket: string;
  type: WebViewType;
  packageName?: string;
  versionName?: string;
}

export enum WebViewType {
  chrome = 'chrome',
  webview = 'webview',
  crosswalk = 'crosswalk',
  unknown = 'unknown',
}

export type DeviceState =
  | 'device'
  | 'connecting'
  | 'offline'
  | 'unknown'
  | 'bootloader'
  | 'recovery'
  | 'download'
  | 'unauthorized'
  | 'host'
  | 'no permissions';

export interface Device {
  serial: string;
  state: DeviceState;
  usb?: string;
  product?: string;
  model?: string;
  device?: string;
  features?: string;
  transportId?: string;
}

export interface ForwardedSocket {
  local: string;
  remote: string;
}

export interface AdbOptions {
  executable: string;
  arguments: string[];
}

export interface ShellOptions extends AdbOptions {
  serial: string;
  command: string;
}

export interface ForwardOptions extends AdbOptions {
  serial: string;
  local: string;
  remote: string;
}

export interface UnforwardOptions extends AdbOptions {
  local: string;
}

export interface Process {
  pid: number;
  name: string;
}

export interface Package {
  packageName: string;
  versionName: string;
}

export interface WebViewPage {
  url: string;
  title: string;
  webSocketDebuggerUrl: string;
}
