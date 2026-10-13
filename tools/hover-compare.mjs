// Сверка hover-состояний: для каждого интерактивного элемента наводим мышь, ждём окончания transition и сравниваем кадры.
// Запуск: node tools/hover-compare.mjs [url_копии] [ширина]
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';

const COPY = process.argv[2] || 'http://localhost:4175/';
const W = +(process.argv[3] || 1440);
const REF = 'https://dviga.marketing/';
const browser = await chromium.launch();
const open = async (url) => {
  const p = await browser.newPage({ viewport: { width: W, height: 900 } });
  await p.goto(url, { waitUntil: url === REF ? 'networkidle' : 'load', timeout: 180000 });
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: 'video,.tn-atom__videoiframe,.e[data-t=video],.t396__elem[data-elem-type=video],.t708__btn,.wg-b,#ck,.t657{visibility:hidden!important}' });
  return p;
};
// список элементов берём из копии
const pm = await open(COPY);
const ids = await pm.evaluate(() => [...document.querySelectorAll('main .e[data-an=hover], header .e[data-an=hover], footer .e[data-an=hover], .e[data-t=button]')]
  .filter((e) => !e.closest('.pp'))
  .map((e) => ({ id: (String(e.className).match(/(?:^|\s)e([0-9]+)(?:\s|$)/) || [])[1], rec: e.closest('.r').id, t: e.dataset.t })));
const shot = async (p, ref, id, rec) => {
  const sel = ref ? `#rec${rec.replace(/^r/, '')} .tn-elem[data-elem-id="${id}"]` : `#${rec} .e${id}`;
  const h = await p.$(sel); if (!h) return null;
  await h.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 0));
  await p.evaluate((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); scrollBy(0, r.top - 450); }, sel);
  await p.waitForTimeout(400);
  const r = await h.boundingBox(); if (!r || r.width < 2 || r.height < 2 || r.width > 800) return null;
  const clip = { x: Math.max(0, r.x - 25), y: Math.max(0, r.y - 25), width: Math.min(W - Math.max(0, r.x - 25), r.width + 50), height: r.height + 50 };
  await p.mouse.move(2, 2); await p.waitForTimeout(900);
  const rest = await p.screenshot({ clip });
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(1500);
  const hov = await p.screenshot({ clip });
  await p.mouse.move(2, 2);
  return { rest, hov };
};
const cmp = (a, b) => {
  const A = PNG.sync.read(a); const B = PNG.sync.read(b);
  const w = Math.min(A.width, B.width); const h = Math.min(A.height, B.height);
  const crop = (P) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(P, o, 0, 0, w, h, 0, 0); return o; };
  const x = crop(A); const y = crop(B);
  return (100 * pixelmatch(x.data, y.data, null, w, h, { threshold: 0.15 })) / (w * h);
};
const pr = await open(REF);
const rows = [];
for (const { id, rec } of ids) {
  const a = await shot(pr, true, id, rec); const b = await shot(pm, false, id, rec);
  if (!a || !b) { continue; }
  rows.push({ id, rec, rest: +cmp(a.rest, b.rest).toFixed(2), hover: +cmp(a.hov, b.hov).toFixed(2) });
}
await browser.close();
const bad = rows.filter((r) => r.hover > 3 || r.rest > 3);
fs.writeFileSync(`reports/hover-data-${W}.json`, JSON.stringify(rows, null, 1));
console.log(`hover @${W}: элементов ${rows.length}, расхождение >3%: ${bad.length}`);
console.log(bad.map((r) => `${r.rec}:${r.id} покой ${r.rest}% hover ${r.hover}%`).join('\n'));
