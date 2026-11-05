// Настройки плагина Annexx со страниц оригинала. В снимках страниц (trim-html) скрипты вырезаны, поэтому забираем их с живой страницы.
// 1) «Частые вопросы»: ответ — отдельная Zero-запись (tab), вопрос — набор элементов другой записи (elementaction, класс .tn-elem__<recId><elemId>),
//    starttab=true — ответ открыт сразу. Результат: data/articles/faq.json  { "<slug>": [ { "tab": "<recId ответа>", "q": "<recId вопроса>", "open": true|false } ] }
// 2) Карусели (slide___ + owl carousel): Zero-записи-слайды складываются в «шейп»-контейнер, стрелки — отдельные элементы записи.
//    Результат: data/articles/sliders.json  { "<slug>": [ { host, shape, slides:[recId…], items:"0:1,960:3", margin, loop, autoplay, speed, next:[elemId…], prev:[elemId…] } ] }
// 3) Подсветка ссылок (Annexx «effect-link»: оглавление и др.) — при наведении текст ссылки краснеет. Результат: data/articles/link-hover.json
//    { "<slug>": [ { sel: [".tn-elem__<recId><elemId> .tn-atom a", …], color: "rgba(223, 40, 40, 1)" } ] }
// Запуск: node tools/faq-config.mjs [slug…]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const cl = JSON.parse(fs.readFileSync('data/articles/clones.json', 'utf8'));
const all = [...Object.values(cl.topics).flat(), ...Object.keys(cl.existing).filter((s) => s !== 'plyusy-i-minusy-sayta-na-bitrix')];
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : all;
const FILE = 'data/articles/faq.json';
const SL = 'data/articles/sliders.json';
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const LH = 'data/articles/link-hover.json';
const outLh = fs.existsSync(LH) ? JSON.parse(fs.readFileSync(LH, 'utf8')) : {};
const outSl = fs.existsSync(SL) ? JSON.parse(fs.readFileSync(SL, 'utf8')) : {};
const alias = cl.listing || {};
const live = (s) => Object.entries(alias).find(([, v]) => v === s)?.[0] || s; // слаг на живом сайте мог поменяться

function get(url) {
  for (let k = 0; k < 4; k++) {
    const r = spawnSync('curl', ['-sL', '--ssl-no-revoke', '-m', '90', '--fail', url], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    if (r.status === 0 && r.stdout.length > 50000) return r.stdout;
  }
  return null;
}

for (const slug of slugs) {
  const html = get(`https://dviga.marketing/blog/${live(slug)}`);
  if (!html) { console.log('FAIL загрузка', slug); continue; }
  const scripts = [...html.matchAll(/<script[^>]*>([^]*?)<\/script>/g)].map((m) => m[1]);
  const hov = [];
  for (const t of scripts) {
    if (!t.includes('anx001-effect-link')) continue;
    const sel = /DOMContentLoaded[^]*?"((?:[^"\\]|\\.)*)"\.replace\(\/,/.exec(t)?.[1];
    const color = /:hover \{ color: (rgba?\([^)]*\)) !important/.exec(t)?.[1];
    if (sel && color && sel.includes('.tn-elem__')) hov.push({ sel: sel.split(/,\s*/).filter(Boolean), color });
  }
  if (!hov.length && fs.existsSync(`data/pages/blog__${slug}.html`)) {
    // у части статей на оригинале подсветки оглавления нет, но заказчица просит единый вид: пункты оглавления (Zero-тексты со ссылками-якорями) краснеют при наведении, как у остальных статей
    const $p = cheerio.load(fs.readFileSync(`data/pages/blog__${slug}.html`, 'utf8'), { decodeEntities: false });
    const sel = $p('.t396__elem[data-elem-type="text"]').filter((i, e) => $p(e).find('a[href^="#"]').length > 0).map((i, e) => `.tn-elem__${$p(e).closest('.r').attr('id').replace('rec', '')}${$p(e).attr('data-elem-id')} .tn-atom a`).get();
    if (sel.length >= 3) hov.push({ sel, color: 'rgba(223, 40, 40, 1)' });
  }
  if (hov.length) outLh[slug] = hov; else delete outLh[slug];
  const i = html.indexOf('objectDataTabNumber = ');
  if (i < 0) { delete out[slug]; delete outSl[slug]; console.log('нет плагина      ', slug); continue; }
  let d = 0; let j = i + 'objectDataTabNumber = '.length; const st = j;
  for (; j < html.length; j++) { if (html[j] === '[') d++; else if (html[j] === ']') { d--; if (!d) { j++; break; } } }
  const groups = JSON.parse(html.slice(st, j));
  const elemOf = (sel) => [...(sel || '').matchAll(/\.tn-elem__(\d+)/g)].map((m) => m[1]); // recId + elemId (13 цифр)
  const $h = cheerio.load(html);
  const list = [];
  const other = new Set();
  for (const g of groups) {
    const f = Object.fromEntries(g.filter((e) => e.data).map((e) => [e.name.replace('___tab-number', ''), e.data]));
    for (const k of Object.keys(f)) if (!['tab', 'elementaction', 'elementactionclose', 'starttab', 'animelement', 'slide', 'slide___slide-number'].includes(k)) other.add(k);
    const tab = /#rec(\d+)/.exec(f.tab || '')?.[1];
    let qs = [...new Set(elemOf(f.elementaction).map((x) => x.slice(0, -13)))];
    // триггер задан CSS-классом элемента (.btn1 …), а не id: ищем запись с таким элементом
    if (!qs.length && f.elementaction && /^\.[\w-]+$/.test(f.elementaction)) qs = [...new Set($h(f.elementaction).map((n, e) => $h(e).closest('.r').attr('id')?.replace('rec', '')).get().filter(Boolean))];
    if (tab && qs.length === 1) list.push({ tab, q: qs[0], open: f.starttab === 'true' });
  }
  out[slug] = list;
  const slides = groups.map((g) => /#rec(\d+)/.exec(g.find((e) => /^slide___/.test(e.name))?.data || '')?.[1]).filter(Boolean);
  if (slides.length) {
    const script = [...html.matchAll(/<script[^>]*>([^]*?)<\/script>/g)].map((m) => m[1]).find((t) => t.includes('slide___slide-number') && t.includes('owlCarousel')) || '';
    const q = (re) => re.exec(script)?.[1];
    const shape = q(/shapeSlider = document\.querySelector\("\.tn-elem__(\d+)"\)/);
    outSl[slug] = [{
      host: shape ? shape.slice(0, -13) : null, shape: shape ? shape.slice(-13) : null, slides,
      items: q(/items = \(function\(\) \{ if \(!isNaN\(\+"([^"]*)"\)\)/) || '1',
      margin: q(/margin = \(function\(\) \{ if \(!isNaN\(\+"([^"]*)"\)\)/) || '0',
      loop: q(/loop: (true|false)/) === 'true', autoplay: q(/autoplay: (true|false)/) === 'true', speed: +(q(/smartSpeed: (\d+)/) || 1000),
      next: elemOf(q(/nextSlideButton = "([^"]*)"/)).map((x) => x.slice(-13)), prev: elemOf(q(/prevSlideButton = "([^"]*)"/)).map((x) => x.slice(-13)),
    }];
    console.log('    карусель', JSON.stringify(outSl[slug][0]));
  } else delete outSl[slug];
  console.log('ok  ', slug.slice(0, 60).padEnd(61), 'вопросов', list.length, 'открыто', list.filter((x) => x.open).length, other.size ? 'ДРУГИЕ ПОЛЯ: ' + [...other] : '');
}
fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
fs.writeFileSync(SL, JSON.stringify(outSl, null, 1) + '\n');
fs.writeFileSync(LH, JSON.stringify(outLh, null, 1) + '\n');
