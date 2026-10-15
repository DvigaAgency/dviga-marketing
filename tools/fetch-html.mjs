// Скачивает исходный HTML главной dviga.marketing (только чтение живого сайта) в data/home.source.html
// (и копию reference/html/home.html для инструментов сравнения). С ключом --all — все страницы из sitemap.xml в reference/html/.
import fs from 'node:fs';
const all = process.argv.includes('--all');
const pagesMode = process.argv.includes('--pages');
const get = async (u) => { const r = await fetch(u, { redirect: 'follow' }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.text(); };
fs.mkdirSync('reference/html', { recursive: true });
if (pagesMode) {
  // страницы копии из tools/pages.mjs -> data/pages/<slug>.html (адреса /a/b -> a__b)
  const { PAGES } = await import('./pages.mjs');
  fs.mkdirSync('data/pages', { recursive: true });
  for (const p of PAGES.filter((x) => x.kind !== 'home')) {
    const html = await get('https://dviga.marketing' + p.path);
    fs.writeFileSync(p.src, html);
    console.log(p.path, (html.length / 1024).toFixed(0), 'КБ');
  }
  process.exit(0);
}
const home = await get('https://dviga.marketing/');
fs.writeFileSync('data/home.source.html', home);
fs.writeFileSync('reference/html/home.html', home);
console.log('home:', (home.length / 1024).toFixed(0), 'КБ');
if (all) {
  const xml = fs.readFileSync('data/sitemap.xml', 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const slug = (u) => { const p = new URL(u).pathname.split('/').filter(Boolean).join('__'); return p || 'home'; };
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (i < urls.length) { const u = urls[i++]; try { fs.writeFileSync('reference/html/' + slug(u) + '.html', await get(u)); } catch (e) { console.log('fail', u, e.message); } } }));
  console.log('pages:', urls.length);
}
