// Скачивает сырой HTML всех страниц из sitemap.xml в reference/html/ (только чтение живого сайта).
import fs from 'node:fs';
import path from 'node:path';
const xml = fs.readFileSync('data/sitemap.xml', 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
fs.mkdirSync('reference/html', { recursive: true });
const slug = u => { const p = new URL(u).pathname.replace(/^\/|\/$/g, ''); return p ? p.replace(/\//g, '__') : 'home'; };
let i = 0, fail = [];
async function worker() {
  while (i < urls.length) {
    const u = urls[i++]; const f = `reference/html/${slug(u)}.html`;
    if (fs.existsSync(f) && fs.statSync(f).size > 1000) continue;
    try {
      const r = await fetch(u, { redirect: 'follow' });
      if (!r.ok) throw new Error(r.status);
      fs.writeFileSync(f, await r.text());
    } catch (e) { fail.push([u, String(e)]); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync('data/urls.json', JSON.stringify(urls, null, 1));
console.log('urls', urls.length, 'fail', fail);
