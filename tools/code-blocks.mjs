// Блоки с кодом (T264, запись типа 285): на оригинале подсветку (highlight.js, тема github) рисует скрипт Tilda в браузере, в снимок страницы она не попадает.
// Скрипт открывает страницы оригинала и сохраняет готовую подсвеченную разметку <code> каждой записи — data/articles/code-blocks.json (id записи -> html).
// Запуск: node tools/code-blocks.mjs [слаг…]  (по умолчанию — все страницы блога, где есть запись типа 285). Нужен Playwright и доступ к dviga.marketing (прокси: HTTPS_PROXY).
import fs from 'node:fs';
import { chromium } from 'playwright';

const FILE = 'data/articles/code-blocks.json';
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const pages = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync('data/pages').filter((f) => /^blog__/.test(f) && fs.readFileSync('data/pages/' + f, 'utf8').includes('data-record-type="285"')).map((f) => f.replace(/^blog__|\.html$/g, ''));
const proxy = process.env.HTTPS_PROXY ? { server: 'http://' + process.env.HTTPS_PROXY.replace(/^https?:\/\//, ''), bypass: 'localhost' } : undefined;
const b = await chromium.launch({ proxy });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
for (const slug of pages) {
  await p.goto(`https://dviga.marketing/blog/${slug}`, { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(2500);
  const res = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.r[data-record-type="285"]')].map((r) => [r.id.replace('rec', ''), r.querySelector('code') ? r.querySelector('code').innerHTML : null]).filter((x) => x[1])));
  Object.assign(out, res);
  console.log(slug.padEnd(50), Object.keys(res).join(','));
}
await b.close();
fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
