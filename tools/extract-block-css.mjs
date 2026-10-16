// Достаёт из оригинала (только чтение) CSS, который реально применяется к записи Tilda: скачивает таблицы стилей страницы,
// оставляет правила, чьи селекторы совпадают с элементами записи, и сохраняет в data/block-css/<recId>.css.
// Нужно для блоков со стандартной вёрсткой Tilda (квиз, аккордеон): их CSS не воспроизвести вручную без потерь.
// Запуск: node tools/extract-block-css.mjs <адрес страницы> <id записи> [<id записи> ...]
import { chromium } from 'playwright';
import * as csstree from 'css-tree';
import fs from 'node:fs';

const [url, ...ids] = process.argv.slice(2);
if (!url || !ids.length) { console.error('node tools/extract-block-css.mjs <url> <recId> ...'); process.exit(1); }
const b = await chromium.launch();
const c = await b.newContext(); const p = await c.newPage();
const sheets = new Map();
p.on('response', (r) => { const u = r.url(); if (/\.css(\?|$)/.test(u)) sheets.set(u, r); });
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(8000);
const texts = [];
for (const [u, r] of sheets) { try { texts.push([u, await r.text()]); } catch { try { texts.push([u, await (await c.request.get(u, { timeout: 60000 })).text()]); } catch (e) { console.log('fail', u); } } }
// стили в порядке документа (каскад зависит от порядка таблиц): внешние <link> и <style> страницы
const order = await p.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet],style')].map((n) => (n.tagName === 'LINK' ? { href: n.href } : { text: n.textContent })));
const byUrl = new Map(texts.map(([u, t]) => [u, t]));
texts.length = 0;
order.forEach((o, i) => { if (o.href) { if (byUrl.has(o.href)) texts.push([o.href, byUrl.get(o.href)]); } else texts.push(['inline' + i, o.text]); });

const STRIP = /::?(?:hover|focus|focus-within|focus-visible|active|visited|disabled|checked|placeholder-shown|placeholder|before|after|selection|-webkit-[a-z-]+|-moz-[a-z-]+|-ms-[a-z-]+|first-letter|first-line)(?![a-z-])/g;
const KEEP_SEL = (sel) => sel.replace(STRIP, '');

for (const id of ids) {
  const recClasses = (await p.evaluate((i) => { const e = document.getElementById('rec' + i); return e ? [...e.classList] : []; }, id)).filter((c) => c !== 'r');
  // собрать все селекторы
  const rules = [];
  for (const [u, t] of texts) {
    let ast; try { ast = csstree.parse(t, { positions: false }); } catch { continue; }
    const walk = (list, wrappers) => {
      list.forEach((node) => {
        if (node.type === 'Rule') rules.push({ node, wrappers, src: u });
        else if (node.type === 'Atrule' && node.block && /^(media|supports)$/i.test(node.name)) walk(node.block.children.toArray(), [...wrappers, node]);
        else if (node.type === 'Atrule' && /^(font-face|keyframes|-webkit-keyframes)$/i.test(node.name)) rules.push({ node, wrappers, src: u, at: true });
      });
    };
    walk(ast.children.toArray(), []);
  }
  const sels = [...new Set(rules.filter((r) => !r.at).flatMap((r) => r.node.prelude.children ? r.node.prelude.children.toArray().map((s) => csstree.generate(s)) : []))];
  const ok = await p.evaluate(([recId, list]) => {
    const rec = document.getElementById('rec' + recId); const res = {};
    if (!rec) return null;
    rec.querySelectorAll('.t668__header').forEach((h) => h.classList.add('t668__opened')); // состояние «раскрыто»
    rec.querySelectorAll('.t-input-group').forEach((g) => g.classList.add('js-error-control-box')); // состояние ошибки появляется только после проверки формы
    for (const s of list) {
      let hit = false;
      for (const q of [s, s.replace(/::?(?:hover|focus|focus-within|focus-visible|active|visited|disabled|checked|placeholder-shown|placeholder|before|after|selection|-webkit-[a-z-]+|-moz-[a-z-]+|-ms-[a-z-]+|first-letter|first-line)(?![a-z-])/g, '')]) {
        if (!q || /[,{]/.test(q)) continue;
        try { if (rec.matches(q) || rec.querySelector(q)) { hit = true; break; } } catch { /* селектор браузер не понял */ }
      }
      res[s] = hit;
    }
    return res;
  }, [id, sels]);
  if (!ok) { console.log('нет записи', id); continue; }
  const out = [];
  const emitted = new Map();
  for (const r of rules) {
    if (r.at) continue;
    if (!r.node.prelude.children) continue;
    const keep = r.node.prelude.children.toArray().filter((s) => ok[csstree.generate(s)]);
    if (!keep.length) continue;
    const decl = csstree.generate(r.node.block);
    const plain = (sel) => sel.replace(/:where\(\.t-records\)\s*/g, '').replace(/(^|[\s,])(#allrecords|\.t-records)\s+/g, '$1'); // предки страницы Tilda в копии не нужны
    const scope = (sel0) => {
      if (sel0.startsWith('#allrecords .r')) return '#rec' + id + plain(sel0.slice('#allrecords .r'.length));
      const sel = plain(sel0);
      if (sel.startsWith('#rec' + id)) return sel;
      // правило начинается с класса самой записи (.uc-faq .t-container) — это та же запись, а не её потомок
      if (recClasses.some((c) => sel.startsWith('.' + c) && !/^[\w-]/.test(sel.slice(c.length + 1)))) return ':where(#rec' + id + ')' + sel;
      return ':where(#rec' + id + ') ' + sel;
    }; // generic-правила Tilda ограничиваем записью, не меняя специфичность
    const rule = keep.map((s) => scope(csstree.generate(s))).join(',') + decl;
    let w = rule;
    for (const a of [...r.wrappers].reverse()) w = '@' + a.name + ' ' + csstree.generate(a.prelude) + '{' + w + '}';
    out.push(w);
  }
  // анимации/шрифты, на которые ссылаются оставленные правила, не нужны: у этих блоков своих @keyframes нет
  const css = out.join('\n').replace(new RegExp('#rec' + id, 'g'), '#r' + id);
  fs.mkdirSync('data/block-css', { recursive: true });
  fs.writeFileSync(`data/block-css/${id}.css`, css);
  console.log(id, 'правил', out.length, 'КБ', (css.length / 1024).toFixed(1));
}
await b.close();
