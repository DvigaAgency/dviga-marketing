// Подсветка ссылок в Zero-текстах клонов статей (оглавление и др.): на оригинале её включает плагин Annexx «effect-link»
// (скрипт на странице, в снимок не попадает) — при наведении цвет текста ссылки меняется на красный.
// Настройки: data/articles/link-hover.json (tools/faq-config.mjs): селекторы вида «.tn-elem__<recId><elemId> .tn-atom a» и цвет.
import fs from 'node:fs';

const FILE = 'data/articles/link-hover.json';
let cfg;

/** CSS для страницы /blog/<slug>; recIds — id записей страницы (чтобы отделить recId от elemId в слитном номере) */
export function linkHoverCss(path, recIds) {
  if (!cfg) cfg = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const m0 = /^\/(blog|cases)\/([^/]+)/.exec(path); const m = m0 && [0, m0[1] === 'cases' ? `cases/${m0[2]}` : m0[2]]; // статьи — по слагу, кейсы — «cases/<слаг>»
  const out = [];
  for (const g of (m && cfg[m[1]]) || []) {
    const sels = [];
    for (const s of g.sel) {
      const d = /\.tn-elem__(\d+)/.exec(s)?.[1];
      if (!d) continue;
      const rec = [...recIds].filter((r) => d.startsWith(r) && d.length - r.length >= 13).sort((a, b) => b.length - a.length)[0];
      if (rec) sels.push(`#r${rec} .e${d.slice(rec.length)} a`);
    }
    if (sels.length) out.push(`${sels.map((x) => x + ':hover').join(',')}{color:${g.color}!important}${sels.join(',')}{transition:color .2s}`);
  }
  return out.join('\n');
}
