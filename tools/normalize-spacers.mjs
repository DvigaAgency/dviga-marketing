// Отступы-прокладки статьи: в оригинале «Город на ладони» все пустые Zero-записи 100/70, у остальных статей блога 60/40 (перед заголовком — 130/75). Приводит прокладки к общему виду.
// Запуск: node tools/normalize-spacers.mjs  (после clone-articles.mjs этой статьи)
import * as c from 'cheerio';
import fs from 'node:fs';
const f = 'data/pages/blog__gorod-na-ladoni-rasskazyvaem-pro-poisk-idei-dlya-sayta-zhilogo-kompleksa.html';
const $ = c.load(fs.readFileSync(f, 'utf8'), { decodeEntities: false });
const recs = $('#allrecords > .r').toArray();
const CTA = new Set(['867333522', '869290191']); // баннеры «Созвонимся…»: перед ними обычная прокладка 60/40, а не как перед заголовком
let n = 0, h = 0;
recs.forEach((r, i) => {
  const rec = $(r); const ab = rec.find('.t396__artboard');
  const nxId = recs[i + 1] && ($(recs[i + 1]).attr('id') || '').replace('rec', '');
  const done = ab.attr('data-artboard-height') === '130' && CTA.has(nxId); // уже приведена к 130/75 прошлым запуском
  if (rec.attr('data-record-type') !== '396' || rec.find('.t396__elem').length || !((ab.attr('data-artboard-height') === '100' && ab.attr('data-artboard-height-res-640') === '70') || done)) return;
  // заголовок следом (шрифт ≥30): большой отступ 130/75, иначе 60/40 — как у остальных статей блога
  let nx = recs[i + 1]; let head = false;
  const from = ab.attr('data-artboard-height'); const from2 = ab.attr('data-artboard-height-res-640');
  if (nx && !CTA.has(nxId)) $(nx).find('.t396__elem[data-elem-type="text"]').each((j, e) => { if (+$(e).attr('data-field-fontsize-value') >= 30) head = true; });
  const [a, b] = head ? [130, 75] : [60, 40]; head && h++; n++;
  ab.attr('data-artboard-height', String(a)).attr('data-artboard-height-res-640', String(b));
  const st = rec.find('style').first();
  st.text(st.text().replaceAll('height:' + from + 'px', 'height:' + a + 'px').replaceAll('height:' + from2 + 'px', 'height:' + b + 'px'));
});
// запись «После завершения брифинга»: в оригинале под текстом ~170px пустого артборда (у остальных статей 10–40) — убираем лишнее на каждом брейкпоинте
// прокладка перед заголовком «ЖК Port May» — 90 + ~10 остатка артборда выше = 100 на 1200 и 120 на 1440 (с масштабом); остаток записи «После завершения брифинга» режет gap-fit.json (ab 527/779)
const GAP = { '722907432': 90 };
for (const [id, v] of Object.entries(GAP)) { const r = $('#rec' + id); const ab = r.find('.t396__artboard'); const old = ab.attr('data-artboard-height'); if (old === String(v)) continue; ab.attr('data-artboard-height', String(v)); const st = r.find('style').first(); st.text(st.text().replaceAll('height:' + old + 'px', 'height:' + v + 'px')); }
const SLACK = { '722907437': { 'data-artboard-height': 168, 'data-artboard-height-res-960': 163, 'data-artboard-height-res-640': 163, 'data-artboard-height-res-480': 242, 'data-artboard-height-res-320': 210 } };
const REC = { '722907437': { 'data-artboard-height': 676, 'data-artboard-height-res-960': 686, 'data-artboard-height-res-640': 798, 'data-artboard-height-res-480': 1011, 'data-artboard-height-res-320': 933 } };
for (const [id, cut] of Object.entries(SLACK)) {
  const ab = $('#rec' + id + ' .t396__artboard'); const st = $('#rec' + id + ' style').first(); let css = st.text();
  for (const [k, v] of Object.entries(cut)) { const old = REC[id][k]; if (+ab.attr(k) !== old) continue; ab.attr(k, String(old - v)); const bp = { 'data-artboard-height': null, 'data-artboard-height-res-960': 1199, 'data-artboard-height-res-640': 959, 'data-artboard-height-res-480': 639, 'data-artboard-height-res-320': 479 }[k]; css = css.replaceAll('height:' + old + 'px', 'height:' + (old - v) + 'px'); }
  st.text(css);
}
fs.writeFileSync(f, $.html());
console.log(n, 'spacers,', h, 'before headings');
