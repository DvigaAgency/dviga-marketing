// Тело статьи блога: запись типа `article` снимка (data-article="<slug>" data-part="N") -> секция с обычной вёрсткой в потоке.
// Текст лежит в data/articles/<slug>.html (части разделены <!--part:N-->). В оригинале каждый абзац — отдельный Zero-блок с
// фиксированной высотой; здесь тот же вид (колонка, кегли, интервалы — src/css/article.css), но высота определяется текстом.
import fs from 'node:fs';

const PREP = 'в|во|и|к|ко|с|со|о|об|от|до|по|за|на|не|ни|но|а|у|из|для|без|при|над|под|про|что|как|или|же|бы|ли|то|да|я|мы|вы|он|она|они';
const prepRe = new RegExp(`(^|[\\s(«"'>])(${PREP})[ ](?=\\S)`, 'gi');

/** типографика Tilda: неразрывный пробел после коротких слов, перед тире, внутри чисел с разрядами и перед «₽» (только в тексте, не в тегах) */
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

/** запись article -> { id, html } (fixLinks — переписывание адресов страниц оригинала на копию) */
export function articleBlock($, rec, fixLinks) {
  const id = rec.attr('id').replace('rec', '');
  const body = load(rec.attr('data-article'))[rec.attr('data-part')];
  if (!body) throw new Error(`нет части ${rec.attr('data-part')} статьи ${rec.attr('data-article')}`);
  return { id, html: `<section id="r${id}" class="r ar"><div class="ar-c">${fixLinks(typo(body.trim()))}</div></section>` };
}
