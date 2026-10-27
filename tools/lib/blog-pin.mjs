// Карточка статьи — первой в сетке блога (по 3 в ряд): остальные карточки до её прежнего места сдвигаются на одну позицию.
// Сетка блога — Zero-блоки: ряд = запись с тремя карточками (картинка, заголовок, время, теги), у каждого элемента координаты
// на каждом брейкпоинте. Поэтому карточки переносятся целиком: элементы (узлы) переезжают в запись нужного ряда, их координаты
// пересчитываются на сдвиг «слот → слот» на всех брейкпоинтах (на 320/480/640 карточки стоят друг под другом), высота рядов —
// по самой высокой из новых карточек. Стили элементов лежат в <style> их записи (у копий карточек id элементов совпадают, поэтому
// в итоговом CSS они привязаны к записи) — правила переносятся вместе с узлами с заменой id записи.
// Работает на снимке data/pages/blog.html в памяти (сборка), сам снимок остаётся копией оригинала.
import * as csstree from 'css-tree';

const SCREENS = [320, 480, 640, 960]; // + базовый (≥1200)
const FIELDS = ['left', 'top'];
const attrName = (f, bp) => (bp === 'base' ? `data-field-${f}-value` : `data-field-${f}-res-${bp}-value`);
const chain = (bp) => (bp === 'base' ? ['base'] : [...SCREENS.filter((s) => s >= bp), 'base']); // текущий → более широкие → базовый
const BPS = [...SCREENS, 'base'];

/** значение поля с каскадом брейкпоинтов, как в Tilda */
function eff(el, f, bp, name = attrName) {
  for (const b of chain(bp)) { const v = el.attr(name(f, b)); if (v !== undefined && v !== '') return parseFloat(v); }
  return NaN;
}
const abName = (f, bp) => (bp === 'base' ? `data-artboard-${f}` : `data-artboard-${f}-res-${bp}`);

export function pinFirst($, { slug, title, tabs: tabNames }) {
  const log = [];
  const tabs = {};
  $('li.t395__tab').each((i, li) => { tabs[$(li).text().trim().replace(/\s+/g, ' ')] = new Set(($(li).attr('data-tab-rec-ids') || '').split(',').filter(Boolean)); });
  for (const name of tabNames) {
    const ids = tabs[name];
    if (!ids) { log.push(`вкладка «${name}» не найдена`); continue; }
    log.push(`${name}: ${pinInTab($, ids, slug, title)}`);
  }
  return log;
}

function pinInTab($, ids, slug, title) {
  const recs = $('#allrecords > .r').toArray().map((n) => $(n)).filter((r) => ids.has(r.attr('id').replace('rec', '')));
  // ряды сетки: записи с тремя карточками; шапка вкладки (со «Подписаться») и ряд «Популярные статьи» (идёт сразу за заголовком) — не в счёт
  const rows = [];
  recs.forEach((r, i) => {
    const prev = recs[i - 1];
    if (r.attr('data-record-type') !== '396') return;
    if (r.find('.t396__elem[data-elem-type="button"]').length) return;
    if (prev && /\(Топ\)/.test(prev.text())) return;
    const shapes = r.find('.t396__elem[data-elem-type="shape"]').filter((j, e) => $(e).find('.tn-atom[data-original], .tn-atom[style*="url("]').length);
    if (shapes.length !== 3) return;
    rows.push(parseRow($, r, shapes));
  });
  const cards = rows.flatMap((row) => row.cards.map((c, slot) => ({ ...c, row, slot })));
  const p = cards.findIndex((c) => c.href.includes(`/blog/${slug}`));
  if (p < 0) return 'карточка не найдена';
  if (p === 0) return 'уже первая';

  // новая раскладка: закреплённая — на место 0, карточки 0..p-1 — на следующие места
  const order = [cards[p], ...cards.slice(0, p)];
  const plan = order.map((c, i) => ({ card: c, to: cards[i] }));
  // исходные координаты слотов и высоты записываем заранее (элементы дальше переезжают)
  const geo = (row) => Object.fromEntries(BPS.map((bp) => [bp, row.cards.map((c) => ({ left: eff(c.shape, 'left', bp), top: eff(c.shape, 'top', bp) }))]));
  const origin = new Map(rows.map((row) => [row, geo(row)]));
  const heightOf = (row, bp) => eff(row.ab, 'height', bp, abName);
  const rowH = new Map(rows.map((row) => [row, Object.fromEntries(BPS.map((bp) => [bp, heightOf(row, bp)]))]));
  // «запас» карточки: высота ряда за вычетом верхней точки самого нижнего слота (на брейкпоинтах с колонкой — тот же, что у карточки сверху)
  const allot = (row, bp) => rowH.get(row)[bp] - Math.max(...origin.get(row)[bp].map((o) => o.top));
  const need = new Map();
  for (const { card, to } of plan) {
    const from = origin.get(card.row); const dst = origin.get(to.row);
    for (const bp of BPS) {
      const a = from[bp][card.slot]; const b = dst[bp][to.slot];
      const dx = b.left - a.left; const dy = b.top - a.top;
      for (const el of card.els) {
        for (const [f, d] of [['left', dx], ['top', dy]]) {
          const v = eff(el, f, bp);
          if (Number.isNaN(v)) throw new Error(`blog-pin: нет ${f} у ${el.attr('data-elem-id')} на ${bp}`);
          el.attr(attrName(f, bp), String(Math.round((v + d) * 100) / 100));
        }
      }
      const n = need.get(to.row) || {}; n[bp] = Math.max(n[bp] || 0, b.top + allot(card.row, bp)); need.set(to.row, n);
    }
  }
  // карточки затронутых рядов, которые остались на месте (после закреплённой), тоже определяют высоту ряда
  cards.slice(p + 1).filter((c) => need.has(c.row)).forEach((c) => { const n = need.get(c.row); for (const bp of BPS) n[bp] = Math.max(n[bp], origin.get(c.row)[bp][c.slot].top + allot(c.row, bp)); });
  // перенос в два прохода: сначала забираем узлы и правила из исходных записей, потом кладём в целевые (id элементов у копий карточек повторяются)
  const moves = plan.filter(({ card, to }) => card.row !== to.row).map(({ card, to }) => ({ to, els: card.els, css: takeCss($, card.row.rec, card.els.map((e) => e.attr('data-elem-id'))), from: card.row.rec }));
  for (const m of moves) m.els.forEach((el) => el.remove());
  for (const m of moves) {
    const rec = m.to.row.rec;
    rec.find('.t396__artboard').first().append(m.els);
    const css = m.css.replaceAll('#rec' + m.from.attr('id').replace('rec', ''), '#rec' + rec.attr('id').replace('rec', ''));
    if (css) rec.append(`<style>${css}</style>`);
  }
  for (const row of new Set(plan.map((x) => x.to.row))) {
    const seen = new Set();
    row.rec.find('.t396__artboard').first().children('.t396__elem').each((i, e) => { const id = $(e).attr('data-elem-id'); if (seen.has(id)) throw new Error(`blog-pin: повтор id элемента ${id} в ${row.rec.attr('id')}`); seen.add(id); });
  }
  // высота рядов: по самой высокой из новых карточек
  for (const row of rows) { const n = need.get(row); if (!n) continue; for (const bp of BPS) row.ab.attr(abName('height', bp), String(Math.round(n[bp]))); }

  // заголовок закреплённой карточки
  const link = cards[p].els.map((e) => e.find('a')).find((a) => a.length && /\/blog\//.test(a.attr('href') || ''));
  if (link && title) link.text(title);
  return `карточка с позиции ${p + 1} → 1 (рядов затронуто: ${new Set(plan.map((x) => x.to.row)).size})`;
}

/** ряд: три карточки (элементы группируются по ближайшей картинке слева направо), слот = порядок по левой границе картинки */
function parseRow($, rec, shapes) {
  const ab = rec.find('.t396__artboard').first();
  const els = ab.children('.t396__elem').toArray().map((n) => $(n));
  const shapeEls = shapes.toArray().map((n) => $(n)).sort((a, b) => eff(a, 'left', 'base') - eff(b, 'left', 'base'));
  const lefts = shapeEls.map((s) => eff(s, 'left', 'base'));
  const widths = shapeEls.map((s) => eff(s, 'width', 'base', (f) => `data-field-${f}-value`));
  const cards = shapeEls.map((shape) => ({ shape, els: [] }));
  for (const el of els) {
    const l = eff(el, 'left', 'base'); const w = parseFloat(el.attr('data-field-width-value') || '0');
    const mid = l + w / 2;
    let k = lefts.findIndex((x, i) => mid >= x - 20 && mid < x + widths[i] + 20);
    if (k < 0) k = lefts.reduce((best, x, i) => (Math.abs(mid - x) < Math.abs(mid - lefts[best]) ? i : best), 0);
    cards[k].els.push(el);
  }
  for (const c of cards) c.href = c.els.map((e) => e.find('a').attr('href') || '').find((h) => /\/blog\/[a-z0-9-]+/.test(h)) || '';
  return { rec, ab, cards };
}

/** правила <style> записи, относящиеся к элементам ids (селекторы вида #rec<id> .tn-elem[data-elem-id="…"]…); из записи они удаляются, текст возвращается */
function takeCss($, rec, ids) {
  const ours = (sel) => ids.some((id) => sel.includes(`data-elem-id="${id}"`));
  const split = (rule) => { // правило → [наше, остальное]
    const sels = rule.prelude.children.toArray().map((n) => csstree.generate(n));
    const block = csstree.generate(rule.block);
    const mk = (list) => (list.length ? `${list.join(',')}${block}` : '');
    return [mk(sels.filter(ours)), mk(sels.filter((x) => !ours(x)))];
  };
  const moved = [];
  rec.find('style').each((i, st) => {
    const ast = csstree.parse($(st).text());
    const keep = [];
    for (const node of ast.children.toArray()) {
      if (node.type === 'Rule') { const [m, k] = split(node); if (m) moved.push(m); if (k) keep.push(k); }
      else if (node.type === 'Atrule' && node.block && node.name === 'media') {
        const m = []; const k = [];
        for (const r of node.block.children.toArray()) { if (r.type !== 'Rule') { k.push(csstree.generate(r)); continue; } const [a, b] = split(r); if (a) m.push(a); if (b) k.push(b); }
        const pre = `@media ${csstree.generate(node.prelude)}`;
        if (m.length) moved.push(`${pre}{${m.join('')}}`);
        if (k.length) keep.push(`${pre}{${k.join('')}}`);
      } else keep.push(csstree.generate(node));
    }
    $(st).text(keep.join(''));
  });
  return moved.join('');
}
