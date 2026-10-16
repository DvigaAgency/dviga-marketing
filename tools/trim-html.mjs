// Урезает снимок страницы Tilda до того, что нужно сборке: записи (#allrecords, header/footer), title/meta и JSON-LD.
// Без скриптов, внешних стилей и комментариев — снимок в 5–10 раз легче. Запуск: node tools/trim-html.mjs <in.html> <out.html>
import fs from 'node:fs';
import * as cheerio from 'cheerio';

export function trim(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  $('script').filter((i, e) => $(e).attr('type') !== 'application/ld+json').remove();
  $('link, noscript, head > style, base').remove();
  $('*').contents().filter((i, n) => n.type === 'comment').remove();
  return $.html();
}
if (process.argv[2]) {
  const [i, o] = process.argv.slice(2);
  const out = trim(fs.readFileSync(i, 'utf8'));
  fs.writeFileSync(o, out);
  console.log(o, (fs.statSync(i).size / 1024).toFixed(0), '->', (out.length / 1024).toFixed(0), 'КБ');
}
