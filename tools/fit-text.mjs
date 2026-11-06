// Замер раскладки статей для правила «текст основного контента на десктопе — колонка 760px (left 220)».
// Порядок: NO_FIT=1 node tools/build.mjs && node tools/serve.mjs dist 4173 (фоном) && node tools/fit-text.mjs && node tools/build.mjs
// На ширине окна 1200px масштаб равен 1, так что координаты в браузере = px макета. Для каждого текста колонки ставим ширину 760,
// замеряем высоту по содержимому; блоки ниже сдвигаются, плашки-врезки (shape вокруг текста) и артборд растут на ту же величину.
// Результат — data/articles/text-fit.json (применяется в tools/lib/text-fit.mjs при сборке).
import fs from 'node:fs';
import { chromium } from 'playwright';

const cl = JSON.parse(fs.readFileSync('data/articles/clones.json', 'utf8'));
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : [...Object.values(cl.topics).flat(), ...Object.keys(cl.existing).filter((s) => s !== 'plyusy-i-minusy-sayta-na-bitrix')];
const COL_L = 220; const COL_W = 760; const COL_R = COL_L + COL_W - 10; // правый край внутреннего текста врезок: 950
const out = {};
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
await ctx.route('**/*', (r) => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort())); // счётчики и внешние сайты не нужны (и тормозят загрузку)
  
let changed = 0; let grown = 0;
for (const slug of slugs) {
  const p = await ctx.newPage();
  await p.goto(`http://localhost:4173/blog/${slug}/`, { waitUntil: 'load', timeout: 60000 });
  const res = await p.evaluate(({ COL_L, COL_W, COL_R }) => {
    const found = {};
    const secs = [...document.querySelectorAll('main section.r')];
    const stopEl = secs.find((s) => /Свежие статьи/.test(s.innerText));
    const stop = stopEl ? stopEl.getBoundingClientRect().top + scrollY : 1e9;
    for (const sec of secs) {
      if (!/^r\d+$/.test(sec.id) || sec.getBoundingClientRect().top + scrollY >= stop) continue;
      const zw = sec.querySelector('.zw'); const ab = sec.querySelector('.ab');
      if (!zw || !ab) continue;
      const o = zw.getBoundingClientRect();
      const els = [...zw.querySelectorAll(':scope > .e')].map((e) => {
        const b = e.getBoundingClientRect();
        const id = ((e.className.match(/\be(\d+)\b/) || [])[1]) || null;
        return { e, id, t: e.getAttribute('data-t'), L: Math.round(b.left - o.left), W: Math.round(b.width), T: Math.round(b.top - o.top), H: Math.round(b.height), len: (e.innerText || '').trim().length };
      }).filter((x) => x.id && x.W > 0);
      // кандидаты: тексты колонки и врезок
      const cands = [];
      for (const x of els) {
        // текст со «значками» списка (маленькие красные квадраты-шейпы слева, поставленные по строкам оригинала) не перестраиваем: от новой ширины строки съедут, и значки окажутся не там
        if (x.t === 'text' && els.some((q) => q.t === 'shape' && q.W <= 30 && q.H <= 30 && q.L < x.L && q.L + q.W + 120 > x.L && q.T >= x.T - 5 && q.T <= x.T + x.H)) continue;
        if (x.t === 'text' && x.len > 40 && x.L >= COL_L - 1 && x.L <= COL_L + 6 && x.W >= 600 && x.W <= 880) { if (x.W !== COL_W || x.L !== COL_L) cands.push({ ...x, nl: COL_L, nw: COL_W }); } else if (x.t === 'text' && x.len > 40 && x.L > COL_L + 6 && x.L <= 262 && x.L + x.W > COL_R) cands.push({ ...x, nl: x.L, nw: COL_R - x.L });
      }
      const shapesWide = els.filter((x) => x.t === 'shape' && x.L >= COL_L - 1 && x.L <= COL_L + 6 && x.W > COL_W + 1 && x.W <= 880 && els.some((y) => y.t === 'text' && y.T >= x.T - 2 && y.T + y.H <= x.T + x.H + 2 && y.L >= x.L && y.L + y.W <= x.L + x.W + 2));
      if (!cands.length && !shapesWide.length) continue;
      // замер высоты по содержимому при новой ширине
      for (const c of cands) {
        const s = c.e.style; const keep = [s.width, s.height, s.left];
        s.width = c.nw + 'px'; s.left = c.nl + 'px'; s.height = 'auto';
        c.nh = Math.ceil(c.e.getBoundingClientRect().height);
        [s.width, s.height, s.left] = keep;
        c.d = c.nh > c.H + 1 ? c.nh - c.H : 0; // уменьшать высоту не будем: отступы между блоками остаются как в оригинале
      }
      const grow = cands.filter((c) => c.d > 0);
      const rec = { e: {} }; const ablen = Math.round(ab.getBoundingClientRect().height);
      let maxDelta = 0;
      for (const x of els) {
        let shift = 0; let dh = 0;
        for (const c of grow) {
          if (c.id === x.id) { dh += c.d; continue; }
          if (x.T >= c.T + c.H - 2) shift += c.d; // блок ниже растущего текста
          else if (x.t === 'shape' && c.T >= x.T - 2 && c.T + c.H <= x.T + x.H + 2 && c.L >= x.L && c.L + c.W <= x.L + x.W + 2) dh += c.d; // плашка вокруг текста
        }
        const cand = cands.find((c) => c.id === x.id); const sw = shapesWide.includes(x);
        const v = {};
        if (cand) { v.l = cand.nl; v.w = cand.nw; }
        if (sw) { v.l = COL_L; v.w = COL_W; }
        if (dh) v.h = x.H + dh;
        if (shift) v.t = x.T + shift;
        if (Object.keys(v).length) rec.e[x.id] = v;
        maxDelta = Math.max(maxDelta, shift + dh);
      }
      if (maxDelta) rec.ab = ablen + maxDelta;
      found[sec.id.slice(1)] = { ...rec, info: cands.map((c) => `${c.L}x${c.W}->${c.nw} h${c.H}->${c.nh} «${(c.e.innerText || '').trim().slice(0, 24).replace(/\n/g, ' ')}»`) };
    }
    return found;
  }, { COL_L, COL_W, COL_R });
  const n = Object.keys(res).length;
  for (const [id, v] of Object.entries(res)) { const { info, ...rest } = v; out[id] = rest; changed += Object.keys(v.e).length; if (v.ab) grown++; }
  console.log(slug.slice(0, 60).padEnd(61), 'блоков', n, 'с ростом высоты', Object.values(res).filter((v) => v.ab).length);
  if (process.env.VERBOSE) for (const v of Object.values(res)) v.info.forEach((i) => console.log('    ', i));
  await p.close();
}
await browser.close();
fs.writeFileSync('data/articles/text-fit.json', JSON.stringify(out, null, 1) + '\n');
console.log('элементов:', changed, '| блоков, у которых выросла высота:', grown);
