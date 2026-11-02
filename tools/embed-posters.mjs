// Постеры для видеоплееров Rutube / Vimeo / YouTube в Zero-блоках «video» статей (data-rutubeid / data-vimeoid / data-youtubeid).
// На странице — постер и кнопка «смотреть», сам плеер (iframe) подставляется по клику. Результат: data/video-embeds.json,
// ключ «<сервис>:<id>» -> { poster, w, h }. Запуск: node tools/embed-posters.mjs   (повторно — только новые; ALL=1 — все)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const FILE = 'data/video-embeds.json';
const OUT = 'public/assets/video';
const prev = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const result = { ...prev };
fs.mkdirSync(OUT, { recursive: true });
const curl = (args) => spawnSync('curl', ['-sS', '--ssl-no-revoke', '-L', '-m', '60', '--retry', '2', ...args], { maxBuffer: 64 * 1024 * 1024 });
const text = (url) => (curl([url]).stdout || Buffer.alloc(0)).toString('utf8');

const keys = new Set();
for (const f of [...fs.readdirSync('data/pages').filter((x) => x.endsWith('.html')).map((x) => path.join('data/pages', x)), 'data/home.source.html']) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/data-(rutube|vimeo|youtube|kinescope)id="([^"]+)"/g)) keys.add(`${m[1]}:${m[2].replace(/&amp;/g, '&')}`);
}

async function posterUrl(kind, raw) {
  if (kind === 'rutube') { const [id, q] = raw.split('?p='); const j = JSON.parse(text(`https://rutube.ru/api/video/${id}/${q ? `?p=${q}` : ''}`) || '{}'); return j.thumbnail_url; }
  if (kind === 'vimeo') { const j = JSON.parse(text(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent('https://vimeo.com/' + raw)}`) || '{}'); return (j.thumbnail_url || '').replace(/_\d+x\d+/, '_1280x720'); }
  if (kind === 'kinescope') return /property="og:image" content="([^"]+)"/.exec(text(`https://kinescope.io/embed/${raw}`))?.[1]; // постер — og:image страницы плеера
  return `https://i.ytimg.com/vi/${raw}/maxresdefault.jpg`;
}

for (const key of keys) {
  if (result[key] && !process.env.ALL) continue;
  const [kind, raw] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  let ok = false;
  for (const url of [await posterUrl(kind, raw).catch(() => ''), kind === 'youtube' ? `https://i.ytimg.com/vi/${raw}/hqdefault.jpg` : ''].filter(Boolean)) {
    const buf = curl(['--fail', url]).stdout;
    if (!buf || buf.length < 2000) continue;
    try {
      const img = sharp(buf).resize({ width: 960, withoutEnlargement: true });
      const meta = await img.clone().webp({ quality: 70 }).toBuffer({ resolveWithObject: true });
      const name = `${kind}-${crypto.createHash('sha1').update(meta.data).digest('hex').slice(0, 10)}.webp`;
      fs.writeFileSync(path.join(OUT, name), meta.data);
      result[key] = { poster: `/assets/video/${name}`, w: meta.info.width, h: meta.info.height };
      ok = true; break;
    } catch { /* не картинка — пробуем следующий адрес */ }
  }
  console.log(ok ? 'ok  ' : 'FAIL', key.slice(0, 60), ok ? `${result[key].w}x${result[key].h}` : '');
}
fs.writeFileSync(FILE, JSON.stringify(result, null, 1) + '\n');
console.log('плееров в data/video-embeds.json:', Object.keys(result).length);
