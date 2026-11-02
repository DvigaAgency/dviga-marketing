// Ролики, которые остаются на хостинге оригинала (тяжёлые: 7–70 МБ) и подключаются по тем же ссылкам, что и на Tilda (data-mp4video).
// В репозиторий и сборку сами ролики не попадают — скачиваем только начало файла, чтобы вырезать постер (кадр 0,4 с), и записываем
// data/video-remote.json: адрес ролика -> { poster, w, h, mb }. Страница показывает постер и кнопку «смотреть»; ролик загружается по клику.
// Запуск: node tools/remote-videos.mjs [часть адреса]   (повторно обрабатываются только ролики, которых ещё нет в data/video-remote.json; ALL=1 — все)
import ffmpeg from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const OUT = 'public/assets/video';
const FILE = 'data/video-remote.json';
const man = fs.existsSync('data/video-manifest.json') ? JSON.parse(fs.readFileSync('data/video-manifest.json', 'utf8')) : {};
const prev = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const result = { ...prev };
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-'));

// адреса роликов — из снимков страниц статей блога (Zero «video» -> data-mp4video, «html» -> <video><source src>)
const urls = new Set();
for (const f of fs.readdirSync('data/pages').filter((x) => x.startsWith('blog__') && x.endsWith('.html'))) {
  const s = fs.readFileSync(path.join('data/pages', f), 'utf8');
  for (const m of s.matchAll(/data-mp4video="([^"]+)"|<source[^>]+src="([^"]+)"|<video[^>]*?\ssrc="([^"]+)"/g)) {
    const u = (m[1] || m[2] || m[3]).replace(/&amp;/g, '&');
    if (/^https?:/.test(u) && !man[u]) urls.add(u);
  }
}
const curl = (args) => spawnSync('curl', ['-sS', '--ssl-no-revoke', '-L', '-m', '120', '--retry', '2', ...args.map((x) => (/^https?:/.test(x) ? encodeURI(decodeURI(x)) : x))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
const run = (args) => spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });

for (const url of urls) {
  if (process.argv[2] && !url.includes(process.argv[2])) continue;
  if (result[url] && !process.env.ALL) continue;
  const pn = new URL(url).pathname;
  const slug = (/^\/([0-9a-f]{8})-[0-9a-f-]+\/-\/format\//.exec(pn) || [, path.basename(decodeURIComponent(pn))])[1].replace(/\.[A-Za-z0-9]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'v';
  const head = curl(['-I', url]).stdout || '';
  const lens = [...head.matchAll(/content-length:\s*(\d+)/gi)].map((m) => +m[1]);
  const mb = lens.length ? +(lens.at(-1) / 1e6).toFixed(1) : null;
  const src = path.join(tmp, slug + '.bin'); const png = path.join(tmp, slug + '.png');
  let ok = false;
  for (const range of ['0-6000000', null]) { // сначала начало файла (moov в начале — «faststart»), потом целиком
    fs.rmSync(src, { force: true });
    const r = curl([...(range ? ['-r', range] : []), '-o', src, url]);
    if (r.status || !fs.existsSync(src)) continue;
    const pr = spawnSync(ffmpeg, ['-hide_banner', '-i', src], { encoding: 'utf8' }).stderr || '';
    const dim = /Video:.*?, (\d{2,5})x(\d{2,5})/.exec(pr);
    if (!dim) continue;
    const e = run(['-i', src, '-ss', process.env.POSTER_AT || '0.4', '-frames:v', '1', '-vf', 'scale=960:-2', png]);
    if (e.status || !fs.existsSync(png)) continue;
    const poster = `${slug}.${hash(png)}.webp`;
    await sharp(png).webp({ quality: 70 }).toFile(path.join(OUT, poster));
    result[url] = { poster: `/assets/video/${poster}`, w: +dim[1], h: +dim[2], mb };
    ok = true;
    break;
  }
  console.log(ok ? 'ok  ' : 'FAIL', slug.padEnd(24), mb ? mb + ' МБ' : '?', ok ? `${result[url].w}x${result[url].h}` : url);
}
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(FILE, JSON.stringify(result, null, 1) + '\n');
console.log('роликов в data/video-remote.json:', Object.keys(result).length);
