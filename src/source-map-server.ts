import { writeIonic } from './logging';
import { readFile } from 'fs';
import { createServer } from 'http';
import { extname, join } from 'path';

export function startSourceMapServer(folder: string) {
  writeIonic('Starting source map server on port 80....');
  createServer((request, response) => {
    const filePath = join(folder, request.url);
    writeIonic(`Serving ${filePath}`);

    const ex = extname(filePath);
    const contentType = getMimeType(ex);

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
  }).listen(80);
}

function getMimeType(extname: string): string {
  switch (extname) {
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
