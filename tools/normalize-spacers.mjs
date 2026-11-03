// Отступы-прокладки статьи: в оригинале «Город на ладони» все пустые Zero-записи 100/70, у остальных статей блога 60/40 (перед заголовком — 130/75). Приводит прокладки к общему виду.
// Запуск: node tools/normalize-spacers.mjs  (после clone-articles.mjs этой статьи)
import * as c from 'cheerio';
import fs from 'node:fs';
const f = 'data/pages/blog__gorod-na-ladoni-rasskazyvaem-pro-poisk-idei-dlya-sayta-zhilogo-kompleksa.html';
const $ = c.load(fs.readFileSync(f, 'utf8'), { decodeEntities: false });
const recs = $('#allrecords > .r').toArray();
let n = 0, h = 0;
recs.forEach((r, i) => {
  const rec = $(r); const ab = rec.find('.t396__artboard');
  if (rec.attr('data-record-type') !== '396' || rec.find('.t396__elem').length || ab.attr('data-artboard-height') !== '100' || ab.attr('data-artboard-height-res-640') !== '70') return;
  // заголовок следом (шрифт ≥30): большой отступ 130/75, иначе 60/40 — как у остальных статей блога
  let nx = recs[i + 1]; let head = false;
  if (nx) $(nx).find('.t396__elem[data-elem-type="text"]').each((j, e) => { if (+$(e).attr('data-field-fontsize-value') >= 30) head = true; });
  const [a, b] = head ? [130, 75] : [60, 40]; head && h++; n++;
  ab.attr('data-artboard-height', String(a)).attr('data-artboard-height-res-640', String(b));
  const st = rec.find('style').first();
  st.text(st.text().replaceAll('height:100px', 'height:' + a + 'px').replaceAll('height:70px', 'height:' + b + 'px'));
});
fs.writeFileSync(f, $.html());
console.log(n, 'spacers,', h, 'before headings');
