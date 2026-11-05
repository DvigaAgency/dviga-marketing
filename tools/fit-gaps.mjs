// Нормализация вертикальных отступов и ширины заголовков в статьях блога на каждом брейкпоинте (1200 / 960 / 640 / 480 / 320).
// Правила (замерены по эталонной статье и статистике всех статей, см. README «раунд 2»):
//  1) отступ «заголовок → текст» одинаковый: 30px на 1200–480, 20px на 320 (в оригинале у разных блоков 8…106px);
//  2) заголовок по ширине = колонка следующего за ним текста (на десктопе уже 760, на мобильных — во весь контейнер); при смене ширины высота заголовка
//     замеряется заново, блоки ниже сдвигаются так, чтобы отступ до текста сохранился;
//  3) текст, не влезающий в свой блок (обрезается по высоте), растёт до своей высоты, блоки ниже сдвигаются;
//  4) заголовок отдельной записью + пустые прокладки + текст: прокладки между ними схлопываются до стандартного отступа (заголовок «Оглавление» не трогаем);
//  5) на мобильных (320) то же для заголовка перед плашкой вопроса («Частые вопросы»).
// Запуск (порядок важен — замер идёт по сборке с уже подогнанными колонками 760):
//   NO_FIT=1 NO_GAP=1 node tools/build.mjs → node tools/serve.mjs dist 4173 (фоном) → node tools/fit-text.mjs → NO_GAP=1 node tools/build.mjs → node tools/fit-gaps.mjs [слаг…] → node tools/build.mjs
// Результат — data/articles/gap-fit.json: { "<recId>": { "<bp>": { "e": { "<elemId>": { l, w, h, t } }, "ab": <высота записи> } } }; применяется в tools/lib/text-fit.mjs.
import fs from 'node:fs';
import { chromium } from 'playwright';

const cl = JSON.parse(fs.readFileSync('data/articles/clones.json', 'utf8'));
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : [...Object.values(cl.topics).flat(), ...Object.keys(cl.existing)];
const BPS = [1200, 960, 640, 480, 320];
const FILE = 'data/articles/gap-fit.json';
const out = process.argv.slice(2).length && fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const browser = await chromium.launch();
let changedRecs = 0;
for (const bp of BPS) {
  const ctx = await browser.newContext({ viewport: { width: bp, height: 900 } });
  await ctx.route('**/*', (r) => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
  for (const slug of slugs) {
    const p = await ctx.newPage();
    try { await p.goto(`http://localhost:4173/blog/${slug}/`, { waitUntil: 'load', timeout: 60000 }); } catch (e) { console.log('ERR', slug, bp); await p.close(); continue; }
    await p.waitForTimeout(300);
    const res = await p.evaluate(({ bp }) => {
      const G = bp === 320 ? 20 : 30;
      const skipHead = /^(Оглавление|Содержание|Автор статьи|Telegram-канал)/;
      const secsAll = [...document.querySelectorAll('main section.r')];
      const stopEl = secsAll.find((s) => /Свежие статьи/.test(s.innerText));
      const stop = stopEl ? stopEl.getBoundingClientRect().top + scrollY : 1e9;
      const secs = secsAll.filter((s) => /^r\d+$/.test(s.id) && s.getBoundingClientRect().top + scrollY < stop);
      const recs = [];
      for (const sec of secs) {
        const zw = sec.querySelector('.zw'); const ab = sec.querySelector('.ab');
        if (!zw || !ab) { recs.push({ sec, skip: true, els: [], ab: 0 }); continue; }
        const o = zw.getBoundingClientRect();
        const els = [...zw.querySelectorAll(':scope > .e')].map((e) => {
          const b = e.getBoundingClientRect(); const a = e.querySelector('.tn-atom, *');
          const id = (e.className.match(/\be(\d+)\b/) || [])[1];
          return { e, id, t: e.getAttribute('data-t'), L: b.left - o.left, W: b.width, T: b.top - o.top, H: b.height, fs: Math.round(parseFloat(getComputedStyle(a || e).fontSize)), txt: (e.innerText || '').trim(), len: (e.innerText || '').trim().length, nH: 0, nW: 0, nL: 0 };
        }).filter((x) => x.id && x.W > 0 && x.H >= 0);
        recs.push({ sec, zw, els, ab: ab.getBoundingClientRect().height, id: sec.id.slice(1), events: [], res: {} });
      }
      const mark = (r, id) => (r.res[id] ||= {});
      for (const r of recs) {
        if (r.skip) continue;
        const media = r.els.some((x) => ['button', 'image', 'video', 'gallery', 'html', 'tooltip', 'form'].includes(x.t));
        const texts = r.els.filter((x) => x.t === 'text').sort((a, b) => a.T - b.T);
        // пары «заголовок → текст»
        const pairs = [];
        for (const h of texts) {
          if (h.fs < 17 || h.fs > 45 || h.len < 3 || skipHead.test(h.txt)) continue;
          const n = texts.find((x) => x !== h && x.T >= h.T + 5 && x.fs < h.fs - 1 && x.L < h.L + h.W && x.L + x.W > h.L && x.T - (h.T + h.H) < 200);
          if (n && !media && Math.abs(h.L - n.L) <= 12) pairs.push([h, n]);
        }
        const heads = new Set(pairs.map((x) => x[0]));
        // новые ширина/высота
        for (const x of texts) {
          const s = x.e.style; const keep = [s.width, s.height, s.left];
          let nw = x.W; let nl = x.L;
          const pr = pairs.find((q) => q[0] === x);
          if (pr) { const n = pr[1]; if (Math.abs(x.W - n.W) > 1 && (x.W > n.W || bp <= 480)) { nw = n.W; nl = n.L; } }
          s.width = nw + 'px'; s.left = nl + 'px'; s.height = 'auto';
          const nh = Math.ceil(x.e.getBoundingClientRect().height);
          [s.width, s.height, s.left] = keep;
          x.nW = nw; x.nL = nl;
          x.nH = heads.has(x) ? nh : Math.max(x.H, nh);
          if (x.nH === 0 || (Math.abs(x.nH - x.H) < 1 && nw === x.W)) x.nH = x.H;
        }
        // события сдвига (по порядку сверху вниз)
        const ev = []; // {at, d} — элементы с T >= at сдвигаются на d
        for (const x of texts) if (Math.abs(x.nH - x.H) >= 1) ev.push({ at: x.T + x.H - 2, d: x.nH - x.H, src: x });
        const shiftAt = (y) => ev.filter((q) => q.at <= y).reduce((a, q) => a + q.d, 0); // сдвиг элемента с верхом y
        // высота плашек вокруг растущего текста (как в fit-text)
        for (const q of ev) for (const s of r.els) if (s.t === 'shape' && q.src.T >= s.T - 2 && q.src.T + q.src.H <= s.T + s.H + 2 && q.src.L >= s.L - 1 && q.src.L + q.src.W <= s.L + s.W + 1) s.nH = (s.nH || s.H) + q.d;
        for (const [h, n] of pairs.sort((a, b) => a[0].T - b[0].T)) {
          const gap = (n.T + shiftAt(n.T)) - (h.T + shiftAt(h.T) + h.nH);
          if (Math.abs(gap - G) > 1) ev.push({ at: n.T - 1, d: G - gap, src: h });
        }
        const total = ev.reduce((a, q) => a + q.d, 0);
        for (const x of r.els) {
          const v = {}; const sh = shiftAt(x.T); x.nT = x.T + sh;
          if (Math.abs(sh) >= 1) v.t = Math.round(x.T + sh);
          if (x.t === 'text' && (Math.abs(x.nW - x.W) >= 1 || Math.abs(x.nL - x.L) >= 1)) { v.w = Math.round(x.nW); v.l = Math.round(x.nL); }
          const nh = x.t === 'text' ? x.nH : (x.nH || x.H);
          if (Math.abs(nh - x.H) >= 1) v.h = Math.round(nh);
          if (Object.keys(v).length) mark(r, x.id), Object.assign(r.res[x.id], v);
        }
        r.newAb = Math.round(r.ab + total);
        // запись не должна быть ниже самого нижнего текста: на мобильных высота артборда у оригинала бывает меньше текста — последние строки обрезаются (overflow:hidden у артборда)
        const needAb = Math.ceil(Math.max(0, ...texts.map((x) => (x.nT ?? x.T) + (x.nH || x.H))));
        if (needAb > r.newAb) r.newAb = needAb;
      }
      // заголовок отдельной записью + прокладки + текст
      for (let i = 0; i < recs.length; i++) {
        const r = recs[i]; if (r.skip || !r.els.length || r.newAb === undefined) continue;
        const h = r.els.filter((x) => x.t === 'text').reduce((m, x) => (!m || x.T > m.T ? x : m), null);
        if (!h || h.fs < 20 || h.fs > 45 || skipHead.test(h.txt)) continue;
        const bottom = (h.nT ?? h.T) + (h.nH || h.H);
        if (r.els.some((x) => x !== h && x.T > h.T - 1)) continue; // в записи есть другие элементы ниже/рядом — это не «одинокий» заголовок
        let j = i + 1; const gaps = [];
        while (j < recs.length && !recs[j].skip && recs[j].els.length === 0) { gaps.push(recs[j]); j++; }
        const nx = recs[j]; if (!nx || nx.skip || !nx.els.length) continue;
        const first = nx.els.reduce((m, x) => (x.T < m.T ? x : m), nx.els[0]);
        const okFirst = first.T <= 5 && ((first.t === 'text' && first.fs < h.fs) || (bp <= 480 && first.t === 'shape'));
        if (!okFirst) continue;
        const D = (r.newAb - bottom) + gaps.reduce((a, g) => a + g.newAb, 0) + first.T;
        if (Math.abs(D - G) <= 1) continue;
        r.newAb = Math.round(bottom + G - first.T);
        for (const g of gaps) g.newAb = 0;
      }
      const result = {};
      for (const r of recs) {
        if (r.skip) continue;
        const ab = r.newAb === undefined ? r.ab : r.newAb;
        if (!Object.keys(r.res || {}).length && Math.abs(ab - r.ab) < 1) continue;
        result[r.id] = { e: r.res, ab: Math.abs(ab - r.ab) >= 1 ? Math.round(ab) : undefined };
      }
      return result;
    }, { bp });
    for (const [id, v] of Object.entries(res)) { (out[id] ||= {})[bp] = v; changedRecs++; }
    await p.close();
  }
  await ctx.close();
  console.log('bp', bp, 'записей с правками (накопительно)', changedRecs);
}
await browser.close();
fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
console.log('записей в gap-fit.json:', Object.keys(out).length);
