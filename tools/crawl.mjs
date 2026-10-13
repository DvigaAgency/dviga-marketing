// Эталон: снимает главную dviga.marketing на ширинах 1440/1200/960/640/480/320.
// Для каждой ширины: скриншоты секций (.r), геометрия и текст всех элементов Zero-блоков, список запросов.
// Только чтение живого сайта. Результат: reference/home/<width>/...
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.env.REF_URL || 'https://dviga.marketing/';
const OUT = process.env.REF_OUT || 'reference/home';
const WIDTHS = (process.env.WIDTHS || '1440,1200,960,640,480,320').split(',').map(Number);
const HEIGHT = { 1440: 900, 1200: 900, 960: 800, 640: 900, 480: 850, 320: 700 };

export const collect = () => {
  const out = { records: [], elems: [], texts: [], doc: { h: document.documentElement.scrollHeight, w: document.documentElement.clientWidth } };
  const abs = (r) => ({ x: +(r.left + scrollX).toFixed(2), y: +(r.top + scrollY).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) });
  document.querySelectorAll(window.__SEL || '#allrecords > .r, header .r, footer .r').forEach((r) => {
    const rr = abs(r.getBoundingClientRect());
    out.records.push({ id: r.id.replace(/^r(ec)?/, ''), type: r.dataset.recordType, ...rr });
  });
  document.querySelectorAll('.t396__elem, .t396__group, .e').forEach((e) => {
    const ab = e.closest('.t396__artboard, .ab');
    const abr = ab ? ab.getBoundingClientRect() : { left: 0, top: 0 };
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    const core = e.querySelector('.tn-atom');
    const ccs = core ? getComputedStyle(core) : null;
    out.elems.push({
      rec: (e.closest('.r')?.id || '').replace(/^r(ec)?/, ''), id: e.dataset.elemId || (e.className.match(/(?:^|\s)e([0-9]+)(?:\s|$)/) || [])[1], type: e.dataset.elemType || e.dataset.t || 'group',
      x: +(r.left - abr.left).toFixed(2), y: +(r.top - abr.top).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      op: cs.opacity, vis: cs.visibility, disp: cs.display, tr: cs.transform === 'none' ? '' : cs.transform,
      fs: ccs?.fontSize, fw: ccs?.fontWeight, lh: ccs?.lineHeight, col: ccs?.color, bg: ccs?.backgroundColor,
      text: ((e.dataset.elemType || e.dataset.t) === 'text' || (e.dataset.elemType || e.dataset.t) === 'button') ? (core?.innerText || '').trim() : undefined,
    });
  });
  return out;
};

async function autoScroll(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.round(innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight + step; y += step) { scrollTo(0, y); await sleep(220); }
    await sleep(1500);
    scrollTo(0, 0);
  });
}

// --disable-lcd-text: одинаковое (серое) сглаживание шрифтов у оригинала и копии, иначе сравнение шумит на LCD-подпикселях
const browser = await chromium.launch({ args: ['--disable-lcd-text'] });
const requests = new Set();
for (const w of WIDTHS) {
  const dir = path.join(OUT, String(w));
  fs.mkdirSync(path.join(dir, 'sections'), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] || 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const reqs = [];
  page.on('request', (r) => reqs.push({ u: r.url(), t: r.resourceType() }));
  await page.goto(URL_, { waitUntil: 'networkidle', timeout: 120000 });
  await autoScroll(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  if (process.env.INJECT) await page.addStyleTag({ content: process.env.INJECT });
  // стабилизация: ролик на первый кадр
  await page.evaluate(() => document.querySelectorAll('video').forEach((v) => { try { v.pause(); v.currentTime = 0; } catch {} }));
  if (process.env.SEL) await page.evaluate((sel) => { window.__SEL = sel; }, process.env.SEL);
  const data = await page.evaluate(collect);
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(data));
  fs.writeFileSync(path.join(dir, 'requests.json'), JSON.stringify(reqs));
  if (w === 1440) fs.writeFileSync(path.join(OUT, 'rendered.html'), await page.content());
  // скриншоты секций
  const recs = data.records;
  const cdp = await ctx.newCDPSession(page);
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (r.h < 1) continue;
    const f = path.join(dir, 'sections', `${String(i).padStart(2, '0')}_${r.id}.png`);
    try {
      // прокрутка к секции нужна, чтобы фиксированные элементы (шапка, cookie) попали в кадр так же, как у пользователя
      await page.evaluate((y) => scrollTo(0, y), r.y);
      await page.waitForTimeout(150);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: r.y, width: Math.min(r.w || w, w), height: Math.min(r.h, 6000), scale: 1 } });
      fs.writeFileSync(f, Buffer.from(data, 'base64'));
    } catch (e) { console.log('shot fail', r.id, String(e).slice(0, 80)); }
  }
  console.log(w, 'docH', data.doc.h, 'records', recs.length, 'elems', data.elems.length, 'reqs', reqs.length);
  reqs.forEach((q) => requests.add(q.u));
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, 'all-requests.json'), JSON.stringify([...requests], null, 1));
await browser.close();
