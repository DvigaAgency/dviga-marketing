// Общие помощники сборки.
import { P } from './lang.mjs';
export const ORIGIN = P.origin;

// Страницы, которые есть в копии: ссылки на них остаются локальными, остальные внутренние ссылки оригинала — абсолютные адреса оригинала.
let LOCAL = new Set(['/']);
export const setLocalPaths = (paths) => { LOCAL = new Set(['/', ...paths.map((p) => p.replace(/\/$/, '') || '/')]); };
export const isLocalPath = (p) => LOCAL.has(String(p).replace(/\/$/, '') || '/');

// Статьи, чьи адреса на оригинале изменились (старые ссылки в листинге и текстах ведут на редирект)
const ALIAS = { '/blog/skolko-stoit-sdelat-sajt-na-tilde-v-2025-ceny': '/blog/skolko-stoit-sdelat-sajt-na-tilde-v-2026-ceny' };

/** href внутренней ссылки оригинала -> локальный путь (с завершающим «/») или абсолютный адрес оригинала.
 *  Абсолютные ссылки на статьи блога (https://dviga.marketing/blog/…) ведут на копию, если статья в ней есть. */
// вкладки каталога кейсов на оригинале (/cases#!/tab/698207106-<номер>) — в копии это фильтры каталога (src/js/cases.js): номер вкладки -> параметр адреса
const CASE_TABS = { 1: '', 2: '?service=sites', 3: '?service=branding', 4: '?industry=realty', 5: '?service=promo', 6: '?service=auto', 7: '?industry=logistics', 8: '?industry=industry' };
export function link(h) {
  if (h && h.replace(/\/$/, '') === P.switchFrom.replace(/\/$/, '')) return P.switchTo; // переключатель языка: ведёт на главную другой версии (RU_URL / EN_URL)
  const orig = h;
  const ct = /^(?:https:\/\/dviga\.marketing)?\/cases\/?#!\/tab\/\d+-(\d+)$/.exec(h || '');
  if (ct && ct[1] in CASE_TABS) return '/cases/' + CASE_TABS[ct[1]];
  if (h && h.startsWith(ORIGIN + '/blog/')) h = h.slice(ORIGIN.length);
  if (!h || !/^\/(?!\/)/.test(h)) return orig;
  const m = /^([^?#]*)(.*)$/.exec(h);
  const raw = m[1].replace(/\/$/, '') || '/';
  const p = ALIAS[raw] || raw;
  if (LOCAL.has(p)) return (p === '/' ? '/' : p + '/') + m[2];
  return ORIGIN + h;
}

// переключатель языка («en» / «ru» в шапке и меню) — ссылка внутри текста Zero-элемента, а не href атома: тоже ведёт на главную другой версии копии (RU_URL / EN_URL)
const SWITCH_RE = new RegExp(`href="${P.switchFrom.replace(/\/$/, '').replace(/[.]/g, '\\.')}/?"`, 'g');
export const fixLinks = (html) => String(html ?? '').replace(SWITCH_RE, `href="${P.switchTo}"`).replace(new RegExp(`href="((?:${ORIGIN.replace(/[.]/g, '\\.')}(?=/blog/))?/[^"/][^"]*|/)"`, 'g'), (m, h) => `href="${link(h)}"`);
