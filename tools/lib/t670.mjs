// Слайдер картинок T670 в статье (например «Модификации, скрипты и эффекты для Тильды»): картинки 860×550 по центру, круглые стрелки 40px снаружи, точки под слайдером.
// Выводится на разметке галереи Zero (.gl: прокрутка со scroll-snap, точки, стрелки — src/js/gallery.js); размеры по брейкпоинтам — .sl6 в src/css/components.css (замерено на оригинале, масштаба нет).
import { recPadding } from './zero.mjs';

const chev = '<svg viewBox="0 0 94 94" aria-hidden="true"><path d="M39 68L60 47L39 26" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';

export function slider670($, rec, { picture }) {
  const id = rec.attr('id').replace('rec', '');
  const urls = [];
  rec.find('.t-slds__item .t-slds__bgimg[data-original]').each((i, e) => { const u = $(e).attr('data-original'); if (!urls.includes(u)) urls.push(u); });
  const slides = urls.map((u) => `<div class="gl-s">${picture(u, { alt: '', sizes: '(min-width:1200px) 860px,100vw' })}</div>`).join('');
  const dots = urls.map((u, i) => `<i${i ? '' : ' class="on"'}></i>`).join('');
  const arrows = `<button class="gl-ar gl-pv" type="button" aria-label="Предыдущий слайд">${chev}</button><button class="gl-ar gl-nx" type="button" aria-label="Следующий слайд">${chev}</button>`;
  const bullet = /t-slds__bullet_active \.t-slds__bullet_body\{background-color:(#[0-9a-f]{3,6})/i.exec(rec.find('style').text())?.[1] || '#222';
  const html = `<section id="r${id}" class="r sl6"><div class="gl" data-gl>${`<div class="gl-t">${slides}</div>`}${arrows}<div class="gl-d gl-dn" style="--d:#c7c7c7;--da:${bullet}">${dots}</div></div></section>`;
  return { id, css: recPadding(rec.attr('class') || '', id), html };
}
