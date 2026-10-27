// Собирает снимок страницы статьи блога из снимка опубликованной страницы + нового текста по ТЗ.
// Запуск: node tools/article-snapshot.mjs plyusy-i-minusy-sayta-na-bitrix [путь к исходному снимку]
//
// Берёт data/pages/blog__<slug>.html (снимок live-страницы: шапка, обложка, плашка автора, CTA, «Свежие статьи»),
// оставляет в нём «рамку» страницы и заменяет тело статьи записями типа `article` — их разметка лежит в
// data/articles/<slug>.html (части разделены <!--part:N-->) и превращается в страницу сборкой (tools/lib/article.mjs).
// Исходный снимок сохраняется в data/articles/<slug>.source.html (скрипт можно запускать повторно).
// Здесь же: title/description/og, H1, хлебные крошки, время чтения, JSON-LD (Article + FAQPage), блок «Свежие статьи».
import fs from 'node:fs';
import * as cheerio from 'cheerio';
import { articleText } from './lib/article.mjs';
import { fillFresh } from './lib/fresh-articles.mjs';

const slug = process.argv[2];
if (!slug) throw new Error('usage: node tools/article-snapshot.mjs <slug> [source.html]');
const out = `data/pages/blog__${slug}.html`;
const cfg = JSON.parse(fs.readFileSync(`data/articles/${slug}.json`, 'utf8'));
const orig = `data/articles/${slug}.source.html`; // снимок опубликованной страницы — исходник «рамки»
const src = process.argv[3] || (fs.existsSync(orig) ? orig : out);
const $ = cheerio.load(fs.readFileSync(src, 'utf8'), { decodeEntities: false });
const body = fs.readFileSync(`data/articles/${slug}.html`, 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ---- head
$('title').text(cfg.title);
$('meta[name=description]').attr('content', cfg.description);
$('meta[property="og:title"]').attr('content', cfg.title);
$('meta[property="og:description"]').attr('content', cfg.description);

// ---- JSON-LD: Article (дата публикации оригинала, обновлена dateModified) + FAQPage из раздела «Вопросы и ответы»
const ld = $('script[type="application/ld+json"]').first();
const art = JSON.parse(ld.html());
art.headline = cfg.h1;
art.dateModified = cfg.modified;
ld.text(JSON.stringify(art, null, 1));
const $b = cheerio.load(`<div id="b">${body}</div>`, { decodeEntities: false });
const faq = [];
$b('#faq').nextAll().each((i, e) => {
  const el = $b(e);
  if (el.is('h2')) return false;
  if (el.is('h3')) faq.push({ q: el.text().trim(), a: '' });
  else if (el.is('p') && faq.length) faq[faq.length - 1].a += (faq[faq.length - 1].a ? ' ' : '') + el.text().trim();
});
$('script[data-faq]').remove();
$('head').append(`<script type="application/ld+json" data-faq>${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) })}</script>`);

// ---- первый экран: H1, хлебные крошки, время чтения
const setText = (rec, elemId, html) => $(`#rec${rec} .t396__elem[data-elem-id="${elemId}"] .tn-atom`).first().html(html);
setText('1168888241', '1700552209818', esc(cfg.h1).replace(/1[СC]-Битрикс/g, '<span style="white-space:nowrap">$&</span>')); // «1С-Битрикс» не переносится по дефису
const crumb = $('#rec1168888231 .t396__elem[data-elem-id="1707708571489"]');
crumb.find('.tn-atom__button-text').text(cfg.crumb);
crumb.attr('data-field-width-value', '520').attr('data-field-width-res-640-value', '345').attr('data-field-width-res-320-value', '190');
const words = articleText(body).split(/\s+/).filter(Boolean).length;
const minutes = Math.round(words / 230);
setText('1168888251', '1707888524873', `${minutes} мин`);

// ---- тело: оставляем рамку страницы, остальное заменяем записями article
const keep = ['1168888231', '1168888236', '1168888241', '1168888246', '1168888251', '1168888261', // шапка, крошки, H1, обложка с плашкой автора
  '1168888331', '867333522', '1170289596', '1170291921', '1170292846', // отступ, CTA «Созвонимся на 30 минут», отступ, отступ, плашка автора с цитатой
  '1168888421', '1168888426', '706100578', '1168888436', '1168888441']; // «поделиться», «Свежие статьи»
const rec = (id, n) => `<div id="rec${id}" class="r t-rec" data-record-type="article" data-article="${slug}" data-part="${n}"></div>`;
$('#allrecords > .r').each((i, e) => { if (!keep.includes($(e).attr('id').replace('rec', ''))) $(e).remove(); });
$('#rec1168888261').after(rec('9100000001', 1));
$('#rec1170289596').after(rec('9100000002', 2));
$('#rec1170292846').after(rec('9100000003', 3));

// ---- «Свежие статьи»: карточки (обложка, категории, время) — из листинга блога, названия и ссылки — из настроек статьи
if (cfg.fresh) fillFresh($, cheerio.load(fs.readFileSync('data/pages/blog.html', 'utf8'), { decodeEntities: false }), '1168888436', cfg.fresh);

// ---- цитата перед FAQ (плашка автора — запись Tilda сохранена, меняется только текст)
setText('1170292846', '1745997240173', cfg.quote);

if (!fs.existsSync(orig) && src === out) fs.copyFileSync(out, orig);
fs.writeFileSync(out, $.html());
console.log(out, 'слов:', words, '→', minutes, 'мин; вопросов FAQ:', faq.length);
