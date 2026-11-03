// Настройки плагина Annexx и HTML-вставок со страниц услуг оригинала. В снимках страниц (trim-html) скрипты и комментарии вырезаны,
// поэтому забираем их с живой страницы. Результат: data/annexx.json
//   { "/services/<имя>" (или "/blog/<статья>"): { hover: ["<recId>:<elemId>", …], faq: [{ tab, q, open }], cursor: [{ rec, elem, img, w, link, dur }], drag: ["<recId>", …], boost: ["<recId>", …], scale: ["<recId>", …] } }
// hover — ссылки Zero-текстов, у которых при наведении текст краснеет (Annexx ANX001-1: селекторы «.tn-elem__<recId><elemId> .tn-atom a»);
// drag  — записи с горизонтальной лентой, которую тянут мышью (dragscroll у 864137673; ScrollBooster у записи из blockId);
// stick  — Annexx ANX831: блок закрепляется у верхнего края после прокрутки ({ rec, top, z });
// cursor — Annexx ANX013: над элементом вместо курсора — картинка (img, ширина w), клик открывает link;
// faq   — «Частые вопросы» из Zero-записей (Annexx ANX019): ответ (запись tab) скрыт, вопрос (запись q) по клику открывает его;
// boost — из них те, где ScrollBooster: после отпускания лента докатывается по инерции;
// scaleAll — масштабируются все стандартные (не Zero) записи страницы;
// scale — стандартные блоки, которые Annexx ANX812-1 масштабирует как Zero (размер блока × ширина/опорная ширина, значения масштаба 100%).
// Запуск: node tools/annexx-config.mjs [<имя страницы услуг> | /<страница верхнего уровня> | /blog/<статья>…]   (без аргументов — все страницы из data/pages/services*.html)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const FILE = 'data/annexx.json';
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const ROOT = ['about', 'partners', 'consent', 'policy', 'karta-saita', 'marketing-for-devepolers-proposal']; // страницы верхнего уровня
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [...fs.readdirSync('data/pages').filter((f) => /^services(__.+)?\.html$/.test(f)).map((f) => f.replace(/\.html$/, '').replace(/^services__/, '') || 'services'), ...ROOT.map((n) => '/' + n)];

function get(url) {
  for (let k = 0; k < 4; k++) {
    const r = spawnSync('curl', ['-sL', '--ssl-no-revoke', '-m', '120', '--fail', url], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    if (r.status === 0 && r.stdout.length > 50000) return r.stdout;
  }
  return null;
}

for (const name of names) {
  const path = name.startsWith('/') ? name : name === 'services' ? '/services' : `/services/${name}`;
  const html = get(`https://dviga.marketing${path}`);
  if (!html) { console.log('FAIL загрузка', path); continue; }
  const e = { hover: [], drag: [], boost: [], scale: [], faq: [], cursor: [], stick: [] };
  // «.tn-elem__<recId><elemId>»: у новых элементов id длиннее 13 цифр, поэтому recId выбираем из записей страницы
  const recIds = [...new Set([...html.matchAll(/id="rec(\d+)"/g)].map((m) => m[1]))];
  const split = (d) => { const r = recIds.filter((x) => d.startsWith(x) && d.length - x.length >= 13).sort((a, b) => b.length - a.length)[0] || d.slice(0, -13); return [r, d.slice(r.length)]; };
  // Annexx: <!--!ANX001-1!--><!--![ {"id":"1","data":"<селекторы>"}, {"id":"3","data":"<цвет>"} … ]!-->
  for (const m of html.matchAll(/<!--!ANNEXX!--><!--!(ANX\d+-\d+)!--!?><!--!(\[[^]*?\])!-->/g)) {
    let cfg;
    try { cfg = Object.fromEntries(JSON.parse(m[2]).map((x) => [x.id, x.data])); } catch { continue; }
    if (m[1] === 'ANX001-1') {
      if (cfg['3'] !== 'rgba(217, 52, 51, 1)') console.log('WARN цвет подсветки ссылок отличается', path, cfg['3']);
      for (const s of (cfg['1'] || '').split(/,\s*/)) {
        const d = /\.tn-elem__(\d+)\s+\.tn-atom a$/.exec(s)?.[1];
        if (d && d.length > 13) e.hover.push(split(d).join(':'));
      }
    }
    if (m[1] === 'ANX013-1' && cfg.shape && cfg['cursor-for-shape']) {
      // курсор-картинка над элементом (кнопка «Play» на обложке видео); клик открывает ролик
      const d = /\.tn-elem__(\d+)/.exec(cfg.shape)?.[1];
      if (d && d.length > 13) e.cursor.push({ rec: split(d)[0], elem: split(d)[1], img: cfg['cursor-for-shape'], w: +cfg['width-cursor-shape'] || 100, link: cfg['link-shape'] || '', dur: +cfg['duration-shape'] || 200 });
    }
    if (m[1] === 'ANX831-1') {
      // «прилипающий» блок: после прокрутки закрепляется у верхнего края (position:fixed; top:offset; z-index) — например кнопка «Содержание» у статей
      const id = /#rec(\d+)/.exec(cfg.block || '')?.[1];
      if (id) e.stick.push({ rec: id, top: +cfg.offset || 0, z: +cfg.zindex || 999 });
    }
    if (m[1] === 'ANX812-1') {
      const scales = Object.entries(cfg).filter(([k]) => /^scale/.test(k)).map(([, v]) => v);
      if (scales.some((v) => v !== '100')) console.log('WARN масштаб блоков не 100%', path, cfg.blocks, scales.join('/'));
      for (const b of (cfg.blocks || '').split(/,\s*/)) { const id = /#rec(\d+)/.exec(b)?.[1]; if (id) e.scale.push(id); }
      if (/:not\(\[data-record-type='396'\]\)/.test(cfg.blocks || '')) e.scaleAll = true; // все записи, кроме Zero (политика, согласие)
    }
  }
  // dragscroll: $('#rec864137673 .t396__artboard').addClass('dragscroll'); ScrollBooster: const blockId = '#rec<id>'
  for (const m of html.matchAll(/\$\('#rec(\d+)[^']*'\)\.addClass\('dragscroll'\)/g)) e.drag.push(m[1]);
  for (const m of html.matchAll(/blockId\s*=\s*'#rec(\d+)'/g)) { e.drag.push(m[1]); e.boost.push(m[1]); }
  // «Библиотека VORON» (боковой скролл Zero): scrollableBlocks = ['#rec<id>'] — тянется мышью, докатывается по инерции
  for (const m of html.matchAll(/scrollableBlocks\s*=\s*\[([^\]]*)\]/g)) for (const r of m[1].matchAll(/#rec(\d+)/g)) { e.drag.push(r[1]); e.boost.push(r[1]); }
  // Annexx ANX019 (вкладки по клику): группы [{name:"tab___tab-number", data:"#rec<ответ>"}, {name:"blockaction___tab-number", data:"#rec<вопрос>"}, …]
  const key = '[[{"name":"tab___tab-number"';
  const fi = html.indexOf(key);
  if (fi >= 0) {
    let dep = 0; let j = fi;
    for (; j < html.length; j++) { if (html[j] === '[') dep++; else if (html[j] === ']') { dep--; if (!dep) { j++; break; } } }
    try {
      for (const g of JSON.parse(html.slice(fi, j))) {
        const f = Object.fromEntries(g.filter((x) => x.data).map((x) => [x.name.replace('___tab-number', ''), x.data]));
        const tab = /#rec(\d+)/.exec(f.tab || '')?.[1]; const q = /#rec(\d+)/.exec(f.blockaction || '')?.[1];
        if (tab && q) e.faq.push({ tab, q, open: f.starttab === 'true' });
      }
    } catch { console.log('WARN не разобрана настройка вкладок', path); }
  }
  for (const k of ['hover', 'drag', 'boost', 'scale']) e[k] = [...new Set(e[k])];
  if (!e.scaleAll) delete e.scaleAll;
  if (path.startsWith('/blog/')) e.hover = []; // подсветка ссылок у статей блога — data/articles/link-hover.json (tools/faq-config.mjs, цвет rgba(223, 40, 40))
  out[path] = e;
  console.log(path.padEnd(70), `hover ${e.hover.length}, drag ${e.drag.join(',') || '—'}, scale ${e.scale.join(',') || '—'}`);
}
fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
