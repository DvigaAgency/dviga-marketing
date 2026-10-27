// Тело статьи блога: запись типа `article` снимка (data-article="<slug>" data-part="N") -> секции с обычной вёрсткой в потоке.
// Текст лежит в data/articles/<slug>.html (части разделены <!--part:N-->). В оригинале каждый абзац — отдельный Zero-блок с
// фиксированной высотой; здесь тот же вид (колонка, кегли, интервалы — src/css/article.css), но высота определяется текстом.
// Таблицы выходят из узкой колонки в отдельные секции с видом таблицы T431 (как в остальных статьях), раздел FAQ — аккордеон.
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const PREP = 'в|во|и|к|ко|с|со|о|об|от|до|по|за|на|не|ни|но|а|у|из|для|без|при|над|под|про|что|как|или|же|бы|ли|то|да|я|мы|вы|он|она|они';
const prepRe = new RegExp(`(^|[\\s(«"'>])(${PREP})[ ](?=\\S)`, 'gi');

/** типографика Tilda: неразрывный пробел после коротких слов, перед тире, внутри чисел с разрядами и перед «₽» (только в тексте, не в тегах); «1С-Битрикс» не переносится по дефису */
export function typo(html) {
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) return part;
    let t = part;
    for (let i = 0; i < 2; i++) t = t.replace(prepRe, '$1$2&nbsp;');
    return t.replace(/ —/g, '&nbsp;—').replace(/(?<=\d) (?=\d{3}(?!\d))/g, '&nbsp;').replace(/(\d) (₽|ГБ|мин)/g, '$1&nbsp;$2').replace(/1[СC]-Битрикс/g, '<span class="nw">$&</span>');
  }).join('');
}

/** простой текст статьи (для подсчёта слов) */
export const articleText = (html) => html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const parts = new Map();
function load(slug) {
  if (!parts.has(slug)) {
    const src = fs.readFileSync(`data/articles/${slug}.html`, 'utf8');
    const m = {};
    for (const chunk of src.split(/<!--part:(\d+)-->/).slice(1).reduce((a, v, i, arr) => (i % 2 ? a : [...a, [v, arr[i + 1]]]), [])) m[chunk[0]] = chunk[1];
    parts.set(slug, m);
  }
  return parts.get(slug);
}

/** FAQ: пары «h3 — p» после <h2 id="faq"> -> аккордеон (разметка и скрипт — как у t668, src/js/accordion.js) */
function faq($, h2) {
  const items = [];
  let n = h2.next();
  while (n.length && !n.is('h2')) {
    if (n.is('h3')) items.push({ q: n.html(), a: '' });
    else if (items.length) items[items.length - 1].a += $.html(n);
    n = n.next();
  }
  const html = items.map((x) => `<div class="t668__accordion ar-fi"><div class="t668__header"><button type="button" class="t668__trigger-button ar-fq" aria-expanded="false"><span>${x.q}</span><i aria-hidden="true"></i></button></div><div class="t668__content ar-fa" hidden>${x.a}</div></div>`).join('');
  h2.nextAll().remove();
  h2.after(`<div class="ar-faq" data-acc>${html}</div>`);
}

/** таблица статьи -> секция в колонке контента, вид T431 эталона (ширины колонок — data-w, последняя колонка занимает остаток; сноска — под таблицей) */
function tableSection(id, table, note = '') {
  const w = (table.attr('data-w') || '').split(';').filter(Boolean);
  const col = w.map((x) => `<col style="width:${x}">`).join('') + '<col>';
  return `<section id="${id}" class="r ar ar-tb"><div class="ar-c ar-tbl"><div class="ar-tsc"><table class="ar-tt${w.length >= 3 ? ' ar-tt-wide' : ''}"><colgroup>${col}</colgroup>${table.html()}</table></div>${note}</div></section>`;
}

/** запись article -> { id, html } (fixLinks — переписывание адресов страниц оригинала на копию) */
export function articleBlock($, rec, fixLinks) {
  const id = rec.attr('id').replace('rec', '');
  const body = load(rec.attr('data-article'))[rec.attr('data-part')];
  if (!body) throw new Error(`нет части ${rec.attr('data-part')} статьи ${rec.attr('data-article')}`);
  const $b = cheerio.load(`<div id="ar">${typo(body.trim())}</div>`, { decodeEntities: false });
  const faqH2 = $b('#ar > h2#faq');
  if (faqH2.length) faq($b, faqH2);
  const out = []; let buf = []; let n = 0;
  const flush = () => { if (buf.length) out.push(`<section id="r${id}${n ? `-${n}` : ''}" class="r ar"><div class="ar-c">${buf.join('')}</div></section>`); n++; buf = []; };
  const kids = $b('#ar').children().toArray();
  for (let i = 0; i < kids.length; i++) {
    const el = $b(kids[i]);
    if (el.is('.ar-tw')) {
      flush();
      const next = kids[i + 1] && $b(kids[i + 1]).is('p.ar-fn') ? $b.html(kids[++i]) : '';
      out.push(tableSection(`r${id}-${n++}`, el.find('table'), next));
    } else buf.push($b.html(el));
  }
  flush();
  return { id, html: fixLinks(out.join('')) };
}
