// Общие помощники сборки.
export const ORIGIN = 'https://dviga.marketing';

// Страницы, которые есть в копии: ссылки на них остаются локальными, остальные внутренние ссылки оригинала — абсолютные адреса оригинала.
let LOCAL = new Set(['/']);
export const setLocalPaths = (paths) => { LOCAL = new Set(['/', ...paths.map((p) => p.replace(/\/$/, '') || '/')]); };
export const isLocalPath = (p) => LOCAL.has(String(p).replace(/\/$/, '') || '/');

/** href внутренней ссылки оригинала -> локальный путь (с завершающим «/») или абсолютный адрес оригинала */
export function link(h) {
  if (!h || !/^\/(?!\/)/.test(h)) return h;
  const m = /^([^?#]*)(.*)$/.exec(h);
  const p = m[1].replace(/\/$/, '') || '/';
  if (LOCAL.has(p)) return (p === '/' ? '/' : p + '/') + m[2];
  return ORIGIN + h;
}

export const fixLinks = (html) => String(html ?? '').replace(/href="(\/[^"/][^"]*|\/)"/g, (m, h) => `href="${link(h)}"`);
