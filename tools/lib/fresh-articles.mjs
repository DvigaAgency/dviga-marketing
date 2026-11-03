// Блок «Свежие статьи» на странице статьи (Zero-запись с тремя карточками): карточки заменяются карточками статей из листинга блога —
// обложка, категории и время берутся из карточки листинга (data/pages/blog.html), название и ссылка — из настроек статьи.
// Узлы карточки копируются целиком вместе с CSS-правилами и перекладываются на координаты слотов блока (как в blog-pin.mjs).
import { BPS, attrName, abName, eff, parseRow, takeCss } from './blog-pin.mjs';

const role = (el) => { const t = el.attr('data-elem-type'); return t !== 'text' ? t : el.find('a').length ? 'title' : /мин/.test(el.text()) ? 'time' : 'tag'; };
const SIZE = ['left', 'top', 'width', 'height'];

const hasImage = ($, shapes) => shapes.filter((j, e) => $(e).find('.tn-atom[data-original], .tn-atom[style*="url("]').length);

/** items: [{ slug (статья в листинге; listing — если в листинге другой адрес), title, href }] — по порядку слотов слева направо */
export function fillFresh($a, $l, recId, items) {
  const rec = $a(`#rec${recId}`);
  const ab = rec.find('.t396__artboard').first();
  const slots = parseRow($a, rec, hasImage($a, ab.children('.t396__elem[data-elem-type="shape"]')));
  if (slots.cards.length !== items.length) throw new Error(`fresh-articles: в блоке ${slots.cards.length} карточек, а статей ${items.length}`);
  const abHeight = Object.fromEntries(BPS.map((bp) => [bp, eff(ab, 'height', bp, abName)])); // высота блока — как у оригинала
  const origin = slots.cards.map((c) => Object.fromEntries(BPS.map((bp) => [bp, { left: eff(c.shape, 'left', bp), top: eff(c.shape, 'top', bp) }])));

  // старые карточки: узлы и их правила — долой
  // старые карточки: их узлы и правила снимаем; карточка статьи, которая остаётся в блоке, возвращается как есть (в листинге у неё может быть другой, крупный вид — закреплённая карточка 750×410)
  const old = slots.cards.map((c) => ({ card: c, css: takeCss($a, rec, c.els.map((e) => e.attr('data-elem-id'))) }));
  slots.cards.forEach((c) => c.els.forEach((e) => e.remove()));

  const need = Object.fromEntries(BPS.map((bp) => [bp, 0]));
  const seen = new Set();
  items.forEach((it, k) => {
    const slug = it.listing || it.slug;
    const kept = old.find((o) => o.card.href && o.card.href.endsWith(`/blog/${slug}`));
    let $s = $l; let lrec; let row; let card;
    if (kept) { $s = $a; lrec = rec; row = slots; card = kept.card; } else {
      const a = $l(`a[href$="/blog/${slug}"]`).first();
      if (!a.length) throw new Error(`fresh-articles: в листинге нет карточки ${slug}`);
      lrec = a.closest('.r');
      row = parseRow($l, lrec, hasImage($l, lrec.find('.t396__elem[data-elem-type="shape"]')));
      card = row.cards.find((c) => c.href.endsWith(`/blog/${slug}`));
    }
    const rowTops = (bp) => Math.max(...row.cards.map((c) => eff(c.shape, 'top', bp)));
    let css = kept ? kept.css : takeCss($l, lrec, card.els.map((e) => e.attr('data-elem-id')), false).replaceAll(`#rec${lrec.attr('id').replace('rec', '')}`, `#rec${recId}`);
    // в листинге один и тот же id бывает у элементов разных записей: в одном блоке id должны быть разными
    const remap = {};
    for (const el of card.els) {
      const id = el.attr('data-elem-id');
      if (seen.has(id)) { remap[id] = `${id}${k + 1}`; css = css.replaceAll(`data-elem-id="${id}"`, `data-elem-id="${remap[id]}"`); }
    }
    for (const el of card.els) {
      const id = el.attr('data-elem-id');
      seen.add(remap[id] || id);
      let html = $s.html(el);
      if (remap[id]) html = html.replaceAll(`data-elem-id="${id}"`, `data-elem-id="${remap[id]}"`);
      const clone = $a(html);
      // размеры и положение — как в слоте оригинала (в листинге карточки крупнее: картинка 220 вместо 200)
      // пара из слота оригинала: по роли и порядку; у карточки с двумя категориями («Сайты», «Недвижимость») в слоте их может быть меньше — тогда координаты по смещению карточки
      const r = role(el); const mine = card.els.filter((o) => role(o) === r); const theirs = old[k].card.els.filter((o) => role(o) === r);
      const twin = mine.length === theirs.length ? theirs[mine.indexOf(el)] : r === 'tag' ? undefined : theirs[0];
      if (twin) for (const bp of BPS) for (const f of SIZE) { const v = eff(twin, f, bp); if (!Number.isNaN(v) && f !== 'left' && f !== 'top') clone.attr(attrName(f, bp), String(v)); }
      for (const bp of BPS) {
        if (twin) { for (const f of ['left', 'top']) { const v = eff(twin, f, bp); if (!Number.isNaN(v)) clone.attr(attrName(f, bp), String(v)); } continue; }
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
  for (const bp of BPS) ab.attr(abName('height', bp), String(Number.isNaN(abHeight[bp]) ? Math.round(need[bp]) : abHeight[bp]));
}
