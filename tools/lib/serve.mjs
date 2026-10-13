// Мини-статический сервер для проверок (dist/): заголовки кэша как у хостинга + сжатие brotli/gzip текстовых ответов.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon' };
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml']);
const cache = new Map();

function compressed(f, st, enc) {
  const key = `${f}|${st.mtimeMs}|${enc}`;
  if (!cache.has(key)) {
    const buf = fs.readFileSync(f);
    cache.set(key, enc === 'br' ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : zlib.gzipSync(buf, { level: 6 }));
  }
  return cache.get(key);
}

export function startServer(root, port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!path.resolve(f).startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
    fs.stat(f, (e, st) => {
      if (e || !st.isFile()) { res.writeHead(404); return res.end('404'); }
      const ext = path.extname(f);
      const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': /\.[0-9A-Za-z]{8,}\./.test(f) ? 'public,max-age=31536000,immutable' : 'no-cache', Vary: 'Accept-Encoding' };
      if (req.headers.range && ext === '.mp4') {
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range);
        const s = +m[1] || 0; const en = m[2] ? +m[2] : st.size - 1;
        res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${en}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': en - s + 1 });
        return fs.createReadStream(f, { start: s, end: en }).pipe(res);
      }
      const ae = String(req.headers['accept-encoding'] || '');
      if (COMPRESSIBLE.has(ext) && /\b(br|gzip)\b/.test(ae)) {
        const enc = /\bbr\b/.test(ae) ? 'br' : 'gzip';
        const body = compressed(f, st, enc);
        res.writeHead(200, { ...h, 'Content-Encoding': enc, 'Content-Length': body.length });
        return res.end(body);
      }
      res.writeHead(200, { ...h, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(f).pipe(res);
    });
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
