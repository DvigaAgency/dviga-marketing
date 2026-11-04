// Flex-Zero (запись T1741, «Zero-блок с автолэйаутом» Tilda): раскладка целиком задана CSS-правилами самой записи (flex-группы, gap, брейкпоинты),
// поэтому запись выводится как есть: её <style> + разметка, картинка — через <picture> с локальными вариантами. Масштаб — как у Zero-записей:
// на каждом брейкпоинте (1200 / 960 / 640 / 480 / 360, как в data-artboard-screens) блок рисуется в размерах макета и увеличивается zoom'ом до ширины окна.
import * as cheerio from 'cheerio';

// базовые правила Zero из tilda-blocks-page*.min.css (только то, что нужно записи с автолэйаутом), под префиксом .flz
const BASE = [
  '.t396{-webkit-text-size-adjust:100%}',
  '.t396__artboard{position:relative;width:100%;overflow:hidden}',
  '.t396__carrier{position:absolute;left:0;top:0;z-index:0;width:100%}',
  '.t396__filter{position:absolute;left:0;top:0;z-index:1;width:100%}',
  '.t396__elem{position:absolute;box-sizing:border-box;display:table}',
  '.t396 .tn-atom{display:table-cell;vertical-align:middle;width:100%}',
  '.t396 .tn-atom__img{width:100%;display:block}',
  '.t396 .tn-atom__button-content{display:flex;flex-direction:row;align-items:center;justify-content:center;flex:0 1 auto;min-width:0}',
  '.t396 .tn-atom__button-text{flex:1 1 0;text-overflow:ellipsis}',
  '.t396__elem[data-elem-type="button"] .tn-atom{display:flex;align-items:center;justify-content:center;height:100%}', // у Tilda кнопка — flex-контейнер (иначе table-cell ужимается по тексту)
  '.t396__elem-flex{position:relative!important;left:initial!important;top:initial!important;height:fit-content;flex-shrink:0}',
  '.t396__artboard-flex>.t396__elem:not(.tn-elem__absolute),.t396__artboard-flex>.t396__group:not(.tn-group__absolute){position:relative!important;left:initial!important;top:initial!important;height:fit-content;flex-shrink:0}',
].map((r) => '.flz ' + r).join('');

// имена классов Tilda в итоговой странице не допускаются (audit-dist): переименовываем и в разметке, и в CSS
const ren = (t) => t.replace(/t396__/g, 'zfx__').replace(/t396/g, 'zfx').replace(/tn-atom/g, 'zfx-atom').replace(/tn-elem/g, 'zfx-elem').replace(/tn-group/g, 'zfx-group').replace(/tn-molecule/g, 'zfx-molecule').replace(/t-rec/g, 'zfx-rec');

const BASES = [[1199, 960], [959, 640], [639, 480], [479, 360]];

export function flexZeroBlock($, rec, { picture, localUrls }) {
  const id = rec.attr('id').replace('rec', '');
  const clone = $(rec.toString());
  clone.find('script').remove();
  clone.find('img.tn-atom__img').each((i, img) => {
    const im = $(img);
    const src = im.attr('data-original') || im.attr('src');
    im.replaceWith(picture(src, { cls: 'tn-atom__img t-img', alt: im.attr('alt') || '', sizes: '(min-width:1200px) 40vw,100vw' }));
  });
  const css = clone.find('style').map((i, e) => $(e).html()).get().join('\n');
  clone.find('style').remove();
  const z = `#r${id}{--t-text-font:Inter,Arial,sans-serif;--t-headline-font:Inter,Arial,sans-serif;--s:tan(atan2(100cqw,1200px));zoom:var(--s)}`
    + BASES.map(([mw, b]) => `@media(max-width:${mw}px){#r${id}{--s:tan(atan2(100cqw,${b}px))}}`).join('')
    + `#r${id} picture{display:block;width:100%;height:100%}`;
  return { id, css: ren(BASE + z + '\n' + localUrls(css)), html: `<section id="r${id}" class="r flz">${ren($.html(clone))}</section>` };
}
