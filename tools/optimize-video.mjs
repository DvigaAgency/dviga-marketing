// Пережатие видео: source-assets/*.mp4 -> public/assets/video/ (H.264 mp4 + постер WebP; VP9 при тесте оказался тяжелее H.264 на этих роликах — не используется).
// Результат: data/video-manifest.json (url оригинала -> файлы).
import ffmpeg from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const man = JSON.parse(fs.readFileSync('data/assets-manifest.json', 'utf8'));
const OUT = 'public/assets/video';
fs.mkdirSync(OUT, { recursive: true });
const prev = fs.existsSync('data/video-manifest.json') ? JSON.parse(fs.readFileSync('data/video-manifest.json', 'utf8')) : {};
const result = {};
const MAXH = +(process.env.MAXH || 720);
const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
const run = (args) => { const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); };

// ONLY=<часть адреса> — обработать только один ролик; POSTER_AT=<сек> — кадр постера (по умолчанию 0,4 с)
const list = Object.entries(man).filter(([u, m]) => m.file && /\.(mp4|mov)$/i.test(m.file) && (!process.env.ONLY || u.includes(process.env.ONLY)));
for (const [url, m] of list) {
  if (process.env.SKIP_DONE && prev[url] && prev[url].mp4 && fs.existsSync(path.join('public', prev[url].mp4))) continue; // уже обработано
  const src = m.file;
  const slug = path.basename(url).replace(/\.[A-Za-z0-9]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'v';
  const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', src], { encoding: 'utf8' }).stderr;
  const dim = /Video:.*?, (\d{2,5})x(\d{2,5})/.exec(probe);
  const sw = +dim[1]; const sh = +dim[2];
  const h = Math.min(sh, MAXH); const w = Math.round((sw * h) / sh / 2) * 2;
  const tmpMp4 = path.join(OUT, `${slug}.tmp.mp4`); const tmpPng = path.join(OUT, `${slug}.tmp.png`);
  const vf = `scale=${w}:${h}:flags=lanczos,setsar=1,format=yuv420p`;
  run(['-i', src, '-an', '-vf', vf, '-c:v', 'libx264', '-preset', process.env.PRESET || 'slow', '-crf', '30', '-profile:v', 'main', '-level', '4.0', '-r', '30', '-tag:v', 'avc1', '-movflags', '+faststart', tmpMp4]);
  run(['-i', src, '-ss', process.env.POSTER_AT || (slug === 'showreel1' ? '8' : '0.4'), '-frames:v', '1', '-vf', `scale=${Math.min(w, 960)}:-2`, tmpPng]);
  const mp4 = `${slug}.${hash(tmpMp4)}.mp4`; 
  fs.renameSync(tmpMp4, path.join(OUT, mp4));
  const poster = `${slug}.${hash(tmpPng)}.webp`;
  await sharp(tmpPng).webp({ quality: 70 }).toFile(path.join(OUT, poster));
  fs.unlinkSync(tmpPng);
  const mb = (f) => (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(2);
  console.log(slug, `${sw}x${sh} -> ${w}x${h}`, 'src', (fs.statSync(src).size / 1e6).toFixed(2), 'mp4', mb(mp4), 'poster', (fs.statSync(path.join(OUT, poster)).size / 1e3).toFixed(0) + 'KB');
  result[url] = { mp4: `/assets/video/${mp4}`, poster: `/assets/video/${poster}`, w, h };
}
fs.writeFileSync('data/video-manifest.json', JSON.stringify({ ...prev, ...result }, null, 1));
