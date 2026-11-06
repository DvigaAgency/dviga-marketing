// Свои стрелки галерей: на части страниц оригинала HTML-блок (T123) переопределяет стрелки слайдеров — прячет стандартные SVG и ставит на
// .t-slds__arrow-left / .t-slds__arrow-right картинки (золотые круглые стрелки 48px). Стили действуют на все галереи страницы — и T670, и Zero-галереи.
// Возвращает { left, right } (адреса картинок оригинала) или null.
export function arrowImages($) {
  let left = null; let right = null;
  $('style').each((i, e) => {
    const css = $(e).html() || '';
    const l = /\.t-slds__arrow-left\s*\{[^}]*background-image:\s*url\(["']?([^"')]+)/.exec(css);
    const r = /\.t-slds__arrow-right\s*\{[^}]*background-image:\s*url\(["']?([^"')]+)/.exec(css);
    if (l) left = l[1];
    if (r) right = r[1];
  });
  return left && right ? { left, right } : null;
}
