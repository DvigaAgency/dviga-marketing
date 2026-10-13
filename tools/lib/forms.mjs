// Генерация HTML форм (Zero-формы, t702, t708). Разметка — собственная, логика — src/js/forms.js.
import { makeGetter } from './zero-layout.mjs';
import { fixLinks as fixHref } from './util.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const unesc = (s) => String(s ?? '').replace(/&nbsp;/g, ' ');

/** одно поле */
export function renderField(f, o = {}) {
  const type = f.li_type;
  if (f.loff === 'y') return '';
  const name = f.li_nm || f.li_name || type;
  const req = f.li_req === 'y' ? ' data-req="1" required' : '';
  const ph = f.li_ph ? ` placeholder="${esc(unesc(f.li_ph))}"` : '';
  const title = f.li_title ? `<div class="ft">${f.li_title}</div>` : '';
  const err = '<div class="fe" role="alert"></div>';
  const wrap = (inner) => `<div class="fg" data-t="${type}">${title}<div class="fb">${inner}${err}</div></div>`;
  switch (type) {
    case 'nm': return wrap(`<input class="fi" type="text" name="${esc(name)}" autocomplete="name"${ph}${req}>`);
    case 'em': return wrap(`<input class="fi" type="email" name="${esc(name)}" autocomplete="email" inputmode="email"${ph}${req} data-rule="email">`);
    case 'ph': return wrap(`<input class="fi" type="tel" name="${esc(name)}" autocomplete="tel" inputmode="tel"${ph}${req} data-rule="phone" data-mask="${esc(f.li_mask || '')}">`);
    case 'in': return wrap(`<input class="fi" type="text" name="${esc(name)}"${ph}${req}>`);
    case 'ta': return wrap(`<textarea class="fi" name="${esc(name)}" rows="${f.li_rows || 3}"${ph}${req}></textarea>`);
    case 'sb': {
      const opts = String(f.li_variants || '').split('\n').filter(Boolean).map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      return wrap(`<select class="fi" name="${esc(name)}"${req}><option value="">${esc(f.li_title || '')}</option>${opts}</select>`).replace(title, '');
    }
    case 'uw': return `<div class="fg" data-t="uw"><div class="fb"><label class="ff fu-b"><input type="file" name="${esc(name)}[]" multiple hidden>Загрузить файлы</label><small class="fu-n" aria-live="polite"></small>${err}</div></div>`;
    case 'cb': return `<div class="fg" data-t="cb"><div class="fb"><label class="fk"><input type="checkbox" name="${esc(name)}" value="yes"${req}><i></i><span>${fixHref(f.li_label)}</span></label>${err}</div></div>`;
    case 'rd': {
      const opts = (o.options || []).map((v) => `<label class="fr"><input type="radio" name="${esc(name)}" value="${esc(v)}"${req}><i></i><span>${esc(v)}</span></label>`).join('');
      return `<div class="fg" data-t="rd" role="radiogroup"><div class="ft">${esc(f.li_title || name)}</div><div class="fb">${opts}${err}</div></div>`;
    }
    default: return '';
  }
}

const px = (v) => (v === null || v === undefined || v === '' ? null : `${parseFloat(v)}px`);

/** Zero-форма: стили из data-field-*, поля из data-value */
export function renderZeroForm(attrs, inputs, uid, screens) {
  const g = makeGetter(attrs, screens, 'data-field-', '-value');
  const R = screens[screens.length - 1];
  const v = (k) => g(k, R);
  const vars = {
    '--ih': px(v('inputheight')), '--ir': px(v('inputradius')), '--ibw': px(v('inputbordersize')), '--ibc': v('inputbordercolor'), '--ibg': v('inputbgcolor'), '--ic': v('inputcolor'),
    '--ifs': px(v('inputfontsize')), '--ifw': v('inputfontweight'), '--mb': px(v('inputmargbottom')),
    '--tfs': px(v('inputtitlefontsize')), '--tfw': v('inputtitlefontweight'), '--tc': v('inputtitlecolor'), '--tmb': px(v('inputtitlemargbottom')), '--ec': v('inputelscolor'),
    '--bh': px(v('buttonheight')), '--bmt': px(v('buttonmargtop')), '--br': px(v('buttonradius')), '--bbg': v('buttonbgcolor'), '--bc': v('buttoncolor'),
    '--bfs': px(v('buttonfontsize')), '--bfw': v('buttonfontweight'), '--bhb': v('buttonhoverbgcolor'), '--bhc': v('buttonhovercolor'),
  };
  const style = Object.entries(vars).filter(([, x]) => x).map(([k, x]) => `${k}:${x}`).join(';');
  // значения кнопки на других брейкпоинтах
  let css = '';
  const prev = {};
  for (const r of screens) {
    const cur = { '--bw': px(g('buttonwidth', r)) };
    if (r !== screens[screens.length - 1]) {
      // мобильные значения записываем как переопределения по max-width
    }
    prev[r] = cur;
  }
  const mediaVals = screens.slice(0, -1).map((r) => [r, px(g('buttonwidth', r))]);
  const maxW = px(g('buttonwidth', R));
  let last = null;
  const rules = [];
  for (const [r, w] of mediaVals) { if (w !== last) { rules.push([r, w]); last = w; } }
  if (maxW !== last) rules.push([R, maxW]);
  rules.forEach(([r, w], i) => { css += i === 0 ? `.f${uid}{--bw:${w}}` : `@media(min-width:${r}px){.f${uid}{--bw:${w}}}`; });
  const fields = inputs.sort((a, b) => (+a.ls || 0) - (+b.ls || 0)).map((f) => renderField(f)).join('');
  const msg = attrs['data-field-formmsgsuccess-value'] || 'Спасибо! Мы свяжемся с вами.';
  const btn = attrs['data-field-buttontitle-value'] || 'Отправить';
  const html = `<form class="fm f${uid}" data-f="${uid}" action="/api/lead" method="post" novalidate style="${esc(style)}"><div class="fz" role="status" aria-live="polite">${msg}</div><div class="fx">${fields}</div><button class="fo" type="submit">${esc(btn)}</button></form>`;
  return { html, css };
}

/** Форма из блоков t702 / t708 (многошаговая при наличии разделителей-шагов) */
export function renderTildaForm($, formEl, uid, o = {}) {
  const form = $(formEl);
  const screens = [[]];
  let next = 'Далее'; let prev = 'Назад';
  form.find('.t-input-group').each((i, g) => {
    const x = $(g); const type = x.attr('data-field-type');
    if (type === 'st') {
      next = x.find('[data-tilda-form-step-btn-next]').attr('data-tilda-form-step-btn-next') || next;
      prev = x.find('[data-tilda-form-step-btn-prev]').attr('data-tilda-form-step-btn-prev') || prev;
      screens.push([]); return;
    }
    const inp = x.find('input,textarea,select').first();
    const f = {
      li_type: type, li_nm: x.attr('data-field-name') || inp.attr('name') || type,
      li_ph: inp.attr('placeholder'), li_req: inp.attr('data-tilda-req') === '1' ? 'y' : '',
      li_mask: inp.attr('data-tilda-mask'), li_title: x.find('.t-input-title').first().html(),
      li_rows: inp.attr('rows'),
    };
    if (type === 'cb') f.li_label = fixHref(x.find('.t-checkbox__control > span').last().html() || x.find('.t-checkbox__labeltext').html());
    const options = type === 'rd' ? x.find('.t-radio__item span').map((j, s) => $(s).text()).get() : [];
    if (type === 'rd') f.li_title = x.find('.t-input-title').first().text().trim();
    screens.at(-1).push(renderField(f, { options }));
  });
  const multi = screens.length > 1;
  const body = screens.map((s, i) => `<div class="fs${i === 0 ? ' on' : ''}">${s.join('')}</div>`).join('');
  const label = o.submit || form.find('.t-btnflex_type_submit .t-btnflex__text').first().text().trim() || 'Отправить';
  const actions = multi
    ? `<div class="fa"><button type="button" class="fo bk" data-prev hidden>${esc(prev)}</button><button type="button" class="fo" data-next>${esc(next)}</button><button class="fo" type="submit" hidden>${esc(label)}</button></div>`
    : `<button class="fo" type="submit">${esc(label)}</button>`;
  const vars = o.vars || '';
  const msg = o.success || 'Спасибо! Мы свяжемся с вами.';
  return `<form class="fm f${uid}" data-f="${uid}" action="/api/lead" method="post" novalidate style="${vars}"><div class="fz" role="status" aria-live="polite">${msg}</div><div class="fx">${body}</div>${actions}</form>`;
}
