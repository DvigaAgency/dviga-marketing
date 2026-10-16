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
  const w = m.w || o.w; const h = m.h || o.h;
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
export function cssImage(url, maxW, maxH) {
  const m = lookup(url);
  if (!m) { console.warn('NO CSS ASSET', url); return `url(${url})`; }
  if (m.kind === 'svg') { used.add(m.src); return `url(${m.src})`; }
  // maxW — ширина слоя в дизайн-px × 1.6 (самый широкий экран). Для плотностей 1x/2x/3x выбираем варианты под
  // 1.6 / 2.6 / 3.8 ширины слоя; браузер берёт подходящий его плотности экрана, так что на ретине фон не мылится.
  // при background-size:cover нужная ширина определяется и высотой слоя: ширина картинки = высота слоя × её пропорции
  let base = maxW ? maxW / 1.6 : 0;
  if (base && maxH && m.w && m.h) base = Math.max(base, (maxH / 1.6) * (m.w / m.h));
  const entries = (arr, fmt) => {
    const seen = new Set(); const out = [];
    for (const [d, f] of [[1, 1.6], [2, 2.6], [3, 3.8]]) {
      const v = (base ? arr.find((x) => x.w >= base * f) : null) || arr.at(-1);
      if (seen.has(v.src)) continue;
      seen.add(v.src); used.add(v.src);
      out.push(`url(${v.src}) ${d}x type("image/${fmt}")`);
    }
    return out;
  };
  return `image-set(${[...entries(m.avif, 'avif'), ...entries(m.webp, 'webp')].join(',')})`;
}
