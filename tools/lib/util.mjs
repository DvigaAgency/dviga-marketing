// Общие помощники сборки.
export const ORIGIN = 'https://dviga.marketing';

/** внутренние ссылки оригинала (href="/path") -> абсолютные адреса оригинала (остальные страницы в копию не входят) */
export const fixLinks = (html) => String(html ?? '').replace(/href="(\/[^"/][^"]*)"/g, (m, h) => `href="${ORIGIN}${h}"`);
