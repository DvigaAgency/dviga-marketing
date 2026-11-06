// Собирает адреса изображений/видео Tilda из снимков страниц (tools/pages.mjs) и дописывает их в data/assets-raw.json.
// Дальше: node tools/fetch-assets.mjs && node tools/optimize-images.mjs
import fs from 'node:fs';
import { PAGES } from './pages.mjs';

const rawFile = 'data/assets-raw.json';
const raw = new Set(fs.existsSync(rawFile) ? JSON.parse(fs.readFileSync(rawFile, 'utf8')) : []);
const norm = (u) => u.replace(/&amp;/g, '&').replace(/^\/\//, 'https://')
  .replace(/^https:\/\/thb\.tildacdn\.com\/([^/]+)\/-\/(?:resizeb?|empty)\/[^/]*\/?(?:-\/)?(.*)$/, 'https://static.tildacdn.com/$1/$2')
  .replace(/^https:\/\/optim\.tildacdn\.com\/([^/]+)\/-\/[^/]+\/(?:-\/)?(?:[^/]+\/)*([^/]+)$/, 'https://static.tildacdn.com/$1/$2')
  .replace(/(\.(?:jpe?g|png|gif))\.webp$/i, '$1'); // optim отдаёт «Name.jpg.webp» — оригинал лежит как «Name.jpg»
const before = raw.size;
const enSrc = fs.existsSync('data/en') ? fs.readdirSync('data/en').filter((f) => f.endsWith('.html')).map((f) => ({ src: `data/en/${f}` })) : []; // английская версия (SITE_LANG=en)
for (const p of [...PAGES.filter((x) => x.src), ...enSrc.filter((e) => !PAGES.some((x) => x.src === e.src))]) {
  const s = fs.readFileSync(p.src, 'utf8');
  for (const m of s.matchAll(/https?:\/\/(?:static|thb|optim)\.tildacdn\.com\/(?:tild|tila|vide)[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^"')\s<>&\\]+/g)) {
    const u = norm(m[0]);
    if (/^https:\/\/static\.tildacdn\.com\/(tild|tila|vide)/.test(u) && !/\/-\//.test(u)) raw.add(u);
  }
  // ролики кейсов лежат на хосте оригинала (адрес берётся из data-mp4video / <source src>)
  for (const m of s.matchAll(new RegExp('https://cp80604-bitrix-8\\.tw1\\.ru/[^"' + String.fromCharCode(39) + '<>]+?\\.(?:mp4|mov)', 'gi'))) raw.add(m[0]);
  // небольшие ролики на Dropbox (кейс Olympus: <video><source src=…>) — скачиваем и пережимаем как остальные
  for (const m of s.matchAll(/https:\/\/dl\.dropboxusercontent\.com\/s\/[a-z0-9]+\/[^"'<>\s]+?\.mp4\?dl=0/gi)) raw.add(m[0].replace(/&amp;/g, '&'));
}
// картинки курсоров Annexx (ANX013) — адреса лежат в настройках страниц (data/annexx.json), а не в HTML
if (fs.existsSync('data/annexx.json')) for (const v of Object.values(JSON.parse(fs.readFileSync('data/annexx.json', 'utf8')))) for (const k of v.cursor || []) raw.add(k.img);
fs.writeFileSync(rawFile, JSON.stringify([...raw], null, 1));
console.log('assets-raw:', before, '->', raw.size);
