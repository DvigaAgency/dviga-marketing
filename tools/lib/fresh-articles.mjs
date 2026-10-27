// Блок «Свежие статьи» на странице статьи (Zero-запись с тремя карточками): карточки заменяются карточками статей из листинга блога —
// обложка, категории и время берутся из карточки листинга (data/pages/blog.html), название и ссылка — из настроек статьи.
// Узлы карточки копируются целиком вместе с CSS-правилами и перекладываются на координаты слотов блока (как в blog-pin.mjs).
import { BPS, attrName, abName, eff, parseRow, takeCss } from './blog-pin.mjs';

const hasImage = ($, shapes) => shapes.filter((j, e) => $(e).find('.tn-atom[data-original], .tn-atom[style*="url("]').length);

/** items: [{ slug (статья в листинге; listing — если в листинге другой адрес), title, href }] — по порядку слотов слева направо */
export function fillFresh($a, $l, recId, items) {
  const rec = $a(`#rec${recId}`);
  const ab = rec.find('.t396__artboard').first();
  const slots = parseRow($a, rec, hasImage($a, ab.children('.t396__elem[data-elem-type="shape"]')));
  if (slots.cards.length !== items.length) throw new Error(`fresh-articles: в блоке ${slots.cards.length} карточек, а статей ${items.length}`);
  const origin = slots.cards.map((c) => Object.fromEntries(BPS.map((bp) => [bp, { left: eff(c.shape, 'left', bp), top: eff(c.shape, 'top', bp) }])));

  // старые карточки: узлы и их правила — долой
  const oldIds = slots.cards.flatMap((c) => c.els.map((e) => e.attr('data-elem-id')));
  takeCss($a, rec, oldIds);
  slots.cards.forEach((c) => c.els.forEach((e) => e.remove()));

  const need = Object.fromEntries(BPS.map((bp) => [bp, 0]));
  const seen = new Set();
  items.forEach((it, k) => {
    const slug = it.listing || it.slug;
    const a = $l(`a[href$="/blog/${slug}"]`).first();
    if (!a.length) throw new Error(`fresh-articles: в листинге нет карточки ${slug}`);
    const lrec = a.closest('.r');
    const row = parseRow($l, lrec, hasImage($l, lrec.find('.t396__elem[data-elem-type="shape"]')));
    const card = row.cards.find((c) => c.href.endsWith(`/blog/${slug}`));
    const rowTops = (bp) => Math.max(...row.cards.map((c) => eff(c.shape, 'top', bp)));
    const css = takeCss($l, lrec, card.els.map((e) => e.attr('data-elem-id')), false).replaceAll(`#rec${lrec.attr('id').replace('rec', '')}`, `#rec${recId}`);
    for (const el of card.els) {
      const id = el.attr('data-elem-id');
      if (seen.has(id)) throw new Error(`fresh-articles: повтор id элемента ${id}`);
      seen.add(id);
      const clone = $a($l.html(el));
      for (const bp of BPS) {
        const dx = origin[k][bp].left - eff(card.shape, 'left', bp);
        const dy = origin[k][bp].top - eff(card.shape, 'top', bp);
        clone.attr(attrName('left', bp), String(Math.round((eff(el, 'left', bp) + dx) * 100) / 100));
        clone.attr(attrName('top', bp), String(Math.round((eff(el, 'top', bp) + dy) * 100) / 100));
      }
      ab.append(clone);
    }
    if (css) rec.append(`<style>${css}</style>`);
    // высота блока — по самой высокой из карточек
    for (const bp of BPS) need[bp] = Math.max(need[bp], origin[k][bp].top + eff(row.ab, 'height', bp, abName) - rowTops(bp));
    // название и ссылка
    const link = ab.find(`.t396__elem a[href$="/blog/${slug}"]`).first();
    if (it.href) link.attr('href', it.href);
    if (it.title) link.text(it.title);
  });
  for (const bp of BPS) ab.attr(abName('height', bp), String(Math.round(need[bp])));
}
