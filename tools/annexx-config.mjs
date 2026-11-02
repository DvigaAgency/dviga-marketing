// Настройки плагина Annexx и HTML-вставок со страниц услуг оригинала. В снимках страниц (trim-html) скрипты и комментарии вырезаны,
// поэтому забираем их с живой страницы. Результат: data/annexx.json
//   { "/services/<имя>": { hover: ["<recId>:<elemId>", …], drag: ["<recId>", …], boost: ["<recId>", …], scale: ["<recId>", …] } }
// hover — ссылки Zero-текстов, у которых при наведении текст краснеет (Annexx ANX001-1: селекторы «.tn-elem__<recId><elemId> .tn-atom a»);
// drag  — записи с горизонтальной лентой, которую тянут мышью (dragscroll у 864137673; ScrollBooster у записи из blockId);
// boost — из них те, где ScrollBooster: после отпускания лента докатывается по инерции;
// scale — стандартные блоки, которые Annexx ANX812-1 масштабирует как Zero (размер блока × ширина/опорная ширина, значения масштаба 100%).
// Запуск: node tools/annexx-config.mjs [<имя страницы услуг>…]   (без аргументов — все страницы из data/pages/services*.html)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const FILE = 'data/annexx.json';
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync('data/pages').filter((f) => /^services(__.+)?\.html$/.test(f)).map((f) => f.replace(/\.html$/, '').replace(/^services__/, '') || 'services');

function get(url) {
  for (let k = 0; k < 4; k++) {
    const r = spawnSync('curl', ['-sL', '--ssl-no-revoke', '-m', '120', '--fail', url], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    if (r.status === 0 && r.stdout.length > 50000) return r.stdout;
  }
  return null;
}

for (const name of names) {
  const path = name === 'services' ? '/services' : `/services/${name}`;
  const html = get(`https://dviga.marketing${path}`);
  if (!html) { console.log('FAIL загрузка', path); continue; }
  const e = { hover: [], drag: [], boost: [], scale: [] };
  // Annexx: <!--!ANX001-1!--><!--![ {"id":"1","data":"<селекторы>"}, {"id":"3","data":"<цвет>"} … ]!-->
  for (const m of html.matchAll(/<!--!ANNEXX!--><!--!(ANX\d+-\d+)!--!?><!--!(\[[^]*?\])!-->/g)) {
    let cfg;
    try { cfg = Object.fromEntries(JSON.parse(m[2]).map((x) => [x.id, x.data])); } catch { continue; }
    if (m[1] === 'ANX001-1') {
      if (cfg['3'] !== 'rgba(217, 52, 51, 1)') console.log('WARN цвет подсветки ссылок отличается', path, cfg['3']);
      for (const s of (cfg['1'] || '').split(/,\s*/)) {
        const d = /\.tn-elem__(\d+)\s+\.tn-atom a$/.exec(s)?.[1];
        if (d && d.length > 13) e.hover.push(`${d.slice(0, -13)}:${d.slice(-13)}`);
      }
    }
    if (m[1] === 'ANX812-1') {
      const scales = Object.entries(cfg).filter(([k]) => /^scale/.test(k)).map(([, v]) => v);
      if (scales.some((v) => v !== '100')) console.log('WARN масштаб блоков не 100%', path, cfg.blocks, scales.join('/'));
      for (const b of (cfg.blocks || '').split(/,\s*/)) { const id = /#rec(\d+)/.exec(b)?.[1]; if (id) e.scale.push(id); }
    }
  }
  // dragscroll: $('#rec864137673 .t396__artboard').addClass('dragscroll'); ScrollBooster: const blockId = '#rec<id>'
  for (const m of html.matchAll(/\$\('#rec(\d+)[^']*'\)\.addClass\('dragscroll'\)/g)) e.drag.push(m[1]);
  for (const m of html.matchAll(/blockId\s*=\s*'#rec(\d+)'/g)) { e.drag.push(m[1]); e.boost.push(m[1]); }
  for (const k of Object.keys(e)) e[k] = [...new Set(e[k])];
  out[path] = e;
  console.log(path.padEnd(70), `hover ${e.hover.length}, drag ${e.drag.join(',') || '—'}, scale ${e.scale.join(',') || '—'}`);
}
fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
