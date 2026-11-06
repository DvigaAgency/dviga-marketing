// Подсветка ссылок (Annexx «effect-link»: оглавление и др.) на страницах кейсов: скрипт плагина есть только на живой странице оригинала.
// Результат дописывается в data/articles/link-hover.json под ключом «cases/<слаг>»: { sel: [".tn-elem__<recId><elemId> .tn-atom a", …], color }.
// Запуск: node tools/link-hover-config.mjs [слаг кейса …]   (без аргументов — все data/pages/cases__*.html)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const FILE = 'data/articles/link-hover.json';
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync('data/pages').filter((f) => f.startsWith('cases__')).map((f) => f.slice(7, -5));
const get = (url) => { for (let k = 0; k < 4; k++) { const r = spawnSync('curl', ['-sL', '-m', '90', '--fail', url], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }); if (r.status === 0 && r.stdout.length > 30000) return r.stdout; } return null; };
let n = 0;
for (const slug of slugs) {
  const html = get(`https://dviga.marketing/cases/${slug}`);
  if (!html) { console.log('FAIL загрузка', slug); continue; }
  const hov = [];
  for (const m of html.matchAll(/<script[^>]*>([^]*?)<\/script>/g)) {
    const t = m[1];
    if (!t.includes('anx001-effect-link')) continue;
    const sel = /DOMContentLoaded[^]*?"((?:[^"\\]|\\.)*)"\.replace\(\/,/.exec(t)?.[1];
    const color = /:hover \{ color: (rgba?\([^)]*\)) !important/.exec(t)?.[1];
    if (sel && color && sel.includes('.tn-elem__')) hov.push({ sel: sel.split(/,\s*/).filter(Boolean), color });
  }
  if (!hov.length && fs.existsSync(`data/pages/cases__${slug}.html`)) {
    // на оригинале у части кейсов подсветки оглавления нет, но нужен единый вид (как у статей блога): пункты оглавления — Zero-тексты со ссылками-якорями (не попапы)
    const $p = cheerio.load(fs.readFileSync(`data/pages/cases__${slug}.html`, 'utf8'), { decodeEntities: false });
    const sel = $p('.t396__elem[data-elem-type="text"]').filter((i, e) => $p(e).find('a[href^="#"]').filter((j, a) => !/^#(menu|form|search|content|closepopup|closeallpopup|popup|order|rec\d)/.test($p(a).attr('href'))).length > 0).map((i, e) => `.tn-elem__${$p(e).closest('.r').attr('id').replace('rec', '')}${$p(e).attr('data-elem-id')} .tn-atom a`).get();
    if (sel.length >= 3) hov.push({ sel, color: 'rgba(223, 40, 40, 1)', fallback: true });
  }
  if (hov.length) { out[`cases/${slug}`] = hov; n++; } else delete out[`cases/${slug}`];
  console.log(slug.padEnd(75), hov.length ? hov.map((h) => h.sel.length + ' ссылок ' + h.color).join('; ') : '—');
}
fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
console.log('кейсов с подсветкой:', n);
