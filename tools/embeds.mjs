// Скрипты виджетов T1370 с живых страниц оригинала (в снимках страниц скрипты вырезаны) -> data/articles/embeds.json { "<id записи>": { script } }.
// Запуск: node tools/embeds.mjs [слаг…]  (по умолчанию — все страницы блога, где есть запись типа 1370). Нужен доступ к dviga.marketing (прокси: HTTPS_PROXY).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as cheerio from 'cheerio';

const FILE = 'data/articles/embeds.json';
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const pages = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync('data/pages').filter((f) => /^blog__/.test(f) && fs.readFileSync('data/pages/' + f, 'utf8').includes('data-record-type="1370"')).map((f) => f.replace(/^blog__|\.html$/g, ''));
for (const slug of pages) {
  let html = '';
  for (let k = 0; k < 4 && html.length < 50000; k++) html = spawnSync('curl', ['-sSL', '--ssl-no-revoke', '-m', '120', `https://dviga.marketing/blog/${slug}`], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).stdout || '';
  const $ = cheerio.load(html, { decodeEntities: false });
  const ids = [];
  $('#allrecords > .r[data-record-type="1370"]').each((i, e) => { out[$(e).attr('id').replace('rec', '')] = { script: $(e).find('script').map((j, s) => $(s).html()).get().join('\n') }; ids.push($(e).attr('id')); });
  console.log(slug.padEnd(70), ids.join(','));
}
fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
