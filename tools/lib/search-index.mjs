// Индекс внутреннего поиска: по одной записи на страницу копии — [адрес, заголовок, описание, текст]. Собирается при сборке из снимков страниц
// (тот же текст, что видит посетитель, без меню, подвала, попапов и блока «Свежие статьи» — иначе статья «находилась» бы по названиям соседних) и кладётся в
// assets/search.<хэш>.json; браузер скачивает его один раз — при первом открытии поиска (src/js/search.js), на остальных страницах он не грузится.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';

const MAX_TEXT = 4500; // знаков текста на страницу: хватает для поиска по смыслу и держит индекс небольшим
const clean = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export function pageText($, slug) {
  const parts = [];
  const recs = $('#allrecords > .r').toArray();
  for (const n of recs) {
    const r = $(n);
    const type = r.attr('data-record-type');
    if (['1121678416', '1064388596'].includes(r.attr('id').replace('rec', ''))) continue; // попапы меню и формы — одинаковы на всех страницах
    if (['131', '215', '270', '360', '657', '702', '708', '756', '985', '1093', '943', '395', '400', '151'].includes(type)) continue; // служебные: код, якоря, формы, попапы, вкладки
    if (type === 'article') {
      const f = `data/articles/${r.attr('data-article') || slug}.html`;
      if (fs.existsSync(f)) parts.push(clean(fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')));
      continue;
    }
    const c = r.clone();
    c.find('style,script,noscript').remove();
    // «Свежие статьи»: запись с карточками (3+ ссылок на статьи блога) и заголовок перед ней
    if (c.find('a[href*="/blog/"]').length >= 3) continue;
    const t = clean(c.text());
    if (t === 'Свежие статьи') continue;
    if (t.startsWith('Главная') && t.length < 300) continue; // «хлебные крошки»
    // таблицы T431 хранят ячейки в скрытых блоках через «;» — разделители не нужны
    if (t) parts.push(t.replace(/;/g, ' ').split(' / / ').join(' '));
  }
  return clean(parts.join(' ')).slice(0, MAX_TEXT);
}

/** pages — PAGES из tools/pages.mjs; возвращает { name, json } (имя файла с хэшем содержимого) */
export function buildSearchIndex(pages) {
  const docs = [];
  for (const p of pages) {
    if (p.kind === 'redirect' || p.tab !== undefined && p.path !== '/blog') continue; // вкладки блога — та же страница /blog
    if (!p.src || !fs.existsSync(p.src)) continue;
    const $ = cheerio.load(fs.readFileSync(p.src, 'utf8'), { decodeEntities: false });
    const title = clean($('title').first().text());
    const descr = clean($('meta[name=description]').attr('content'));
    const slug = p.path.split('/').pop();
    const text = p.path === '/blog' ? '' : pageText($, slug);
    docs.push([p.path === '/' ? '/' : p.path + '/', title, descr, text]);
  }
  const json = JSON.stringify({ v: 1, d: docs });
  const name = `search.${crypto.createHash('sha1').update(json).digest('hex').slice(0, 8)}.json`;
  return { name, json, count: docs.length };
}
