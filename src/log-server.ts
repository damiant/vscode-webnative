import { exState } from './wn-tree-provider';
import { injectScript, removeScript } from './log-server-scripts';
import { extname, join } from 'path';
import { readFile } from 'fs';
import { passesFilter, replaceAll } from './utilities';
import { getSetting, WorkspaceSetting } from './workspace-state';
import { writeWN, write, writeError, showOutput } from './logging';
import { networkInterfaces } from 'os';
import { Server, createServer } from 'http';

let logServer: Server;

export async function startStopLogServer(folder: string): Promise<boolean> {
  if (logServer && !folder) {
    return; // We've already started the log server
  }
  if (logServer) {
    logServer.close();
    removeScript(folder);
    logServer = undefined;
    writeWN(`Remote logging stopped.`);
    return true;
  }

  const port = 8942;
  const basePath = join(exState.context.extensionPath, 'log-client');
  logServer = createServer((request, response) => {
    let body = '';

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Request-Method', '*');
    response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    response.setHeader('Access-Control-Allow-Headers', '*');

    if (request.method == 'OPTIONS') {
      response.writeHead(200);
      response.end();
      return;
    }
    if (request.method == 'POST') {
      request.on('data', (chunk) => {
        body += chunk.toString();
      });
      request.on('end', () => {
        if (request.url == '/log') {
          writeLog(body);
        } else if (request.url == '/devices') {
          writeDevices(body);
        } else {
          writeWN(body);
        }
        response.writeHead(200);
        response.end();
      });
      // logging
      //        response.writeHead(200);
      //        response.end();
      return;
    }

    const name = request.url.includes('?') ? request.url.split('?')[0] : request.url;
    const filePath = join(basePath, name);
    const contentType = getMimeType(extname(filePath));
    readFile(filePath, (error, content) => {
      if (error) {
        if (error.code == 'ENOENT') {
          readFile('./404.html', function (error, content) {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
          });
        } else {
          response.writeHead(500);
          response.end('Oh bummer error: ' + error.code + ' ..\n');
          response.end();
        }
      } else {
        response.writeHead(200, { 'Content-Type': contentType });
        response.end(content, 'utf-8');
      }
    });
  }).listen(port);

  const addressInfo = getAddress();
  writeWN(`Remote logging service has started at http://${addressInfo}:${port}`);
  removeScript(folder);
  if (!(await injectScript(folder, addressInfo, port))) {
    writeError(`Unable to start remote logging (index.html or equivalent cannot be found).`);
    showOutput();
    return false;
  }
  return true;
}

function getAddress(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
}

function getLogFilters(): string[] {
  return getSetting(WorkspaceSetting.logFilter);
}

function writeLog(body: string) {
  function write2(level, message, tag) {
    const msg =
      typeof message === 'object'
        ? `[${level}][${tag}] ${JSON.stringify(message)}`
        : `[${level}][${tag}] ${replaceAll(message, '\n', '')}`;

    if (passesFilter(msg, getLogFilters(), false)) {
      write(msg);
    }
  }
  try {
    const lines = JSON.parse(body);
    if (!Array.isArray(lines)) {
      write2(lines.level, lines.message, lines.tag);
    } else {
      for (const line of lines) {
        write2(line.level, line.message, line.tag);
      }
    }
  } catch {
    write(body);
  }
}

function writeDevices(body: string) {
  try {
    const device = JSON.parse(body);
    writeWN(`${device.agent}`);
  } catch {
    write(body);
  }
}

function getMimeType(ext: string): string {
  switch (ext) {
    case '.js':
      return 'text/javascript';
    case '.css':
      return 'text/css';
    case '.json':
      return 'application/json';
    case '.png':
      return 'image/png';
    case '.jpg':
      return 'image/jpg';
    case '.wav':
      return 'audio/wav';
  }
  return 'text/html';
}
