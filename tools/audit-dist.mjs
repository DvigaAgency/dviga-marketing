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
// допустимые упоминания «tilda» (ссылки на experts.tilda.ru и слова в текстах/адресах услуг)
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mentions = [...new Set(html.match(/[a-z0-9./_:-]*tilda[a-z0-9./_-]*/gi))];
console.log('упоминания «tilda» в HTML (ссылки/тексты, допустимо):', mentions.join(', '));
// ссылки на ресурсы: все локальные пути существуют
const $ = cheerio.load(html);
const refs = new Set();
$('[src],[href],[srcset],[poster],[data-src],[data-poster]').each((i, e) => {
  for (const a of ['src', 'href', 'poster', 'data-src', 'data-poster']) { const v = $(e).attr(a); if (v) refs.add(v); }
  const ss = $(e).attr('srcset'); if (ss) ss.split(',').forEach((x) => refs.add(x.trim().split(/\s+/)[0]));
});
for (const m of html.matchAll(/url\((\/assets\/[^)]+)\)/g)) refs.add(m[1]);
let missing = 0;
for (const r of refs) { if (r.startsWith('/') && !r.startsWith('//') && !r.includes('#')) { if (!fs.existsSync(path.join(root, (BASE && r.startsWith(BASE + '/') ? r.slice(BASE.length) : r).split('?')[0]))) { console.log('FAIL нет файла', r); missing++; } } }
// внешние ссылки только как переходы (a[href]); ресурсы (img/script/link/source/video) — локальные
const external = [];
$('img[src],script[src],link[rel=stylesheet],link[rel=preload],link[rel=icon],link[rel=apple-touch-icon],source[src],source[srcset],video[src],video[data-src]').each((i, e) => { const v = $(e).attr('src') || $(e).attr('href') || ''; if (/^https?:|^\/\//.test(v)) external.push(v); });
console.log(external.length ? `FAIL внешние ресурсы: ${external.join(', ')}` : 'ok   внешних подгружаемых ресурсов нет (внешние адреса — только ссылки-переходы)');
console.log(`локальных ссылок проверено: ${refs.size}, отсутствует: ${missing}`);
// якоря и попапы: каждый #hook ведёт на существующий попап/элемент
const hooks = new Set($('[data-hook]').map((i, e) => $(e).attr('data-hook')).get());
const deadAnchors = [];
$('a[href^="#"]').each((i, e) => { const h = $(e).attr('href').slice(1); if (h && !['closepopup', 'closeallpopup'].includes(h) && !hooks.has(h) && !$(`[id="${h}"]`).length) deadAnchors.push('#' + h); });
console.log(deadAnchors.length ? `FAIL якоря без цели: ${[...new Set(deadAnchors)].join(', ')}` : `ok   все #-ссылки ведут на попапы/элементы (попапов: ${hooks.size})`);
process.exit(bad + missing + external.length + deadAnchors.length ? 1 : 0);
