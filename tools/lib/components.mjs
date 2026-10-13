// Не-Zero блоки главной (cookie, отзывы, попапы, виджет, поиск) — собственная разметка по данным оригинала.
import { picture, cssImage, lookup, usedAssets } from './assets.mjs';
import { renderField } from './forms.mjs';
import { fixLinks, ORIGIN } from './util.mjs';
export { fixLinks };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abs = (h) => (h && /^\/(?!\/)/.test(h) && h !== '/' ? ORIGIN + h : h);

const CLOSE_SVG = '<svg role="presentation" width="23" height="23" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><rect transform="translate(11.31 11.31) rotate(-45) translate(-11.31 -11.31)" x="10.31" y="-3.69" width="2" height="30"/><rect transform="translate(11.31 11.31) rotate(-315) translate(-11.31 -11.31)" x="10.31" y="-3.69" width="2" height="30"/></g></svg>';
const closeBtn = '<div class="px"><button type="button" aria-label="Закрыть диалоговое окно" data-close>' + CLOSE_SVG + '</button></div>';

/** cookie-плашка (t657) */
export function cookie($) {
  const r = $('#rec979372986');
  const text = fixLinks(r.find('.t657__text').html().replace(/\s+field="[^"]*"/g, '').trim());
  const btn = r.find('.t-btnflex__text').text().trim();
  return `<div class="ck" id="ck" role="alertdialog" aria-modal="false" aria-label="Cookie"><div class="ck-w"><div class="ck-t">${text}</div><button type="button" class="ck-b" data-ck-ok>${esc(btn)}</button><button type="button" class="ck-x" aria-label="Закрыть уведомление" data-ck-ok><svg role="presentation" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg"><g fill="#000" fill-rule="evenodd"><rect transform="translate(11.31 11.31) rotate(-45) translate(-11.31 -11.31)" x="10.31" y="-3.69" width="2" height="30"/><rect transform="translate(11.31 11.31) rotate(-315) translate(-11.31 -11.31)" x="10.31" y="-3.69" width="2" height="30"/></g></svg></button></div></div>`;
}

/** слайдер отзывов (t525) */
export function reviewsSlider($) {
  const r = $('#rec680540530');
  const items = r.find('li.t525__col').map((i, li) => {
    const x = $(li);
    const bg = x.find('.t525__bgimg').attr('data-original');
    const pic = picture(bg, { cls: '', alt: '', w: 100, h: 100, sizes: '110px' });
    const text = fixLinks(x.find('.t525__text').html().trim());
    return `<li class="si"><div class="si-i">${pic}</div><div class="si-b"><div class="si-x">${text}</div><div class="si-n">${x.find('.t525__title').html().trim()}</div><div class="si-s">${x.find('.t525__descr').html().trim()}</div></div></li>`;
  }).get();
  const prev = lookup('https://static.tildacdn.com/tild3466-3038-4438-b232-343039306635/arrow-left.svg');
  const next = lookup('https://static.tildacdn.com/tild3031-3561-4064-a533-323033643532/arrow-right.svg');
  if (prev) usedAssets.add(prev.src); if (next) usedAssets.add(next.src);
  return `<section class="r sl" id="r680540530" aria-label="Отзывы"><div class="sl-vp"><ul class="sl-tr" role="list">${items.join('')}</ul></div><button type="button" class="sl-a sl-p" aria-label="Предыдущий отзыв" hidden><img src="${prev ? prev.src : ''}" alt="" width="40" height="40"></button><button type="button" class="sl-a sl-n" aria-label="Следующий отзыв" hidden><img src="${next ? next.src : ''}" alt="" width="40" height="40"></button></section>`;
}

/** попапы отзывов (t390) */
export function reviewPopups($) {
  return $('.r[data-record-type=390]').map((i, el) => {
    const r = $(el);
    const hook = r.find('.t-popup').attr('data-tooltip-hook').replace('#popup:', '');
    const btn = r.find('a.t-btnflex');
    const b = btn.length ? `<div class="rv-b"><a class="rv-btn" href="${esc(btn.attr('href'))}">${esc(btn.find('.t-btnflex__text').text().trim())}</a></div>` : '';
    return `<div class="pp" id="p-${hook}" data-hook="popup:${hook}" role="dialog" aria-modal="true" tabindex="-1" aria-label="${esc(r.find('.t-popup').attr('aria-label'))}">${closeBtn}<div class="pc rv"><div class="rv-w"><div class="rv-u">${r.find('.t390__uptitle').html()}</div><div class="rv-t">${r.find('.t390__title').html()}</div><div class="rv-d">${fixLinks(r.find('.t390__descr').html().trim())}</div>${b}</div></div></div>`;
  }).get().join('');
}

/** попапы «Бланк отзыва» с изображением (t756) */
export function blankPopups($) {
  return $('.r[data-record-type=756]').map((i, el) => {
    const r = $(el);
    const hook = r.find('.t-popup').attr('data-tooltip-hook').replace('#popup:', '');
    const img = r.find('.t-slds__bgimg').attr('data-original');
    const pb = parseFloat((r.find('.t-slds__bgimg').attr('style') || '').match(/padding-bottom:\s*([\d.]+)%/)?.[1] || '133');
    const m = lookup(img);
    const w = m?.w || 460; const h = m?.h || Math.round(460 * pb / 100);
    return `<div class="pp" id="p-${hook}" data-hook="popup:${hook}" role="dialog" aria-modal="true" tabindex="-1" aria-label="Бланк отзыва">${closeBtn}<div class="pc bl st">${picture(img, { cls: 'bl-i', alt: 'Бланк отзыва', w, h, sizes: '(min-width:560px) 460px,100vw' })}<div class="bl-w"></div></div></div>`;
  }).get().join('');
}

/** виджет-кнопка и попап «Давайте подскажем» (t708) */
export function widget($, formHtml) {
  const r = $('#rec1468283321');
  const title = r.find('.t708__title').html().replace(/<br\s*\/?>/g, '<br>').trim();
  return `<button type="button" class="wg-b" aria-label="Связаться с нами" data-wg><span class="wg-c"><svg viewBox="0 0 60 60" fill="none" stroke="#fff" stroke-width="2" xmlns="http://www.w3.org/2000/svg" role="presentation"><path d="M17 19h26a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H30l-8 7v-7h-5a2 2 0 0 1-2-2V21a2 2 0 0 1 2-2z" stroke-linejoin="round"/><path d="M22 29h16" stroke-linecap="round"/></svg></span></button><div class="wg-p" id="wg" role="dialog" aria-label="Связаться с нами" data-wgp><div class="wg-t"><button type="button" aria-label="Закрыть" data-wg-close>${CLOSE_SVG}</button></div><div class="wg-w"><div class="wg-h">${title}</div>${formHtml}</div></div>`;
}

/** поиск (t985) */
export function search($) {
  const ph = $('#rec3285898701 input').attr('placeholder') || 'Поиск';
  return `<div class="sr" id="sr" role="dialog" aria-label="Поиск" data-hook="search"><div class="sr-h"><div class="sr-c"><form class="sr-i" action="https://yandex.ru/search/" method="get" target="_blank" role="search"><svg width="30" height="30" viewBox="0 0 30 30" fill="none" role="presentation"><circle r="7.93" transform="matrix(.7156 .6985 -.7156 .6985 18.59 11.78)" stroke="#b6b6b6"/><line y1="-.5" x2="9.18" y2="-.5" transform="matrix(-.7156 .6985 -.7156 -.6985 12.75 16.96)" stroke="#b6b6b6"/></svg><input type="search" name="text" placeholder="${esc(ph)}" aria-label="${esc(ph)}" autocomplete="off"><input type="hidden" name="site" value="dviga.marketing"><button type="button" class="sr-x" aria-label="Закрыть поиск" data-close>×</button></form></div></div></div>`;
}
