import { OutputChannel, window } from 'vscode';

let channel: OutputChannel = undefined;

function getOutputChannel(): OutputChannel {
  if (!channel) {
    channel = window.createOutputChannel('WebNative');
    //channel.show();
  }
  return channel;
}

export function clearOutput(): OutputChannel {
  const channel = getOutputChannel();
  channel.clear();
  //showOutput();
  return channel;
}

export function showOutput() {
  const channel = getOutputChannel();
  channel.show();
}

export function hideOutput() {
  const channel = getOutputChannel();
  channel.hide();
}

export function write(message: string) {
  getOutputChannel().appendLine(message);
}

export function writeAppend(message: string) {
  getOutputChannel().append(message);
}

export function writeWN(message: string) {
  const channel = getOutputChannel();
  channel.appendLine(`[wn] ${message}`);
}

export function writeError(message: string) {
  const channel = getOutputChannel();
  channel.appendLine(`[error] ${message}`);
}

export function writeWarning(message: string) {
  const channel = getOutputChannel();
  channel.appendLine(`[warning] ${message}`);
}
