const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApiRequest } = require('./routes');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function serveStatic(req, res) {
  let filePath = path.join(PUBLIC_DIR, decodeURIComponent(req.url.split('?')[0]));
  if (req.url === '/' || req.url.startsWith('/?')) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES['.html'] });
      fs.createReadStream(fallback).pipe(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApiRequest(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Marketplace server running on http://localhost:${PORT}`);
});
