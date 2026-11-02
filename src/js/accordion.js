// Аккордеон (T668): вопрос открывает ответ плавным изменением высоты (как в оригинале — max-height за 0,3 с).
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export function init(root) {
  const P = root.querySelector('.t849__accordion') ? 't849' : 't668'; // T668 (FAQ) и T849 (аккордеон текста политики) — одна механика
  const items = $$(`.${P}__accordion`, root);
  const close = (a) => {
    const btn = a.querySelector(`.${P}__trigger-button`);
    const c = a.querySelector(`.${P}__content`);
    btn.setAttribute('aria-expanded', 'false');
    a.querySelector(`.${P}__header`).classList.remove(`${P}__opened`);
    c.style.maxHeight = c.scrollHeight + 'px';
    c.offsetHeight; // eslint-disable-line no-unused-expressions
    c.style.maxHeight = '0px';
    c.style.opacity = '0';
    const done = () => { if (btn.getAttribute('aria-expanded') === 'false') { c.hidden = true; c.style.display = ''; } };
    c.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 400);
  };
  const open = (a) => {
    const btn = a.querySelector(`.${P}__trigger-button`);
    const c = a.querySelector(`.${P}__content`);
    btn.setAttribute('aria-expanded', 'true');
    a.querySelector(`.${P}__header`).classList.add(`${P}__opened`);
    c.hidden = false;
    c.style.display = 'block';
    c.style.maxHeight = '0px';
    c.style.opacity = '0';
    c.offsetHeight; // eslint-disable-line no-unused-expressions
    c.style.maxHeight = c.scrollHeight + 'px';
    c.style.opacity = '1';
  };
  items.forEach((a) => {
    const btn = a.querySelector(`.${P}__trigger-button`);
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen) { close(a); return; }
      if (a.dataset.accordion === 'true') items.forEach((o) => { if (o !== a && o.querySelector(`.${P}__trigger-button`).getAttribute('aria-expanded') === 'true') close(o); });
      open(a);
    });
  });
}
