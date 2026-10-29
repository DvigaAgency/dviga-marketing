// Общие помощники сборки.
export const ORIGIN = 'https://dviga.marketing';

// Страницы, которые есть в копии: ссылки на них остаются локальными, остальные внутренние ссылки оригинала — абсолютные адреса оригинала.
let LOCAL = new Set(['/']);
export const setLocalPaths = (paths) => { LOCAL = new Set(['/', ...paths.map((p) => p.replace(/\/$/, '') || '/')]); };
export const isLocalPath = (p) => LOCAL.has(String(p).replace(/\/$/, '') || '/');

// Статьи, чьи адреса на оригинале изменились (старые ссылки в листинге и текстах ведут на редирект)
const ALIAS = { '/blog/skolko-stoit-sdelat-sajt-na-tilde-v-2025-ceny': '/blog/skolko-stoit-sdelat-sajt-na-tilde-v-2026-ceny' };

/** href внутренней ссылки оригинала -> локальный путь (с завершающим «/») или абсолютный адрес оригинала.
 *  Абсолютные ссылки на статьи блога (https://dviga.marketing/blog/…) ведут на копию, если статья в ней есть. */
export function link(h) {
  const orig = h;
  if (h && h.startsWith(ORIGIN + '/blog/')) h = h.slice(ORIGIN.length);
  if (!h || !/^\/(?!\/)/.test(h)) return orig;
  const m = /^([^?#]*)(.*)$/.exec(h);
  const raw = m[1].replace(/\/$/, '') || '/';
  const p = ALIAS[raw] || raw;
  if (LOCAL.has(p)) return (p === '/' ? '/' : p + '/') + m[2];
  return ORIGIN + h;
}

export const fixLinks = (html) => String(html ?? '').replace(/href="((?:https:\/\/dviga\.marketing(?=\/blog\/))?\/[^"/][^"]*|\/)"/g, (m, h) => `href="${link(h)}"`);
