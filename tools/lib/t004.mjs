// Текстовый блок T004/T106 в статье блога (список источников в конце статьи «Как увеличить конверсию сайта»).
// Колонка — как у текста статьи (.ar-c), кегль 20/28 (≤480: 16/22.4), межбуквенный −0.5px, пункты списка с отступом 15px — в px оригинала, масштабируются вместе с макетом (src/css/article-table.css, .ar-t4x).
import { recPadding } from './zero.mjs';

export function textBlock($, rec, fixLinks) {
  const id = rec.attr('id').replace('rec', '');
  const t = rec.find('.t-text').first();
  t.find('li').removeAttr('data-list');
  return { id, css: recPadding(rec.attr('class') || '', id), html: `<section id="r${id}" class="r ar ar-tp"><div class="ar-c ar-t4x">${fixLinks(t.html())}</div></section>` };
}
