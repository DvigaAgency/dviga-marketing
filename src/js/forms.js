// Формы: маска телефона, валидация, шаги, отправка на POST /api/lead (заглушка, см. README).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const MSG = {
  req: 'Обязательное поле',
  email: 'Укажите, пожалуйста, корректный email',
  phone: 'Укажите, пожалуйста, корректный номер телефона',
  fail: 'Не удалось отправить заявку. Попробуйте позже или позвоните 8 800 200 23 02.',
};
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

function mask(inp) {
  const fmt = (raw) => {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1);
    d = d.slice(0, 10);
    return `+7${d}${'_'.repeat(10 - d.length)}`;
  };
  inp.addEventListener('focus', () => {
    if (!inp.value) { inp.value = '+7__________'; setTimeout(() => inp.setSelectionRange(2, 2), 0); }
  });
  inp.addEventListener('input', () => {
    inp.value = fmt(inp.value);
    const p = inp.value.indexOf('_');
    const pos = p < 0 ? inp.value.length : p;
    inp.setSelectionRange(pos, pos);
  });
  inp.addEventListener('blur', () => { if (/^\+7_*$/.test(inp.value)) inp.value = ''; });
}

function err(g, text) {
  g.classList.toggle('er', !!text);
  const e = $('.fe', g);
  if (e) e.textContent = text || '';
}

function validate(g) {
  const t = g.dataset.t;
  const el = $('input,textarea,select', g);
  if (!el) return true;
  const req = el.hasAttribute('data-req');
  let v = el.value.trim();
  if (t === 'cb') {
    if (req && !el.checked) { err(g, MSG.req); return false; }
    err(g); return true;
  }
  if (t === 'rd') {
    const ok = $$('input', g).some((r) => r.checked);
    if (req && !ok) { err(g, MSG.req); return false; }
    err(g); return true;
  }
  if (t === 'ph') v = v.replace(/_/g, '');
  if (req && (!v || (t === 'ph' && v === '+7'))) { err(g, MSG.req); return false; }
  if (v && t === 'em' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err(g, MSG.email); return false; }
  if (v && t === 'ph' && v !== '+7' && v.replace(/\D/g, '').length < 11) { err(g, MSG.phone); return false; }
  err(g);
  return true;
}

function bind(form) {
  if (form._b) return;
  form._b = 1;
  $$('input[data-mask]', form).forEach(mask);
  $$('.fg', form).forEach((g) => $$('input,textarea,select', g).forEach((el) => {
    const re = () => g.classList.contains('er') && validate(g);
    el.addEventListener('input', re);
    el.addEventListener('change', re);
  }));
  $$('input[type=file]', form).forEach((f) => f.addEventListener('change', () => {
    const n = $('.fu-n', f.closest('.fb'));
    if (n) n.textContent = Array.from(f.files).map((x) => x.name).join(', ');
  }));
  // шаги
  const screens = $$('.fs', form);
  let step = 0;
  const show = (i) => {
    step = i;
    screens.forEach((s, k) => s.classList.toggle('on', k === i));
    const pv = $('[data-prev]', form);
    const nx = $('[data-next]', form);
    const sb = $('button[type=submit]', form);
    if (pv) pv.hidden = i === 0;
    if (nx) nx.hidden = i === screens.length - 1;
    if (sb && screens.length > 1) sb.hidden = i !== screens.length - 1;
  };
  if (screens.length > 1) {
    show(0);
    $('[data-next]', form).addEventListener('click', () => {
      if ($$('.fg', screens[step]).map(validate).every(Boolean)) show(step + 1);
    });
    $('[data-prev]', form).addEventListener('click', () => show(step - 1));
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!$$('.fg', form).map(validate).every(Boolean)) {
      const bad = $('.fg.er', form);
      if (bad) {
        const si = screens.findIndex((s) => s.contains(bad));
        if (si >= 0) show(si);
        const i = $('input,textarea', bad);
        if (i) i.focus();
      }
      return;
    }
    const btn = $('button[type=submit]', form);
    if (btn) btn.disabled = true;
    const body = new FormData(form);
    body.append('form', form.dataset.f || '');
    body.append('page', location.href);
    let done = false;
    try {
      const r = await fetch('/api/lead', { method: 'POST', body });
      done = r.ok;
      if (!r.ok && DEV) { console.info('[lead] /api/lead недоступен — dev-заглушка считает отправку успешной'); done = true; }
    } catch { done = DEV; }
    if (btn) btn.disabled = false;
    const box = $('.fz', form);
    if (done) { form.classList.remove('eg'); form.classList.add('ok'); form.reset(); } else { form.classList.add('eg'); if (box) box.textContent = MSG.fail; }
  });
}

export function init() { $$('form.fm').forEach(bind); }
