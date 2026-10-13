// Мини-статический сервер для проверок (dist/ с заголовками как у хостинга).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon' };
export function startServer(root, port, opts = {}) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(path.resolve(root)) && !path.resolve(f).startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
    fs.stat(f, (e, st) => {
      if (e || !st.isFile()) { res.writeHead(404); return res.end('404'); }
      const ext = path.extname(f);
      const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': /\.[0-9a-f]{8,}\./.test(f) ? 'public,max-age=31536000,immutable' : 'no-cache' };
      if (req.headers.range && ext === '.mp4') {
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range); const s = +m[1] || 0; const en = m[2] ? +m[2] : st.size - 1;
        res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${en}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': en - s + 1 });
        return fs.createReadStream(f, { start: s, end: en }).pipe(res);
      }
      res.writeHead(200, { ...h, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(f).pipe(res);
    });
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
