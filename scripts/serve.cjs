const { createReadStream, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize } = require('node:path');

const root = join(__dirname, '..', 'public');
const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const relative = normalize(pathname === '/' ? 'preview.html' : pathname.slice(1));
  const file = join(root, relative);
  if (!file.startsWith(root) || !stat(file)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(response);
}).listen(8080, '127.0.0.1', () => {
  console.log('Preview: http://127.0.0.1:8080/');
});

function stat(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}
