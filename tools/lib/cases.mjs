// Каталог кейсов: карточки собираются из Zero-блоков страницы /cases оригинала, вкладки-категории заменены
// фильтрацией «Услуги» × «Отрасли» (как на andva.ru/cases) + поиск по названию.
import { picture, lookup } from './assets.mjs';
import { link } from './util.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&shy;|­/g, '').replace(/\s+/g, ' ').trim();

export const SERVICES = [['sites', 'Сайты'], ['branding', 'Брендинг'], ['naming', 'Нейминг'], ['identity', 'Фирменный стиль'], ['promo', 'Продвижение'], ['auto', 'Автоматизация']];
export const INDUSTRIES = [['realty', 'Недвижимость и строительство'], ['logistics', 'Логистика и транспорт'], ['industry', 'Производство'], ['fmcg', 'FMCG и ритейл'], ['tourism', 'Туризм'], ['services', 'Услуги и сервисы']];
// вкладки оригинала -> фильтры
const TAB_SERVICE = { 'Сайты': 'sites', 'Брендинг': 'branding', 'Продвижение': 'promo', 'Автоматизация': 'auto' };
const TAB_INDUSTRY = { 'Недвижимость': 'realty', 'Логистические компании': 'logistics', 'Производство': 'industry' };
// метка отрасли на карточке -> фильтр
const TAG_INDUSTRY = { 'Недвижимость': 'realty', 'Строительство': 'realty', 'Логистика': 'logistics', 'Транспорт': 'logistics', 'Таможня': 'logistics', 'Производство': 'industry', 'Промышленность': 'industry', 'FMCG': 'fmcg', 'Ритейл': 'fmcg', 'Детские товары': 'fmcg', 'Туризм': 'tourism', 'Услуги': 'services', 'Бухгалтерия': 'services', 'Автоматизация': 'services' };

/** вкладки страницы: из разметки T395 + добавленные скриптом записи («.t395__wrapper').append(...)) */
function readTabs($, source) {
  const tabs = [];
  $('li.t395__tab').each((i, li) => tabs.push({ title: $(li).find('.t395__title').first().text().trim(), ids: ($(li).attr('data-tab-rec-ids') || '').split(',').filter(Boolean) }));
  const re = /data-tab-rec-ids="([^"]*)"><div class="t395__title[^>]*>([^<]*)<\/div>/g;
  let m;
  while ((m = re.exec(source))) tabs.push({ title: m[2].trim(), ids: m[1].split(',').filter(Boolean) });
  return tabs;
}

function readCards($, tabs) {
  const cards = new Map();
  const order = [];
  const ids = [...new Set(tabs.flatMap((t) => t.ids))];
  // «Все кейсы» первой — порядок как на оригинале
  const all = tabs.find((t) => /^Все/.test(t.title));
  const seq = all ? [...new Set([...all.ids, ...ids])] : ids;
  for (const id of seq) {
    const r = $(`#rec${id}`);
    if (!r.length || (r.attr('data-record-type') !== '396' && r.attr('data-alias-record-type') !== '396')) continue;
    const els = r.find('.t396__elem').map((i, e) => {
      const el = $(e); const a = el.children().first(); const at = el.attr();
      return { type: el.attr('data-elem-type'), top: +at['data-field-top-value'], left: +at['data-field-left-value'], w: +at['data-field-width-value'], h: +at['data-field-height-value'], html: a.html(), text: a.text().trim(), href: a.attr('href') || a.find('a').attr('href'), bg: (a.attr('style') || '').match(/url\('?([^')]+)/)?.[1], orig: a.attr('data-original') };
    }).get();
    const titles = els.filter((e) => e.type === 'text' && e.href && /^\/cases\//.test(e.href)).sort((a, b) => a.top - b.top || a.left - b.left);
    for (const t of titles) {
      const img = els.filter((e) => e.type === 'shape' && e.bg && !e.orig && e.top < t.top && Math.abs(e.left - t.left) < 40).sort((a, b) => b.top - a.top)[0];
      const tag = els.filter((e) => e.type === 'text' && !e.href && e.top > t.top && Math.abs(e.left - t.left) < 10).sort((a, b) => a.top - b.top)[0];
      const badges = img ? els.filter((e) => e.type === 'shape' && e.orig && e.left >= img.left && e.left < img.left + img.w && e.top >= img.top && e.top < img.top + img.h).sort((a, b) => a.left - b.left || a.top - b.top) : [];
      let c = cards.get(t.href);
      if (!c) {
        c = { href: t.href, title: plain(t.html), tag: tag ? tag.text : '', img: img && img.bg, iw: img && img.w, ih: img && img.h, badges: badges.map((b) => ({ url: b.orig, dx: b.left - img.left, dy: b.top - img.top, w: b.w, h: b.h })), recs: new Set() };
        cards.set(t.href, c); order.push(c);
      }
      c.recs.add(id);
    }
  }
  for (const c of order) c.tabs = tabs.filter((t) => [...c.recs].some((r) => t.ids.includes(r))).map((t) => t.title);
  return order;
}

/** распределение карточки по фильтрам: вкладки оригинала + метка отрасли + ключевые слова названия */
export function classify(c) {
  const s = new Set(); const i = new Set();
  for (const t of c.tabs) { if (TAB_SERVICE[t]) s.add(TAB_SERVICE[t]); if (TAB_INDUSTRY[t]) i.add(TAB_INDUSTRY[t]); }
  if (TAG_INDUSTRY[c.tag]) i.add(TAG_INDUSTRY[c.tag]);
  if (/нейминг/i.test(c.title)) { s.add('naming'); s.add('branding'); }
  if (/фирменн|айдентик|брендинг|позиционирован/i.test(c.title)) { s.add('identity'); s.add('branding'); }
  if (/рекламн|реклама|продвижени/i.test(c.title)) s.add('promo');
  if (/сайт|лендинг|интернет магазин|интернет-магазин|портал|калькулятор|интерфейс|агрегатор/i.test(c.title)) s.add('sites');
  if (/автоматизац/i.test(c.title)) s.add('auto');
  return { s: SERVICES.map((x) => x[0]).filter((k) => s.has(k)), i: INDUSTRIES.map((x) => x[0]).filter((k) => i.has(k)) };
}

export function casesCatalog($, firstRec, ctx) {
  const source = $.html();
  const tabs = readTabs($, source);
  const cards = readCards($, tabs);
  const skip = new Set(tabs.flatMap((t) => t.ids));
  $('.r[data-record-type=400]').each((i, e) => skip.add($(e).attr('id').replace('rec', '')));
  skip.add('698207106');
  const html = cards.map((c) => {
    const k = classify(c);
    const m = c.img && lookup(c.img);
    const ratio = c.iw && c.ih ? `${c.iw}/${c.ih}` : m ? `${m.w}/${m.h}` : '4/3';
    const img = c.img ? picture(c.img, { alt: '', sizes: '(min-width:1200px) 560px,(min-width:640px) 46vw,100vw', cls: 'cs-p' }) : '';
    const badges = c.badges.map((b) => `<span class="cs-b" style="left:${((b.dx / c.iw) * 100).toFixed(2)}%;top:${((b.dy / c.ih) * 100).toFixed(2)}%;width:${((b.w / c.iw) * 100).toFixed(2)}%">${picture(b.url, { alt: '', sizes: '65px' })}</span>`).join('');
    const q = `${c.title} ${c.tag}`.toLowerCase();
    const href = link(c.href);
    return `<article class="cs-c" data-s="${k.s.join(' ')}" data-i="${k.i.join(' ')}" data-q="${esc(q)}"><a class="cs-i" href="${esc(href)}" tabindex="-1" aria-hidden="true" style="aspect-ratio:${ratio}">${img}${badges}</a><h3 class="cs-t"><a href="${esc(href)}">${esc(c.title)}</a></h3><div class="cs-g">${esc(c.tag)}</div></article>`;
  }).join('');
  const opt = (name, list) => list.map(([v, l]) => `<label class="cs-o"><input type="checkbox" name="${name}" value="${v}"><i></i><span>${l}</span></label>`).join('');
  const ui = `<section id="r-cases" class="r cs-r"><div class="cs" data-cases-root>
<form class="cs-f" role="search" onsubmit="return false"><input class="cs-q" type="search" name="q" placeholder="Поиск по кейсам" aria-label="Поиск по кейсам" autocomplete="off"><svg class="cs-m" width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true"><circle r="7.93" transform="matrix(.7156 .6985 -.7156 .6985 18.59 11.78)" stroke="#b6b6b6"/><line y1="-.5" x2="9.18" y2="-.5" transform="matrix(-.7156 .6985 -.7156 -.6985 12.75 16.96)" stroke="#b6b6b6"/></svg></form>
<button type="button" class="cs-tg" aria-expanded="false" aria-controls="cs-panel">Фильтры<i></i><b class="cs-n" hidden></b></button>
<div class="cs-pn" id="cs-panel" hidden><div class="cs-gr"><fieldset class="cs-fs"><legend>Услуги</legend><div class="cs-os">${opt('service', SERVICES)}</div></fieldset><fieldset class="cs-fs"><legend>Отрасли</legend><div class="cs-os">${opt('industry', INDUSTRIES)}</div></fieldset></div><button type="button" class="cs-rs" hidden>Сбросить фильтры</button></div>
<div class="cs-l" aria-live="polite">${html}</div>
<p class="cs-e" hidden>По выбранным фильтрам кейсов не найдено. Попробуйте изменить условия поиска.</p>
</div></section>`;
  return { skip, at: '698207106', html: ui, css: '', count: cards.length, cards };
}
