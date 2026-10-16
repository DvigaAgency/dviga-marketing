// Оптимизация изображений: source-assets/ -> public/assets/img/ (AVIF + WebP, несколько ширин; SVG через SVGO).
// Имена с контент-хешем (immutable-кэш). Результат: data/img-manifest.json (url -> варианты).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { optimize } from 'svgo';

const manifestIn = JSON.parse(fs.readFileSync('data/assets-manifest.json', 'utf8'));
const OUT = 'public/assets/img';
fs.mkdirSync(OUT, { recursive: true });
const prev = fs.existsSync('data/img-manifest.json') ? JSON.parse(fs.readFileSync('data/img-manifest.json', 'utf8')) : {};
const result = {};
const PRESETS = [360, 720, 1080, 1620];
const QV = 'q2'; // версия параметров качества (PNG-скриншоты и иллюстрации — выше: на них заметны артефакты)
const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
const slug = (f) => path.basename(f).replace(/^tild[0-9a-f-]+__/, '').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/tilda/gi, 'tld').toLowerCase().slice(0, 40) || 'img';

let todo = Object.entries(manifestIn).filter(([u, m]) => m.file && !/\.(mp4|webm|mov)$/i.test(m.file));
let done = 0, bytesIn = 0, bytesOut = 0;
async function one([url, m]) {
  const f = m.file; const ext = path.extname(f).toLowerCase();
  const buf = fs.readFileSync(f);
  bytesIn += buf.length;
  if (prev[url] && prev[url].q === QV && prev[url].src && prev[url].inSize === buf.length && fs.existsSync(path.join('public', prev[url].src)) && [...(prev[url].avif || []), ...(prev[url].webp || [])].every((v) => fs.existsSync(path.join('public', v.src)))) { result[url] = prev[url]; bytesOut += prev[url].outSize || 0; return; }
  if (ext === '.svg') {
    const r = optimize(buf.toString('utf8'), { multipass: true, plugins: ['preset-default'] });
    const out = Buffer.from(r.data);
    const name = `${slug(f)}.${hash(out)}.svg`;
    fs.writeFileSync(path.join(OUT, name), out);
    const vb = /viewBox="([\d.\s-]+)"/.exec(r.data);
    let w = 0, h = 0;
    if (vb) { const p = vb[1].trim().split(/\s+/).map(Number); w = p[2]; h = p[3]; }
    result[url] = { kind: 'svg', src: `/assets/img/${name}`, w, h, inSize: buf.length, outSize: out.length };
    bytesOut += out.length; return;
  }
  const img = sharp(buf, { animated: false });
  const meta = await img.metadata();
  const N = meta.width; const H = meta.height;
  let widths = PRESETS.filter((w) => w < N * 0.92);
  widths.push(N);
  if (N <= 200) widths = [N];
  const variants = { avif: [], webp: [] };
  let out0 = 0;
  for (const w of widths) {
    const base = sharp(buf).resize({ width: w, withoutEnlargement: true });
    for (const fmt of ['avif', 'webp']) {
      const png = ext === '.png';
      const q = fmt === 'avif' ? { quality: png ? 72 : 62, effort: 4 } : { quality: png ? 90 : 82, effort: 5 };
      const o = await base.clone()[fmt](q).toBuffer();
      const name = `${slug(f)}-${w}.${hash(o)}.${fmt}`;
      fs.writeFileSync(path.join(OUT, name), o);
      variants[fmt].push({ w, src: `/assets/img/${name}`, size: o.length });
      if (w === N || (w === widths.at(-1))) out0 += o.length;
    }
  }
  result[url] = { q: QV, kind: 'raster', w: N, h: H, alpha: !!meta.hasAlpha, avif: variants.avif, webp: variants.webp, src: variants.webp.at(-1).src, inSize: buf.length, outSize: out0 };
  bytesOut += out0;
}
let idx = 0;
async function worker() { while (idx < todo.length) { const t = todo[idx++]; try { await one(t); } catch (e) { console.log('FAIL', t[0], e.message); } if (++done % 20 === 0) console.log(done, '/', todo.length); } }
const checkpoint = setInterval(() => fs.writeFileSync('data/img-manifest.json', JSON.stringify({ ...prev, ...result }, null, 1)), 20000); // чтобы прерванный прогон можно было продолжить
await Promise.all(Array.from({ length: 4 }, worker));
clearInterval(checkpoint);
fs.writeFileSync('data/img-manifest.json', JSON.stringify({ ...prev, ...result }, null, 1));
console.log('images', Object.keys(result).length, 'in MB', (bytesIn / 1e6).toFixed(1), 'out (largest variant, webp+avif) MB', (bytesOut / 1e6).toFixed(1));
