// Чек-лист T678 в статье блога: форма Tilda только из чекбоксов (кнопку отправки прячет кастомный CSS страницы `.t678 .t-form__submit{display:none}`).
// Вид как у оригинала: квадрат 20px с красной рамкой, текст 15px/1.2, отступ между пунктами 20px; колонка и масштаб — как у остальных блоков статьи (.ar-c).
import { recPadding } from './zero.mjs';

export function checklistBlock($, rec) {
  const id = rec.attr('id').replace('rec', '');
  const color = (rec.find('.t-checkbox__indicator').first().attr('style') || '').match(/border-color:\s*([^;]+)/)?.[1]?.trim() || '#d93433';
  const items = rec.find('label.t-checkbox__control').map((i, l) => `<label class="ar-cli"><input type="checkbox"><i></i><span>${$(l).find('span').last().html()}</span></label>`).get().join('');
  const css = [recPadding(rec.attr('class') || '', id), color !== '#d93433' ? `#r${id} .ar-cli i{border-color:${color}}#r${id} .ar-cli i::after{border-color:${color}}` : ''].filter(Boolean).join('\n');
  return { id, css, html: `<section id="r${id}" class="r ar ar-cl"><div class="ar-c">${items}</div></section>` };
}
