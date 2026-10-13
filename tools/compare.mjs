// Попиксельное сравнение секций копии (reference/copy) с эталоном (reference/home) через pixelmatch.
// Результат: reports/compare.md + reports/diff/<ширина>/<секция>.png
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const WIDTHS = (process.env.WIDTHS || '1440,1200,960,640,480,320').split(',').map(Number);
const THRESH = +(process.env.THRESH || 0.12);
// секции, которые заведомо динамичны (автоплей слайдера, видео-ролики): сравниваем только размеры
const DYNAMIC = new Set((process.env.DYNAMIC || '680540530').split(','));
const rows = [];
const read = (f) => PNG.sync.read(fs.readFileSync(f));

function crop(png, w, h) {
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, 0, 0, Math.min(w, png.width), Math.min(h, png.height), 0, 0);
  return out;
}

for (const w of WIDTHS) {
  const dirA = `reference/home/${w}/sections`; const dirB = `reference/copy/${w}/sections`;
  if (!fs.existsSync(dirA) || !fs.existsSync(dirB)) continue;
  const ref = JSON.parse(fs.readFileSync(`reference/home/${w}/data.json`, 'utf8'));
  const cpy = JSON.parse(fs.readFileSync(`reference/copy/${w}/data.json`, 'utf8'));
  const idOf = (f) => f.replace(/^[0-9]+_/, '').replace(/\.png$/, '').replace(/^r(ec)?/, '');
  const a = Object.fromEntries(fs.readdirSync(dirA).map((f) => [idOf(f), f]));
  const b = Object.fromEntries(fs.readdirSync(dirB).map((f) => [idOf(f), f]));
  fs.mkdirSync(`reports/diff/${w}`, { recursive: true });
  for (const id of Object.keys(a)) {
    const rr = ref.records.find((r) => r.id.replace(/^r(ec)?/, '') === id);
    const cr = cpy.records.find((r) => r.id.replace(/^r(ec)?/, '') === id);
    if (!b[id]) { rows.push({ w, id, note: 'нет в копии', pct: 100, dh: NaN }); continue; }
    const A = read(path.join(dirA, a[id])); const B = read(path.join(dirB, b[id]));
    const dh = (cr ? cr.h : B.height) - (rr ? rr.h : A.height);
    const W = Math.min(A.width, B.width); const H = Math.max(A.height, B.height);
    const Ac = crop(A, W, H); const Bc = crop(B, W, H);
    const diff = new PNG({ width: W, height: H });
    const n = pixelmatch(Ac.data, Bc.data, diff.data, W, H, { threshold: THRESH, includeAA: false });
    const pct = (100 * n) / (W * H);
    const dyn = DYNAMIC.has(id);
    if (pct > 0.3) fs.writeFileSync(`reports/diff/${w}/${id}.png`, PNG.sync.write(diff));
    rows.push({ w, id, pct, dh, dyn, H: A.height });
  }
}
const md = ['# Визуальное сравнение копии с оригиналом', '', `pixelmatch, порог цвета ${THRESH}, AA игнорируется. Критерий приёмки: ≤ 2% отличающихся пикселей на секцию, высота ±8 px.`, '',
  '| ширина | секция | отличий, % | Δвысоты, px | статус |', '|---|---|---|---|---|'];
let ok = 0; let bad = 0;
for (const r of rows) {
  const pass = r.dyn ? Math.abs(r.dh) <= 8 : r.pct <= 2 && Math.abs(r.dh) <= 8;
  pass ? ok++ : bad++;
  md.push(`| ${r.w} | ${r.id}${r.dyn ? ' (динамич.)' : ''} | ${Number.isNaN(r.pct) ? '—' : r.pct.toFixed(2)} | ${Number.isNaN(r.dh) ? '—' : r.dh.toFixed(0)} | ${pass ? 'ок' : 'расхождение'}${r.note ? ' — ' + r.note : ''} |`);
}
md.splice(4, 0, `Итого: ок ${ok}, расхождений ${bad}.`, '');
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/compare.md', md.join('\n') + '\n');
console.log(md.slice(0, 6).join('\n'));
console.log(rows.filter((r) => !(r.dyn ? Math.abs(r.dh) <= 8 : r.pct <= 2 && Math.abs(r.dh) <= 8)).slice(0, 60).map((r) => `${r.w} ${r.id} ${Number.isNaN(r.pct) ? '-' : r.pct.toFixed(2)}% dh=${r.dh}`).join('\n'));
