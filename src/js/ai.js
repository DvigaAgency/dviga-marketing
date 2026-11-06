// AI-помощник DVIGA (/ai): интерфейс чата. Поведение как у референса (AI-помощник курорта Мамисон): крупный заголовок, подсказки-вопросы, строка ввода,
// реплика пользователя справа, индикатор «AI-помощник думает», ответ набирается по словам, под ним — карточки источников и подсказки «что спросить дальше».
// Ответы строит ai-engine.js по базе знаний сайта (assets/ai.<хэш>.json, скачивается при первом касании страницы). Разметка вставляется без innerHTML.
import { createAssistant } from './ai-engine.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
const P = 'vb-a2s__';

export function init(root) {
  if (root._ai) return; root._ai = true;
  const $ = (s) => root.querySelector(s);
  const messages = $('#vb-a2s-messages'); const suggest = $('#vb-a2s-suggest'); const form = $('#vb-a2s-form'); const input = $('#vb-a2s-input'); const send = form.querySelector('.' + P + 'send');
  const reset = $('.' + P + 'reset'); const status = $('.' + P + 'status'); const chat = $('#vb-a2s-chat');
  const base = new URL(root.dataset.ai, location.href).pathname.replace(/\/assets\/[^/]*$/, '');
  let assistant = null; let loading = null; let busy = false; let asked = 0;

  const load = () => {
    if (assistant) return Promise.resolve(assistant);
    if (!loading) loading = fetch(root.dataset.ai).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((j) => (assistant = createAssistant(j))).catch((e) => { loading = null; throw e; });
    return loading;
  };
  // база знаний — при первом касании или в простое (чтобы первый ответ был без задержки)
  const warm = () => load().catch(() => {});
  ['pointerdown', 'focusin', 'mouseover'].forEach((ev) => root.addEventListener(ev, warm, { once: true, passive: true }));
  if (self.requestIdleCallback) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2000);

  const scrollDown = () => { messages.scrollTo({ top: messages.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }); };
  const link = (href, text, cls) => { const a = el('a', cls, text); a.href = base + href; return a; };

  function userMsg(text) {
    const m = el('div', P + 'msg ' + P + 'msg--user'); m.append(el('div', P + 'avatar', 'Вы'), el('div', P + 'bubble', text)); messages.append(m); return m;
  }
  function thinking() {
    const m = el('div', P + 'msg'); const b = el('div', P + 'bubble'); const t = el('span', P + 'typing'); t.append(el('span'), el('span'), el('span'));
    b.append(t, el('span', P + 'thinking', 'AI-помощник думает')); m.append(el('div', P + 'avatar', 'AI'), b); messages.append(m); return { m, b };
  }

  // набор текста по словам
  async function typeInto(node, text) {
    if (reduce) { node.textContent = text; return; }
    const words = text.split(/(\s+)/); node.textContent = '';
    const step = Math.max(1, Math.round(words.length / 70)); // длинные ответы набираются быстрее
    for (let i = 0; i < words.length; i += step) { node.textContent += words.slice(i, i + step).join(''); scrollDown(); await wait(24); }
    node.textContent = text;
  }

  function cardsBlock(cards, more) {
    const ul = el('ul', P + 'list ' + P + 'cards');
    for (const c of cards) {
      const li = el('li', P + 'list-item ' + P + 'card');
      const head = el('span', P + 'card-head'); head.append(el('span', P + 'tag', c.k)); li.append(head);
      li.append(link(c.u, c.t, P + 'card-title'));
      if (c.d) li.append(el('span', P + 'list-item-desc', c.d));
      ul.append(li);
    }
    const wrap = el('div', P + 'block'); wrap.append(ul);
    if (more) wrap.append(link(more.u, more.t + ' →', P + 'more'));
    return wrap;
  }
  function tableBlock(r) {
    const wrap = el('div', P + 'block'); const t = el('div', P + 'table'); t.setAttribute('role', 'table');
    for (const [name, term, price, desc] of r.table) {
      const row = el('div', P + 'trow'); row.setAttribute('role', 'row');
      const a = el('div', P + 'tname'); a.append(el('strong', '', name), el('span', P + 'list-item-desc', desc));
      const b = el('div', P + 'tmeta'); const tm = el('span', P + 'tterm', term); const pr = el('span', P + 'tprice', price);
      if (r.kind === 'timeline') b.append(tm); else b.append(pr, tm);
      row.append(a, b); t.append(row);
    }
    wrap.append(t); return wrap;
  }
  function contactsBlock(r) {
    const ul = el('ul', P + 'list ' + P + 'contacts');
    for (const [label, value, href] of r.contacts) { const li = el('li', P + 'list-item'); li.append(el('span', P + 'list-item-desc', label)); if (href) { const a = el('a', P + 'list-item-title', value); a.href = href; li.append(a); } else li.append(el('span', P + 'list-item-title', value)); ul.append(li); }
    const wrap = el('div', P + 'block'); wrap.append(ul); return wrap;
  }

  async function render(r, bubble) {
    bubble.textContent = '';
    const parts = [];
    if (r.title) { const h = el('p', P + 'faq-q'); h.append(el('strong', '', r.title)); bubble.append(h); }
    const first = el('p'); bubble.append(first);
    await typeInto(first, r.text[0] || '');
    for (const t of r.text.slice(1)) { const p = el('p'); p.textContent = t; p.classList.add(P + 'rise'); bubble.append(p); }
    if (r.bullets) { const ul = el('ul', P + 'list'); for (const b of r.bullets) { const li = el('li', P + 'list-item'); li.append(el('span', P + 'list-item-desc', b)); ul.append(li); } const w = el('div', P + 'block'); w.append(ul); parts.push(w); }
    if (r.table) parts.push(tableBlock(r));
    if (r.contacts) parts.push(contactsBlock(r));
    if (r.cards && r.cards.length) parts.push(cardsBlock(r.cards, r.link));
    else if (r.link) { const w = el('div', P + 'block'); w.append(link(r.link.u, r.link.t + ' →', P + 'more')); parts.push(w); }
    if (r.cta) { const w = el('div', P + 'block'); const a = el('a', P + 'cta', r.cta); a.href = '#form'; w.append(a); parts.push(w); }
    if (r.chips && r.chips.length) { const w = el('div', P + 'followups'); for (const q of r.chips) { const b = el('button', P + 'chip ' + P + 'chip--sm', q); b.type = 'button'; b.dataset.q = q; w.append(b); } parts.push(w); }
    for (const p of parts) { p.classList.add(P + 'rise'); bubble.append(p); scrollDown(); await wait(120); }
    scrollDown();
  }

  async function ask(question) {
    const q = question.trim(); if (!q || busy) return;
    busy = true; send.disabled = true; input.value = ''; input.disabled = false;
    if (!asked++) { chat.classList.add(P + 'chat--active'); messages.classList.add(P + 'messages--active'); suggest.classList.add(P + 'suggest--hidden'); reset.hidden = false; }
    userMsg(q); scrollDown(); form.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    const th = thinking(); scrollDown();
    if (status) status.textContent = 'AI-помощник думает';
    try {
      const [a] = await Promise.all([load(), wait(650 + Math.random() * 450)]);
      const r = a.ask(q);
      th.b.classList.add(P + 'bubble--answer');
      await render(r, th.b);
    } catch (e) {
      th.b.textContent = 'Не удалось загрузить базу знаний. Проверьте соединение и попробуйте ещё раз — или позвоните нам: 8 800 200 23 02.';
    }
    if (status) status.textContent = '';
    form.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); // строка ввода остаётся в поле зрения
    busy = false; send.disabled = false; if (!matchMedia('(pointer: coarse)').matches) input.focus({ preventScroll: true });
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b && root.contains(b)) { e.preventDefault(); ask(b.dataset.q); } });
  reset.addEventListener('click', () => {
    if (busy) return;
    messages.textContent = ''; messages.classList.remove(P + 'messages--active'); chat.classList.remove(P + 'chat--active'); suggest.classList.remove(P + 'suggest--hidden'); reset.hidden = true; asked = 0;
    if (assistant) assistant.reset(); input.value = ''; input.focus({ preventScroll: true });
  });

  // примеры вопросов в строке ввода (пока она пуста и не в фокусе)
  const examples = ['Кейс для сети кофеен', 'Статья про контент-маркетинг', 'Стоимость лендинга', 'Сколько стоит логотип?', 'Как проходит оплата?', 'Кейсы для застройщиков'];
  let ei = 0; const ph = input.getAttribute('placeholder');
  if (!reduce) setInterval(() => { if (document.activeElement !== input && !input.value && !asked) { ei = (ei + 1) % examples.length; input.placeholder = examples[ei]; } }, 3200);
  input.addEventListener('focus', () => { input.placeholder = ph; });
}
