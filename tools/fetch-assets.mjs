// Скачивает оригиналы изображений/видео главной (static.tildacdn.com, не thb/optim) в source-assets/.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const all = JSON.parse(fs.readFileSync('data/assets-raw.json', 'utf8'));
const list = all.filter((u) => /static\.tildacdn\.com\/(tild|vide)|cp80604-bitrix-8\.tw1\.ru\//.test(u));

fs.mkdirSync('source-assets', { recursive: true });
const prevM = fs.existsSync('data/assets-manifest.json') ? JSON.parse(fs.readFileSync('data/assets-manifest.json', 'utf8')) : {};
const manifest = { ...prevM };
const localName = (u) => {
  const p = new URL(u);
  if (p.host.startsWith('static.tildacdn.com')) {
    const [id, ...rest] = p.pathname.replace(/^\//, '').split('/');
    return `${id}__${decodeURIComponent(rest.join('_')).replace(/[^\w.\-]+/g, '_')}`;
  }
  return 'ext__' + decodeURIComponent(path.basename(p.pathname)).replace(/[^A-Za-z0-9._-]+/g, '_');
};
let i = 0;
let done = 0;
async function worker() {
  while (i < list.length) {
    const u = list[i++];
    const f = 'source-assets/' + localName(u);
    try {
      if (manifest[u] && manifest[u].file && fs.existsSync(manifest[u].file)) continue;
      if (process.env.ONLY_NEW && manifest[u]) continue; // ONLY_NEW=1 — не повторять адреса, которые уже падали (404 и т. п.)
      if (!fs.existsSync(f)) {
        const url = u.replace(/ /g, '%20');
        try {
          if (process.env.CURL) throw new Error('curl only'); // CURL=1 — сразу curl (без ожидания таймаута fetch)
          const r = await fetch(url);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
        } catch (e) { // node fetch не ходит через прокси некоторых сред — запасной путь через curl
          if (/HTTP 4dd/.test(e.message)) throw e;
          const c = spawnSync('curl', ['-sS', '-L', '--fail', '-m', '45', '--retry', '2', '-o', f, url], { encoding: 'utf8' });
          if (c.status !== 0) { fs.rmSync(f, { force: true }); throw new Error('curl: ' + c.stderr.trim()); }
        }
      }
      manifest[u] = { file: f, size: fs.statSync(f).size };
    } catch (e) { manifest[u] = { error: String(e) }; console.log('FAIL', u, e.message); }
    if (++done % 20 === 0) fs.writeFileSync('data/assets-manifest.json', JSON.stringify(manifest, null, 1));
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync('data/assets-manifest.json', JSON.stringify(manifest, null, 1));
const ok = Object.values(manifest).filter((m) => m.file);
console.log('downloaded', ok.length, 'of', list.length, 'total MB', (ok.reduce((s, m) => s + m.size, 0) / 1e6).toFixed(1));
for (const [u, m] of Object.entries(manifest)) if (m.size > 800000) console.log((m.size / 1e6).toFixed(2) + ' MB', u);
