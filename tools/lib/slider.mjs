// Карусели в клонах статей: на оригинале плагин Annexx (owl carousel) складывает Zero-записи-слайды в «шейп»-контейнер записи-хоста;
// настройки — data/articles/sliders.json (tools/faq-config.mjs). Здесь слайды переносятся внутрь контейнера: .zc > .zc-t > .zc-i*,
// стрелки получают классы zc-nx / zc-pv, листает src/js/main.js (initSlider).
import fs from 'node:fs';

const FILE = 'data/articles/sliders.json';
let cfg;
export function slidersFor(path) {
  if (!cfg) cfg = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const m = /^\/blog\/([^/]+)/.exec(path);
  return (m && cfg[m[1]]) || [];
}

/** items вида «0:1,960:3» -> CSS: количество видимых слайдов по ширине окна */
function itemsCss(host, items) {
  const steps = String(items).split(',').map((x) => x.split(':').map(Number)).filter((x) => x.length === 2 && !x.some(Number.isNaN)).sort((a, b) => a[0] - b[0]);
  if (!steps.length) return `#r${host} .zc{--n:${parseInt(items, 10) || 1}}`;
  return steps.map(([w, n]) => (w ? `@media(min-width:${w}px){#r${host} .zc{--n:${n}}}` : `#r${host} .zc{--n:${n}}`)).join('');
}

/** arr — HTML секций страницы (каждый элемент начинается с <section id="r…">); возвращает { html, css } */
export function applySliders(arr, list) {
  const css = [];
  for (const s of list) {
    const iHost = arr.findIndex((h) => h.startsWith(`<section id="r${s.host}"`));
    if (iHost < 0) continue;
    const slides = [];
    for (const rid of s.slides) {
      const k = arr.findIndex((h) => h.startsWith(`<section id="r${rid}"`));
      if (k < 0) continue;
      const m = /<div class="zw">([^]*)<\/div><\/div><\/section>$/.exec(arr[k]);
      if (!m) continue;
      slides.push(`<div id="r${rid}" class="zc-i">${m[1]}</div>`);
      arr[k] = '';
    }
    if (!slides.length) continue;
    const shapeRe = new RegExp(`<div class="e e${s.shape}" data-t="shape">(<div class="a"[^>]*></div>)</div>`);
    let h = arr[iHost].replace(shapeRe, (m, a) => `<div class="e e${s.shape} zc-h" data-t="shape">${a}<div class="zc" data-loop="${s.loop ? 1 : 0}" data-speed="${s.speed || 600}"><div class="zc-t">${slides.join('')}</div></div></div>`);
    for (const id of s.next || []) h = h.replace(`<div class="e e${id}"`, `<div class="e e${id} zc-nx"`);
    for (const id of s.prev || []) h = h.replace(`<div class="e e${id}"`, `<div class="e e${id} zc-pv"`);
    arr[iHost] = h;
    css.push(itemsCss(s.host, s.items));
  }
  return { html: arr.filter(Boolean), css: css.join('\n') };
}
