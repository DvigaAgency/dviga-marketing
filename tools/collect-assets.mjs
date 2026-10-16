// Собирает адреса изображений/видео Tilda из снимков страниц (tools/pages.mjs) и дописывает их в data/assets-raw.json.
// Дальше: node tools/fetch-assets.mjs && node tools/optimize-images.mjs
import fs from 'node:fs';
import { PAGES } from './pages.mjs';

const rawFile = 'data/assets-raw.json';
const raw = new Set(fs.existsSync(rawFile) ? JSON.parse(fs.readFileSync(rawFile, 'utf8')) : []);
const norm = (u) => u.replace(/&amp;/g, '&').replace(/^\/\//, 'https://')
  .replace(/^https:\/\/thb\.tildacdn\.com\/([^/]+)\/-\/(?:resizeb?|empty)\/[^/]*\/?(?:-\/)?(.*)$/, 'https://static.tildacdn.com/$1/$2')
  .replace(/^https:\/\/optim\.tildacdn\.com\/([^/]+)\/-\/[^/]+\/(?:-\/)?(?:[^/]+\/)*([^/]+)$/, 'https://static.tildacdn.com/$1/$2');
const before = raw.size;
for (const p of PAGES) {
  const s = fs.readFileSync(p.src, 'utf8');
  for (const m of s.matchAll(/https?:\/\/(?:static|thb|optim)\.tildacdn\.com\/(?:tild|vide)[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^"')\s<>&\\]+/g)) {
    const u = norm(m[0]);
    if (/^https:\/\/static\.tildacdn\.com\/(tild|vide)/.test(u) && !/\/-\//.test(u)) raw.add(u);
  }
  // ролики кейсов лежат на хосте оригинала (адрес берётся из data-mp4video / <source src>)
  for (const m of s.matchAll(new RegExp('https://cp80604-bitrix-8\\.tw1\\.ru/[^"' + String.fromCharCode(39) + '<>]+?\\.(?:mp4|mov)', 'gi'))) raw.add(m[0]);
}
fs.writeFileSync(rawFile, JSON.stringify([...raw], null, 1));
console.log('assets-raw:', before, '->', raw.size);
