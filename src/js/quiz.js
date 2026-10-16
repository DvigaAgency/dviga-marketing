// Квиз (T1040): шаги с условиями показа, автопереход после выбора, прогресс, подсказки консультанта, отправка на POST /api/lead (заглушка).
import { mask } from './forms.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const MSG = {
  req: 'Обязательное поле',
  email: 'Укажите, пожалуйста, корректный email',
  phone: 'Укажите, пожалуйста, корректный номер телефона',
  fail: 'Не удалось отправить заявку. Попробуйте позже или позвоните 8 800 200 23 02.',
};
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const AUTO_MS = 700; // пауза перед автопереходом после выбора варианта (как в оригинале)

export function init(root) {
  const form = $('form', root);
  if (!form || form._q) return;
  form._q = 1;
  const wrap = $('.t-quiz__quiz-wrapper', root);
  const steps = $$('.t-quiz__screen-wrapper', form).map((el) => {
    let cond = null;
    try { cond = el.dataset.conditionals ? JSON.parse(el.dataset.conditionals) : null; } catch { cond = null; }
    return { el, cond, result: el.classList.contains('t-quiz__result') };
  });
  $$('input[data-mask]', form).forEach(mask);

  // значение вопроса по его идентификатору — для условий показа экранов
  const answer = (lid) => {
    const g = $(`[data-input-lid="${lid}"]`, form);
    if (!g) return [];
    return $$('input:checked', g).map((i) => i.value);
  };
  const passes = (c) => {
    if (!c) return true;
    const list = (c.conditions || []).filter((x) => !x.disabled);
    if (!list.length) return true;
    const test = (x) => answer(x.fieldId).includes(x.condition && x.condition.value);
    const ok = c.conditionsCombination === 'any' ? list.some(test) : list.every(test);
    return c.action === 'hide' ? !ok : ok;
  };
  const flow = () => steps.filter((s) => !s.result && passes(s.cond));

  const counter = $('.t-quiz__counter', root);
  const bar = $('.t-quiz__progress', root);
  const consultant = $$('.t-quiz__sidebar .js-consultant-msg', root);
  const prevs = $$('.t-quiz__btn_prev', root);
  const nexts = $$('.t-quiz__btn_next', root);
  const subs = $$('.t-quiz__btn_submit', root);
  let cur = steps.find((s) => !s.result);
  let timer = 0;
  let done = false;

  const setErr = (g, text) => {
    g.classList.toggle('js-error-control-box', !!text);
    const e = $('.t-input-error', g);
    if (e) e.textContent = text || '';
  };
  const validate = (g) => {
    const t = g.dataset.fieldType;
    const inputs = $$('input,textarea', g);
    const req = inputs.some((i) => i.hasAttribute('data-tilda-req'));
    if (t === 'rd' || t === 'cb') {
      const group = $$('input[type=radio],input[type=checkbox]', g);
      const ok = group.some((i) => i.checked);
      if (req && !ok) { setErr(g, MSG.req); return false; }
      const own = $('.t-radio-ownanswer:checked', g);
      if (own) { const o = $('.t-input-ownanswer', g); if (o && !o.value.trim()) { setErr(g, MSG.req); return false; } }
      setErr(g); return true;
    }
    const el = inputs.find((i) => i.type !== 'hidden');
    if (!el) return true;
    let v = el.value.trim();
    if (t === 'ph') v = v.replace(/_/g, '');
    if (req && (!v || (t === 'ph' && v === '+7'))) { setErr(g, MSG.req); return false; }
    if (v && t === 'em' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setErr(g, MSG.email); return false; }
    if (v && t === 'ph' && v !== '+7' && v.replace(/\D/g, '').length < 11) { setErr(g, MSG.phone); return false; }
    setErr(g); return true;
  };
  const stepOk = (s) => $$('.t-input-group', s.el).map(validate).every(Boolean);

  const render = () => {
    const f = flow();
    if (!f.includes(cur)) cur = f[0];
    const i = f.indexOf(cur);
    steps.forEach((s) => s.el.classList.toggle('t-step-form__step_active', s === cur));
    if (counter) counter.textContent = `${i + 1}/${f.length}`;
    if (bar) bar.style.width = `${((i + 1) / f.length) * 100}%`;
    const last = i === f.length - 1;
    prevs.forEach((b) => { b.disabled = i === 0; });
    nexts.forEach((b) => b.classList.toggle('t-quiz-hidden', last));
    subs.forEach((b) => b.classList.toggle('t-quiz-hidden', !last));
    const msg = cur.el.dataset.consultantMsg || '';
    consultant.forEach((c) => { c.textContent = msg; const box = c.closest('.t-quiz__consultant'); if (box) box.hidden = !msg; });
  };
  const go = (d) => {
    clearTimeout(timer);
    const f = flow();
    const i = f.indexOf(cur) + d;
    if (i < 0 || i >= f.length) return;
    cur = f[i];
    render();
    const r = root.getBoundingClientRect();
    if (r.top < 0 && r.bottom > 0 && innerWidth < 960) root.scrollIntoView({ block: 'start' });
  };
  const next = () => { if (stepOk(cur)) go(1); };

  nexts.forEach((b) => b.addEventListener('click', next));
  prevs.forEach((b) => b.addEventListener('click', () => go(-1)));

  form.addEventListener('change', (e) => {
    const t = e.target;
    const g = t.closest('.t-input-group');
    if (g && g.classList.contains('js-error-control-box')) validate(g);
    // ответ изменился — набор шагов мог поменяться (условные экраны)
    render();
    if (t.type === 'radio' && !t.classList.contains('t-radio-ownanswer') && flow().indexOf(cur) < flow().length - 1) {
      clearTimeout(timer);
      timer = setTimeout(() => go(1), AUTO_MS);
    }
  });
  form.addEventListener('input', (e) => {
    const g = e.target.closest('.t-input-group');
    if (g && g.classList.contains('js-error-control-box')) validate(g);
  });
  // «Свой вариант»: ввод в поле выбирает этот пункт
  $$('.t-input-ownanswer', form).forEach((o) => {
    const r = $('.t-radio-ownanswer', o.closest('label') || o.parentElement);
    const pick = () => { if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } };
    o.addEventListener('focus', pick);
    o.addEventListener('input', pick);
  });
  // Enter в поле ввода — следующий шаг/отправка, а не случайная отправка формы
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); if (flow().indexOf(cur) < flow().length - 1) next(); else form.requestSubmit(); } });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (done) return;
    if (!stepOk(cur)) return;
    const body = new FormData();
    flow().forEach((s) => $$('.t-input-group', s.el).forEach((g) => {
      const name = g.dataset.fieldName || ($('.t-input-title', g) || {}).textContent || 'Поле';
      const vals = $$('input:checked', g).map((i) => (i.classList.contains('t-radio-ownanswer') ? `Свой вариант: ${($('.t-input-ownanswer', g) || {}).value || ''}` : i.value));
      const txt = $$('input,textarea', g).find((i) => i.type !== 'hidden' && i.type !== 'radio' && i.type !== 'checkbox' && !i.classList.contains('t-input-ownanswer'));
      if (txt) vals.push(txt.value.trim());
      if (vals.length) body.append(name.trim(), vals.join(', '));
    }));
    body.append('form', form.dataset.quizForm || 'Квиз');
    body.append('page', location.href);
    subs.forEach((b) => { b.disabled = true; });
    let ok = false;
    try {
      const r = await fetch('/api/lead', { method: 'POST', body });
      ok = r.ok || DEV;
      if (!r.ok && DEV) console.info('[lead] /api/lead недоступен — dev-заглушка считает отправку успешной');
    } catch { ok = DEV; }
    subs.forEach((b) => { b.disabled = false; });
    if (!ok) { let box = $('.t-quiz__err', root); if (!box) { box = document.createElement('div'); box.className = 't-quiz__err t-input-error'; box.style.display = 'block'; $('.t-quiz__contact-form__main', cur.el).append(box); } box.textContent = MSG.fail; return; }
    // экран результата — по ответам, как условия показа
    done = true;
    const res = steps.find((s) => s.result && passes(s.cond));
    steps.forEach((s) => s.el.classList.toggle('t-step-form__step_active', s === res));
    if (res) { wrap.classList.add('qz-done'); $$('.t-quiz__progress-bar-container,.t-quiz__footer-sticky,.t-quiz__btn-wrapper_mobile', root).forEach((x) => x.classList.add('t-quiz-hidden')); }
  });

  render();
}
