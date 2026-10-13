// Подстановка локальных ассетов: <picture> с AVIF/WebP и srcset, CSS image-set().
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync('data/img-manifest.json', 'utf8'));
const used = new Set();
export const usedAssets = used;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const norm = (u) => u.replace(/&amp;/g, '&').replace(/^\/\//, 'https://')
  .replace(/^https:\/\/thb\.tildacdn\.com\/([^/]+)\/-\/resizeb?\/[0-9]+x\/(.+)$/, 'https://static.tildacdn.com/$1/$2');
export const lookup = (url) => manifest[norm(url)] || manifest[norm(url).replace(/^http:/, 'https:')];

export function picture(url, o = {}) {
  const m = lookup(url);
  if (!m) { console.warn('NO ASSET', url); return `<img class="${o.cls || ''}" src="${esc(url)}" alt="${esc(o.alt || '')}">`; }
  used.add(m.src);
  const w = o.w || m.w; const h = o.h || m.h;
  const dim = w && h ? ` width="${Math.round(w)}" height="${Math.round(h)}"` : '';
  const loading = o.eager ? (o.priority ? ' fetchpriority="high"' : '') : ' loading="lazy" decoding="async"';
  const cls = o.cls ? ` class="${o.cls}"` : '';
  const alt = ` alt="${esc(o.alt || '')}"`;
  if (m.kind === 'svg') return `<img${cls} src="${m.src}"${alt}${dim}${loading}>`;
  m.avif.forEach((v) => used.add(v.src)); m.webp.forEach((v) => used.add(v.src));
  const sizes = o.sizes ? ` sizes="${o.sizes}"` : '';
  const ss = (arr) => arr.map((v) => `${v.src} ${v.w}w`).join(',');
  if (m.avif.length === 1 && m.webp.length === 1) {
    return `<picture><source type="image/avif" srcset="${m.avif[0].src}"><img${cls} src="${m.webp[0].src}"${alt}${dim}${loading}></picture>`;
  }
  return `<picture><source type="image/avif" srcset="${ss(m.avif)}"${sizes}><img${cls} src="${m.webp.at(-1).src}" srcset="${ss(m.webp)}"${sizes}${alt}${dim}${loading}></picture>`;
}

/** значение для CSS background-image: url() или image-set() */
export function cssImage(url, maxW) {
  const m = lookup(url);
  if (!m) { console.warn('NO CSS ASSET', url); return `url(${url})`; }
  if (m.kind === 'svg') { used.add(m.src); return `url(${m.src})`; }
  const pick = (arr) => arr.find((v) => v.w >= (maxW || 1e9)) || arr.at(-1);
  const a = pick(m.avif); const w = pick(m.webp);
  used.add(w.src); used.add(a.src);
  return `image-set(url(${a.src}) type("image/avif"),url(${w.src}) type("image/webp"))`;
}
