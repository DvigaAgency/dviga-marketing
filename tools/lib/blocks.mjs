// Блоки со стандартной вёрсткой Tilda: квиз (t1040) и аккордеон (t668).
// Разметка — из записи оригинала (без скриптов и служебных полей), стили — data/block-css/<id>.css (tools/extract-block-css.mjs).
import fs from 'node:fs';
import * as cheerio from 'cheerio';
import { picture, cssImage } from './assets.mjs';
import { fixLinks } from './util.mjs';
import { recPadding } from './zero.mjs';

// inline-стили: px масштабируются так же, как в CSS (calc(Npx*var(--ui)))
const scaleStyle = (s) => s.replace(/(-?\d*\.?\d+)px/g, (m, n) => (+n === 0 ? '0' : `calc(${n}px*var(--ui))`));
const recBg = (rec, id) => { const m = (rec.attr('style') || '').match(/background-color:\s*([^;\s]+)/); return m ? `#r${id}{background-color:${m[1]}}` : ''; };
const recCls = (rec) => (rec.attr('class') || '').split(/\s+/).filter((c) => c && c !== 'r' && c !== 't-rec' && !/^t-rec_/.test(c)).join(' ');
const blockCss = (id) => (fs.existsSync(`data/block-css/${id}.css`) ? fs.readFileSync(`data/block-css/${id}.css`, 'utf8') : '');
// на широких экранах оригинал не масштабирует такие блоки (Tilda: фиксированные px) — масштаб только на узких
const unscaleWide = (id) => `@media (min-width:1200px){#r${id}{--ui:1}}`;

const clean = ($, root) => {
  root.find('style,script,noscript,meta').remove();
  root.find('*').contents().filter((i, n) => n.type === 'comment').remove();
  root.find('*').each((i, e) => {
    for (const a of Object.keys(e.attribs || {})) {
      if (/^(field|imgfield|bgimgfield|itemprop|itemscope|itemtype|data-redactor-.*|data-customstyle)$/.test(a)) $(e).removeAttr(a);
    }
    const st = $(e).attr('style');
    if (st !== undefined) { const v = scaleStyle(st).trim(); v && !/^display:\s*;?$/.test(v) ? $(e).attr('style', v) : $(e).removeAttr('style'); }
  });
};

/** аккордеон (t668): список «вопрос — ответ»; открытие/закрытие — src/js/accordion.js */
export function accordionBlock($, rec) {
  const id = rec.attr('id').replace('rec', '');
  const root = cheerio.load(`<div>${$.html(rec.find('.t668'))}</div>`, { decodeEntities: false });
  const r = root('div').first();
  clean(root, r);
  r.find('.t668__content').attr('hidden', '');
  const html = fixLinks(r.html());
  const css = [recPadding(rec.attr('class') || '', id), recBg(rec, id), blockCss(id), unscaleWide(id)].join('\n');
  return { id, css, html: `<section id="r${id}" class="r acc ${recCls(rec)}" data-acc>${html}</section>` };
}

/** квиз (t1040): шаги, условные экраны и результаты — по разметке оригинала; логика — src/js/quiz.js */
export function quizBlock($, rec, hooks = {}) {
  const id = rec.attr('id').replace('rec', '');
  const root = cheerio.load(`<div>${$.html(rec.find('.t1040'))}</div>`, { decodeEntities: false });
  const q = root('div').first();
  const extra = [];
  const formName = q.find('input[name=tildaspec-formname]').attr('value') || 'Квиз';
  q.find('.t-animate').removeClass('t-animate t-animate_wait').removeAttr('data-animate-style').removeAttr('data-animate-group');
  // фоны экранов результата — локальные изображения (image-set), а не tilda-адреса
  q.find('.t-quiz__result-img-wrapper').each((i, e) => {
    const u = root(e).attr('data-original'); if (!u) return;
    root(e).removeAttr('data-original').removeAttr('style').removeClass('t-bgimg').addClass(`qri${i}`);
    extra.push(`#r${id} .qri${i}{background-image:${cssImage(u, 960, 720)}}`);
  });
  // аватар консультанта
  q.find('img.t-quiz__consultant__img').each((i, e) => {
    const u = root(e).attr('src');
    root(e).replaceWith(picture(u, { cls: 't-quiz__consultant__img', alt: 'Тимофей Белоглазов', sizes: '54px', eager: false }).replace(/ width="\d+" height="\d+"/, '')); // размеры задаёт CSS (aspect-ratio)
  });
  clean(root, q);
  q.find('input.js-formaction-services,input[name^=tildaspec-formname],.t-quiz__result_ordinary,.t-form__errorbox-middle,.t-form__errorbox-bottom').remove();
  q.find('input[type=hidden][name^=tildaspec-mask]').remove();
  q.find('input[data-tilda-mask]').each((i, e) => { root(e).attr('data-mask', '').removeAttr('data-tilda-mask').removeAttr('pattern'); });
  q.find('input').each((i, e) => { root(e).removeAttr('data-tilda-rule').removeAttr('aria-describedby'); });
  const form = q.find('form');
  form.attr('action', '/api/lead').attr('data-quiz-form', formName).attr('novalidate', '');
  form.removeAttr('data-success-callback').removeAttr('data-formactiontype').removeAttr('data-inputbox').removeAttr('role');
  const html = fixLinks(q.html());
  const css = [recPadding(rec.attr('class') || '', id), recBg(rec, id), blockCss(id), extra.join('\n'), `:where(#r${id}) picture{display:contents}:where(#r${id}) .t-quiz__consultant__img{display:block}@media screen and (max-width:640px){#r${id} .t-quiz__btn-wrapper.t-quiz__btn-wrapper_mobile{display:flex;opacity:1}}`, unscaleWide(id)].join('\n');
  return { id, css, html: `<section id="r${id}" class="r qz ${recCls(rec)}" data-quiz>${html}</section>` };
}
