// Сверка анимаций оригинала и копии численно (покадрово): позиции при прокрутке (scroll-анимации и фиксация),
// кривые opacity/transform при hover и появлении. Результат: reports/animations-data.json
// Запуск: node tools/anim-compare.mjs [url_копии]
import { chromium } from 'playwright';
import fs from 'node:fs';

const COPY = process.argv[2] || 'http://localhost:4175/';
const REF = 'https://dviga.marketing/';
const out = { scroll: [], hover: [], appear: [] };
const browser = await chromium.launch();

async function open(url, w = 1440, h = 900) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto(url, { waitUntil: url === REF ? 'networkidle' : 'load', timeout: 180000 });
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: '.t708__btn,.wg-b{visibility:hidden!important}' });
  return p;
}

// ---------- 1. scroll-анимации и фиксация: позиции атомов при разных scrollY
const YS = [0, 150, 300, 450, 600, 900, 1200, 1600, 2200];
const sample = (isRef) => async (p) => {
  const res = {};
  for (const y of YS) {
    await p.evaluate((yy) => scrollTo({ top: yy, behavior: 'instant' }), y);
    await p.waitForTimeout(450);
    res[y] = await p.evaluate((ref) => {
      const o = {};
      const els = [...document.querySelectorAll(ref ? '.t396__elem[data-animate-sbs-event=scroll], .t396__elem[data-animate-fix]' : '.e[data-sc], .e[data-fx]')];
      for (const e of els) {
        const id = ref ? e.getAttribute('data-elem-id') : (String(e.className).match(/(?:^|\s)e([0-9]+)(?:\s|$)/) || [])[1];
        const a = e.querySelector(ref ? '.tn-atom' : '.a'); if (!a) continue;
        const r = a.getBoundingClientRect();
        o[id] = [r.x, r.y, r.width, r.height, +getComputedStyle(a.closest(ref ? '.tn-atom__sbs-anim-wrapper' : '.sw') || a).opacity || 1].map((n) => Math.round(n * 10) / 10);
      }
      return o;
    }, isRef);
  }
  return res;
};
{
  const pr = await open(REF); const ref = await sample(true)(pr); await pr.close();
  const pm = await open(COPY); const mine = await sample(false)(pm); await pm.close();
  let maxPos = 0; let maxSize = 0; let maxOp = 0; let n = 0; const worst = [];
  for (const y of YS) for (const id of Object.keys(ref[y])) {
    const a = ref[y][id]; const b = mine[y][id]; if (!b) continue;
    const dp = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); const ds = Math.max(Math.abs(a[2] - b[2]), Math.abs(a[3] - b[3])); const dop = Math.abs(a[4] - b[4]);
    n++; maxPos = Math.max(maxPos, dp); maxSize = Math.max(maxSize, ds); maxOp = Math.max(maxOp, dop);
    if (dp > 6 || ds > 6 || dop > 0.08) worst.push({ y, id, ref: a, mine: b });
  }
  out.scroll = { samples: n, maxPos, maxSize, maxOp, worst: worst.slice(0, 40) };
  console.log('scroll/fix: samples', n, 'maxΔpos', maxPos, 'maxΔsize', maxSize, 'maxΔopacity', maxOp, 'outliers', worst.length);
}

// ---------- 2. hover: кривая opacity иконок телефона (кроссфейд) и сдвиг пункта меню
const sampleHover = async (p, isRef, sel) => {
  const box = await p.evaluate((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const read = () => p.evaluate((ref) => {
    const g = (s) => { const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : null; };
    return ref
      ? [g('.tn-elem[data-elem-id="1698564814642"] .tn-atom__sbs-anim-wrapper'), g('.tn-elem[data-elem-id="1698564951140"] .tn-atom__sbs-anim-wrapper')]
      : [g('.e1698564814642 .sw'), g('.e1698564951140 .sw')];
  }, isRef);
  await p.mouse.move(5, 5); await p.waitForTimeout(500);
  const t0 = []; t0.push(await read());
  await p.mouse.move(box[0], box[1]);
  const series = [];
  for (let t = 0; t <= 450; t += 50) { series.push([t, ...(await read())]); await p.waitForTimeout(50); }
  return { rest: t0[0], series };
};
{
  const sel = (ref) => (ref ? '.tn-elem[data-elem-id="1698564951140"]' : '.e1698564951140');
  const pr = await open(REF); const a = await sampleHover(pr, true, sel(true)); await pr.close();
  const pm = await open(COPY); const b = await sampleHover(pm, false, sel(false)); await pm.close();
  const dev = Math.max(...a.series.map((s, i) => Math.max(Math.abs(s[1] - b.series[i][1]), Math.abs(s[2] - b.series[i][2]))));
  out.hover.push({ name: 'иконки телефона (кроссфейд opacity, 300 мс)', ref: a, mine: b, maxΔopacity: +dev.toFixed(3) });
  console.log('hover phone crossfade: rest ref', a.rest, 'mine', b.rest, 'maxΔopacity', dev.toFixed(3));
}

// ---------- 3. появление (fadein) заголовка хиро: opacity во времени после загрузки
{
  const read = (ref) => (ref ? '.tn-elem[data-elem-id="176087180579048680"]' : '.e176087180579048680');
  const sampleAppear = async (url, isRef) => {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const samples = [];
    const t0 = Date.now();
    await p.goto(url, { waitUntil: 'commit' });
    for (let i = 0; i < 30; i++) {
      const v = await p.evaluate((s) => { const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : -1; }, read(isRef)).catch(() => -1);
      samples.push([Date.now() - t0, v]); await p.waitForTimeout(150);
    }
    await p.close(); return samples;
  };
  out.appear = [{ name: 'fadein h1 хиро', ref: await sampleAppear(REF, true), mine: await sampleAppear(COPY, false) }];
  const first = (s) => (s.find((x) => x[1] >= 0.99) || [null])[0];
  console.log('fadein h1: время до opacity=1: оригинал', first(out.appear[0].ref), 'мс, копия', first(out.appear[0].mine), 'мс (включая загрузку страницы)');
}
await browser.close();
fs.writeFileSync('reports/animations-data.json', JSON.stringify(out, null, 1));
