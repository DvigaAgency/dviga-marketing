// Сравнение геометрии копии (dist/) с эталоном reference/home/<w>/data.json.
// Запуск: node tools/geom.mjs [ширины через запятую]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startServer } from './lib/serve.mjs';

const widths = (process.argv[2] || '1440,1200,960,640,480,320').split(',').map(Number);
const HEIGHT = { 1440: 900, 1200: 900, 960: 800, 640: 900, 480: 850, 320: 700 };
const srv = await startServer('dist', 4180);
const browser = await chromium.launch();
const summary = [];
for (const w of widths) {
  const ref = JSON.parse(fs.readFileSync(`reference/home/${w}/data.json`, 'utf8'));
  const page = await browser.newPage({ viewport: { width: w, height: HEIGHT[w] || 800 } });
  await page.goto('http://localhost:4180/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const mine = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.e').forEach((e) => {
      const id = (e.className.match(/\be(\d+)\b/) || [])[1];
      const ab = e.closest('.ab'); const abr = ab.getBoundingClientRect();
      const r = e.getBoundingClientRect();
      const rec = e.closest('.r').id.replace(/^r/, 'rec');
      out[rec.replace(/^rec/, '') + ':' + id] = { x: r.left - abr.left, y: r.top - abr.top, w: r.width, h: r.height };
    });
    const recs = {};
    document.querySelectorAll('.r').forEach((r) => { const b = r.getBoundingClientRect(); recs[r.id.replace(/^r/, '')] = { y: b.top + scrollY, h: b.height }; });
    return { elems: out, recs, docH: document.documentElement.scrollHeight };
  });
  let n = 0, bad = []; let sumd = 0;
  for (const e of ref.elems) {
    const key = String(e.rec).replace(/^rec/, '') + ':' + e.id; const m = mine.elems[key]; if (!m) { bad.push({ k: key, miss: true, type: e.type }); continue; }
    const d = Math.max(Math.abs(m.x - e.x), Math.abs(m.y - e.y), Math.abs(m.w - e.w), Math.abs(m.h - e.h));
    n++; sumd += d; if (d > 3) bad.push({ k: key, type: e.type, d: +d.toFixed(1), ref: [e.x, e.y, e.w, e.h].map(Math.round), mine: [m.x, m.y, m.w, m.h].map(Math.round) });
  }
  const recBad = [];
  for (const r of ref.records) { const m = mine.recs[String(r.id).replace(/^rec/, '')]; if (m && Math.abs(m.h - r.h) > 2) recBad.push([r.id, Math.round(r.h), Math.round(m.h)]); }
  summary.push({ w, matched: n, ref: ref.elems.length, bad: bad.length, mean: +(sumd / n).toFixed(2), docRef: ref.doc.h, docMine: mine.docH });
  console.log(`\n== ${w}: matched ${n}/${ref.elems.length}, off>3px: ${bad.length}, docH ref ${ref.doc.h} mine ${mine.docH}`);
  if (process.env.V) { bad.filter((b) => !/rec1121678416|rec1064388596/.test(b.k)).slice(0, +process.env.V).forEach((b) => console.log(JSON.stringify(b))); console.log('rec height diffs:', JSON.stringify(recBad.slice(0, 30))); }
  await page.close();
}
await browser.close(); srv.close();
fs.writeFileSync('reports/geom-summary.json', JSON.stringify(summary, null, 1));
