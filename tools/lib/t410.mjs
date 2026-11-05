// «До / после» T410 в статье: два изображения друг над другом, левое обрезается по положению ползунка (перетаскивание мышью/пальцем, стрелки клавиатуры).
// Размеры как у оригинала: ширина = колонка контейнера минус по 20px (в макете 1160px), масштаб — как у Zero (zoom по брейкпоинтам). Логика — initBeforeAfter в src/js/main.js.
import { recPadding } from './zero.mjs';
import { zoomCss } from './blocks.mjs';

export function beforeAfterBlock($, rec, { picture }) {
  const id = rec.attr('id').replace('rec', '');
  const w = rec.find('.t410__wrapper');
  const first = w.attr('data-beforeafter-imgurl-first'); const second = w.attr('data-beforeafter-imgurl-second');
  const d1 = w.attr('data-beforeafter-imgdescr-first') || ''; const d2 = w.attr('data-beforeafter-imgdescr-second') || '';
  const col = rec.find('.t410__col').attr('class') || '';
  const color = /t-beforeafter__controller\{background-color:(#[0-9a-f]{3,8})/i.exec(rec.find('style').text())?.[1] || '#ffffff';
  const img = (u, cls) => picture(u, { cls, alt: '', sizes: '(min-width:1200px) 97vw,100vw' });
  const html = `<section id="r${id}" class="r ba" data-ba><div class="ba-w"><div class="ba-i ba-r">${img(second, 'ba-img')}<span class="ba-l">${d2}</span></div><div class="ba-i ba-f">${img(first, 'ba-img')}<span class="ba-l">${d1}</span></div><div class="ba-h" tabindex="0" role="slider" aria-label="Сравнение: до и после" aria-valuemin="0" aria-valuemax="100" aria-valuenow="42"><i class="ba-a ba-al"></i><b class="ba-c"></b><i class="ba-a ba-ar"></i></div></div></section>`;
  const css = [recPadding(rec.attr('class') || '', id), zoomCss(id), `#r${id}{--bac:${color}}`, /t-col_12/.test(col) ? '' : ''].filter(Boolean).join('\n');
  return { id, css, html };
}
