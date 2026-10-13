// Скачивает оригиналы изображений/видео главной (static.tildacdn.com, не thb/optim) в source-assets/.
import fs from 'node:fs';
import path from 'node:path';
const all = JSON.parse(fs.readFileSync('data/assets-raw.json', 'utf8'));
const list = all.filter((u) => /static\.tildacdn\.com\/(tild|vide)/.test(u));
list.push('https://cp80604-bitrix-8.tw1.ru/showreel1.mp4');
fs.mkdirSync('source-assets', { recursive: true });
const manifest = {};
const localName = (u) => {
  const p = new URL(u);
  if (p.host.startsWith('static.tildacdn.com')) {
    const [id, ...rest] = p.pathname.replace(/^\//, '').split('/');
    return `${id}__${decodeURIComponent(rest.join('_')).replace(/[^\w.\-]+/g, '_')}`;
  }
  return 'ext__' + path.basename(p.pathname);
};
let i = 0;
async function worker() {
  while (i < list.length) {
    const u = list[i++];
    const f = 'source-assets/' + localName(u);
    try {
      if (!fs.existsSync(f)) {
        const r = await fetch(u);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      }
      manifest[u] = { file: f, size: fs.statSync(f).size };
    } catch (e) { manifest[u] = { error: String(e) }; console.log('FAIL', u, e.message); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync('data/assets-manifest.json', JSON.stringify(manifest, null, 1));
const ok = Object.values(manifest).filter((m) => m.file);
console.log('downloaded', ok.length, 'of', list.length, 'total MB', (ok.reduce((s, m) => s + m.size, 0) / 1e6).toFixed(1));
for (const [u, m] of Object.entries(manifest)) if (m.size > 800000) console.log((m.size / 1e6).toFixed(2) + ' MB', u);
