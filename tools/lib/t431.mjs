// Таблица T431 в статье блога. Данные лежат в скрытых блоках data-part1 (шапка) и data-part2 (строки), ячейки через «;».
// Вид — как у таблиц статей по ТЗ (src/css/article-table.css: колонка 760px, шапка #f2f2f2, сетка 1px #d9d9d9, 14px, отступы 20px,
// всё масштабируется вместе с макетом), а цвета берём из настроек самой таблицы и кастомного CSS страницы (например, зелёная/красная шапка).
import { recPadding } from './zero.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const decl = (body, prop) => { let v = null; for (const m of body.matchAll(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'g'))) v = m[1].replace(/!important/i, '').trim(); return v; };

/** разбор правил .t431__th / .t431__td / .t431__oddrow / .t431__evenrow из <style> страницы: настройки блока + кастомный CSS */
function readStyle($, id) {
  const text = $('style').map((i, e) => $(e).text()).get().join('\n');
  const st = { th: {}, td: {}, thN: {}, odd: null, even: null };
  for (const m of text.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    for (let sel of m[1].split(',')) {
      sel = sel.trim().replace(/\s+/g, ' ');
      if (!sel.includes('t431__')) continue;
      const other = /#rec(\d+)/.exec(sel);
      if (other && other[1] !== id) continue;
      sel = sel.replace(/^#rec\d+ /, '').replace(/^\.t431 /, '');
      const bg = decl(m[2], 'background(?:-color)?'); const color = decl(m[2], 'color'); const bc = decl(m[2], 'border-color'); const bl = decl(m[2], 'border-left-width');
      let x;
      if ((x = /^\.t431__th(?::(first-child|last-child)|:nth-child\((\d+)\))?$/.exec(sel))) {
        const key = x[1] || (x[2] ? `n${x[2]}` : null);
        if (key) { st.thN[key] = { ...(st.thN[key] || {}), ...(bg && { bg }), ...(color && { color }) }; } else Object.assign(st.th, { ...(bg && { bg }), ...(color && { color }), ...(bc && { bc }), ...(bl !== null && { bl }) });
      } else if (/^\.t431__td$/.test(sel)) Object.assign(st.td, { ...(color && { color }), ...(bc && { bc }), ...(bl !== null && { bl }) });
      else if (/^\.t431__oddrow$/.test(sel) && bg) st.odd = bg;
      else if (/^\.t431__evenrow$/.test(sel) && bg) st.even = bg;
    }
  }
  return st;
}

export function t431Table($, rec) {
  const id = rec.attr('id').replace('rec', '');
  const widths = (rec.find('.t431__table').attr('data-table-width') || '').split(';').filter(Boolean);
  const head = (rec.find('.t431__data-part1').text() || '').trim().split(';');
  const rows = (rec.find('.t431__data-part2').text() || '').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => x.split(';'));
  const st = readStyle($, id);
  const cell = (c) => c.trim(); // в ячейках Tilda допускает разметку (<b>, ссылки) — оставляем как есть
  const col = widths.map((w, i) => (i === widths.length - 1 ? '<col>' : `<col style="width:${esc(w)}">`)).join('');
  const th = head.map((c) => `<th scope="col">${cell(c)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('');
  const css = [recPadding(rec.attr('class') || '', id)];
  const s = `#r${id} .ar-tt`;
  const thRule = [st.th.bg && `background:${st.th.bg}`, st.th.color && `color:${st.th.color}`, st.th.bc && `border-color:${st.th.bc}`].filter(Boolean).join(';');
  if (thRule) css.push(`${s} thead th{${thRule}}`);
  for (const [k, v] of Object.entries(st.thN)) { const sel = k.startsWith('n') ? `:nth-child(${k.slice(1)})` : `:${k}`; const r = [v.bg && `background:${v.bg}`, v.color && `color:${v.color}`].filter(Boolean).join(';'); if (r) css.push(`${s} thead th${sel}{${r}}`); }
  if (st.td.color) css.push(`${s} td{color:${st.td.color}}`);
  if (st.td.bc) css.push(`${s} td{border-color:${st.td.bc}}`);
  if (st.odd && !/^#?f{3,6}$|^white$/i.test(st.odd.replace('#', ''))) css.push(`${s} tbody tr:nth-child(odd){background:${st.odd}}`);
  if (st.even && !/^#?f{3,6}$|^white$/i.test(st.even.replace('#', ''))) css.push(`${s} tbody tr:nth-child(even){background:${st.even}}`);
  const noV = st.td.bl !== undefined && parseFloat(st.td.bl) === 0; // у таблицы без вертикальных линий — только горизонтальные
  const cls = `ar-tt${head.length >= 3 ? ' ar-tt-wide' : ''}${noV ? ' ar-tt-nv' : ''}`;
  return { id, css: css.filter(Boolean).join('\n'), html: `<section id="r${id}" class="r ar ar-tb"><div class="ar-c ar-tbl"><div class="ar-tsc"><table class="${cls}"><colgroup>${col}</colgroup><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div></div></section>` };
}
