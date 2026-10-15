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
  ['tildacdn.com', /tildacdn\.com/i], ['tilda.ws / tilda.cc', /tilda\.(ws|cc)\b/i], ['Яндекс.Метрика', /mc\.yandex\.ru|metrika/i], ['calltracking', /calltracking/i],
  ['Google Fonts', /fonts\.(googleapis|gstatic)\.com/i], ['jsdelivr', /cdn\.jsdelivr\.net/i], ['jQuery/slick/hammer/dragscroll', /jquery|\bslick\b|hammer\.js|dragscroll/i],
  ['классы Tilda t-rec / t396__ / tn-atom / tn-elem', /\bt-rec\b|t396__|tn-atom|tn-elem|t-records/],
];
let bad = 0;
for (const [name, re] of FORBIDDEN) {
  const hits = text.filter((f) => re.test(fs.readFileSync(f, 'utf8')));
  console.log(`${hits.length ? 'FAIL' : 'ok  '} ${name}${hits.length ? ': ' + hits.join(', ') : ''}`);
  bad += hits.length;
}
// страницы: все index.html в dist
const pages = files.filter((f) => path.basename(f) === 'index.html');
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
  $('a[href^="#"]').each((i, e) => { const h = $(e).attr('href').slice(1); if (h && !['closepopup', 'closeallpopup'].includes(h) && !hooks.has(h) && !$('[id="' + h + '"]').length && !/^!\//.test(h)) dead.push('#' + h); });
  if (dead.length) console.log('FAIL якоря без цели на', path.relative(root, pf) || 'index.html', [...new Set(dead)].join(', '));
  deadCount += dead.length;
}
console.log('страниц проверено:', pages.length, '| упоминания «tilda» в HTML (ссылки/тексты, допустимо):', [...mentions].join(', '));
console.log(extCount ? 'FAIL внешние ресурсы' : 'ok   внешних подгружаемых ресурсов нет (внешние адреса — только ссылки-переходы)');
console.log('локальных ссылок проверено:', refsTotal, ', отсутствует:', missing);
console.log(deadCount ? 'FAIL якоря без цели' : 'ok   все #-ссылки ведут на попапы/элементы');
process.exit(bad + missing + extCount + deadCount ? 1 : 0);
