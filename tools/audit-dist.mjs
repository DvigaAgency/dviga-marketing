// Проверка сборки: нет Tilda-рантайма, запрещённых хостов, классов Tilda и битых локальных ссылок.
// Запуск: node tools/audit-dist.mjs [dist]
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const root = process.argv[2] || 'dist';
const BASE = (process.env.BASE || '').replace(/[/]$/, '');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); } })(root);
const text = files.filter((f) => /\.(html|css|js|json|xml|txt)$/.test(f) || path.basename(f) === '_headers');
const FORBIDDEN = [
  ['tildacdn.com', /tildacdn\.com/i], ['tilda.ws / tilda.cc', /tilda\.(ws|cc)\b/i],
  ['Google Fonts', /fonts\.(googleapis|gstatic)\.com/i], ['jsdelivr', /cdn\.jsdelivr\.net/i], ['jQuery/slick/hammer/dragscroll', /jquery|\bslick\b|hammer\.js|dragscroll/i],
  ['классы Tilda t-rec / t396__ / tn-atom / tn-elem', /\bt-rec\b|t396__|tn-atom|tn-elem|t-records/],
];
let bad = 0;
for (const [name, re] of FORBIDDEN) {
  const strip = (f, s) => (name.startsWith('tilda.ws') && f.endsWith('.html') ? s.replace(/>[^<]+</g, '><') : s); // упоминание адреса в тексте статьи (инструкция про Tilda) — не ресурс
  const hits = text.filter((f) => re.test(strip(f, fs.readFileSync(f, 'utf8')).replace(/<a [^>]*>[^]*?<\/a>/g, ''))); // адреса в href — внешние ссылки-переходы (например, на сайт кейса), не ресурсы
  console.log(`${hits.length ? 'FAIL' : 'ok  '} ${name}${hits.length ? ': ' + hits.join(', ') : ''}`);
  bad += hits.length;
}
// страницы: все index.html в dist
const pages = files.filter((f) => path.basename(f) === 'index.html');
// счётчики оригинала (tools/lib/tracking.mjs): на каждой странице есть Метрика и коллтрекинг; если отключены (YM_ID=0, CT_PROJECT=0) — их нет нигде
const { YM_ID, CT_PROJECT } = await import('./lib/tracking.mjs');
const TRACKERS = [
  ['Яндекс.Метрика', YM_ID, /mc\.yandex\.ru\/metrika/, (id) => `ym('${id}',"init"`],
  ['calltracking', CT_PROJECT, /calltracking\.ru/, (id) => `.${id}.async.js`],
];
for (const [name, id, any, mark] of TRACKERS) {
  const html = pages.map((f) => [f, fs.readFileSync(f, 'utf8')]);
  const wrong = html.filter(([, h]) => (id ? !h.includes(mark(id)) : any.test(h))).map(([f]) => f);
  console.log(`${wrong.length ? 'FAIL' : 'ok  '} ${name} ${id ? id + ' на всех страницах' : 'отключён'}${wrong.length ? ': ' + wrong.join(', ') : ''}`);
  bad += wrong.length;
}
const mentions = new Set();
let missing = 0; let extCount = 0; let deadCount = 0; let refsTotal = 0;
for (const pf of pages) {
  const html = fs.readFileSync(pf, 'utf8');
  for (const m of html.match(/[a-z0-9./_:-]*tilda[a-z0-9./_-]*/gi) || []) mentions.add(m);
  const $ = cheerio.load(html);
  const refs = new Set();
  $('[src],[href],[srcset],[poster],[data-src],[data-poster]').each((i, e) => {
    for (const a of ['src', 'href', 'poster', 'data-src', 'data-poster']) { const v = $(e).attr(a); if (v) refs.add(v); }
    const ss = $(e).attr('srcset'); if (ss) ss.split(',').forEach((x) => refs.add(x.trim().split(/\s+/)[0]));
  });
  for (const m of html.matchAll(/url\((\/assets\/[^)]+)\)/g)) refs.add(m[1]);
  refsTotal += refs.size;
  for (const r of refs) {
    if (!r.startsWith('/') || r.startsWith('//') || r.includes('#')) continue;
    const rel = (BASE && r.startsWith(BASE + '/') ? r.slice(BASE.length) : r).split('?')[0];
    let p = path.join(root, rel);
    if (rel.endsWith('/')) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { console.log('FAIL нет файла', r, 'на', path.relative(root, pf) || 'index.html'); missing++; }
  }
  // внешние ссылки только как переходы (a[href]); ресурсы (img/script/link/source/video) — локальные
  const external = [];
  $('img[src],script[src],link[rel=stylesheet],link[rel=preload],link[rel=icon],link[rel=apple-touch-icon],source[src],source[srcset],video[src],video[data-src]').each((i, e) => { const v = $(e).attr('src') || $(e).attr('href') || ''; if (/^https?:|^\/\//.test(v)) external.push(v); });
  if (external.length) console.log('FAIL внешние ресурсы на', path.relative(root, pf) || 'index.html', external.join(', '));
  extCount += external.length;
  // якоря и попапы: каждый #hook ведёт на существующий попап/элемент
  const hooks = new Set($('[data-hook]').map((i, e) => $(e).attr('data-hook')).get());
  const dead = [];
  $('a[href^="#"]').each((i, e) => { const h = $(e).attr('href').slice(1); if (h && !['closepopup', 'closeallpopup'].includes(h) && !hooks.has(h) && !$('[id="' + h + '"]').length && !/^!\//.test(h) && h !== 'other' /* ссылка без цели и в оригинале */ && !/^popup:(my)?gallery/.test(h)) dead.push('#' + h); });
  if (dead.length) console.log('FAIL якоря без цели на', path.relative(root, pf) || 'index.html', [...new Set(dead)].join(', '));
  deadCount += dead.length;
}
// сайт закрыт от индексации: на каждой странице мета-тег noindex, в robots.txt нет sitemap
if (process.env.INDEX !== '1') {
  const open = pages.filter((f) => !/<meta name="robots" content="noindex,nofollow">/.test(fs.readFileSync(f, 'utf8')));
  console.log(open.length ? 'FAIL нет noindex: ' + open.join(', ') : 'ok   noindex на всех страницах');
  bad += open.length;
}
console.log('страниц проверено:', pages.length, '| упоминания «tilda» в HTML (ссылки/тексты, допустимо):', [...mentions].join(', '));
console.log(extCount ? 'FAIL внешние ресурсы' : 'ok   внешних подгружаемых ресурсов нет (внешние адреса — только ссылки-переходы)');
console.log('локальных ссылок проверено:', refsTotal, ', отсутствует:', missing);
console.log(deadCount ? 'FAIL якоря без цели' : 'ok   все #-ссылки ведут на попапы/элементы');
process.exit(bad + missing + extCount + deadCount ? 1 : 0);
