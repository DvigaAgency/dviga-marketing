// Блоки листингов (кейсы, блог): вкладки T395, «Загрузить еще» T400, кнопки «поделиться» T014 — собственная разметка по данным оригинала.
import { recPadding } from './zero.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** вкладки (t395): записи Zero из data-tab-rec-ids показываются/скрываются JS (src/js/tabs.js) */
export function tabsBlock($, rec) {
  const id = rec.attr('id').replace('rec', '');
  const tabs = rec.find('li.t395__tab').map((i, li) => {
    const t = $(li);
    return `<li class="tb-t${t.hasClass('t395__tab_active') ? ' on' : ''}" role="presentation" data-ids="${esc(t.attr('data-tab-rec-ids'))}"><button type="button" class="tb-b" role="tab" aria-selected="${t.hasClass('t395__tab_active')}">${t.find('.t395__title').first().html().trim()}</button></li>`;
  }).get().join('');
  const css = recPadding(rec.attr('class') || '', id);
  const info = rec.find('li.t395__tab').map((i, li) => ({ on: $(li).hasClass('t395__tab_active'), ids: ($(li).attr('data-tab-rec-ids') || '').split(',').filter(Boolean) })).get();
  return { id, css, tabs: info, html: `<section id="r${id}" class="r tb-r"><div class="tb" data-tabs><ul class="tb-w" role="tablist">${tabs}</ul></div></section>` };
}

/** «Загрузить еще» (t400) */
export function loadMoreBlock($, rec) {
  const id = rec.attr('id').replace('rec', '');
  const b = rec.find('.t400__submit');
  const css = recPadding(rec.attr('class') || '', id);
  return { id, css, more: (b.attr('data-hidden-rec-ids') || '').split(',').filter(Boolean), html: `<section id="r${id}" class="r lm-r"><div class="lm"><button type="button" class="lm-b" data-more="${esc(b.attr('data-hidden-rec-ids'))}" data-back="${esc(b.attr('data-hide-back-text') || '')}">${b.find('.t-btnflex__text').first().html().trim()}</button></div></section>` };
}

const SHARE = [
  ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=', '<path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.100v2.200H7.700V13h2.700v8h3.100z"/>'],
  ['ВКонтакте', 'https://vk.com/share.php?url=', '<path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.576-1.496c.588-.19 1.341 1.26 2.14 1.818.605.422 1.064.33 1.064.33l2.137-.03s1.117-.071.587-.964c-.043-.073-.308-.661-1.588-1.87-1.34-1.264-1.16-1.059.453-3.246.983-1.332 1.376-2.145 1.253-2.493-.117-.332-.84-.244-.84-.244l-2.406.015s-.178-.025-.31.056c-.13.079-.212.262-.212.262s-.382 1.03-.89 1.907c-1.07 1.85-1.499 1.948-1.674 1.832-.407-.267-.305-1.075-.305-1.648 0-1.793.267-2.54-.521-2.733-.262-.065-.454-.107-1.123-.114-.858-.009-1.585.003-1.996.208-.274.136-.485.44-.356.457.159.022.519.099.71.363.246.341.237 1.107.237 1.107s.142 2.11-.33 2.371c-.325.18-.77-.187-1.725-1.865-.489-.859-.859-1.809-.859-1.809s-.07-.177-.198-.272c-.154-.115-.37-.151-.37-.151l-2.286.015s-.343.01-.469.161c-.112.134-.009.411-.009.411s1.79 4.258 3.817 6.403c1.858 1.967 3.968 1.838 3.968 1.838z"/>'],
];
/** кнопки «поделиться» (t014, виджет Яндекса заменён обычными ссылками — без внешних скриптов) */
export function shareBlock($, rec) {
  const id = rec.attr('id').replace('rec', '');
  const css = recPadding(rec.attr('class') || '', id);
  const items = SHARE.map(([n, u, p]) => `<a class="sh-a" href="${u}" target="_blank" rel="noopener" aria-label="${n}" data-share="${u}"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">${p}</svg></a>`).join('');
  return { id, css, html: `<section id="r${id}" class="r sh-r"><div class="sh">${items}</div></section>` };
}
