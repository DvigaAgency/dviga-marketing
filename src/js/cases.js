// Каталог кейсов: поиск + фильтры «Услуги» (ИЛИ внутри группы) × «Отрасли» (ИЛИ), группы объединяются по И. Состояние — в адресе (?service=…&industry=…&q=…).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export function init(root) {
  const q = $('.cs-q', root);
  const cards = $$('.cs-c', root);
  const empty = $('.cs-e', root);
  const panel = $('.cs-pn', root);
  const toggle = $('.cs-tg', root);
  const count = $('.cs-n', root);
  const reset = $('.cs-rs', root);
  const boxes = $$('input[type=checkbox]', root);
  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').trim();

  // начальное состояние из адреса
  const sp = new URLSearchParams(location.search);
  const picked = { service: new Set(sp.getAll('service')), industry: new Set(sp.getAll('industry')) };
  boxes.forEach((b) => { b.checked = picked[b.name] && picked[b.name].has(b.value); });
  if (sp.get('q')) q.value = sp.get('q');

  const apply = (push) => {
    const s = boxes.filter((b) => b.name === 'service' && b.checked).map((b) => b.value);
    const i = boxes.filter((b) => b.name === 'industry' && b.checked).map((b) => b.value);
    const text = norm(q.value);
    let shown = 0;
    cards.forEach((c) => {
      const cs = c.dataset.s.split(' '); const ci = c.dataset.i.split(' ');
      const ok = (!s.length || s.some((v) => cs.includes(v))) && (!i.length || i.some((v) => ci.includes(v))) && (!text || norm(c.dataset.q).includes(text));
      c.hidden = !ok;
      c.classList.toggle('cs-ev', ok && shown % 2 === 1);
      if (ok) shown++;
    });
    empty.hidden = shown > 0;
    const n = s.length + i.length;
    count.hidden = !n; count.textContent = n;
    reset.hidden = !(n || text);
    if (push) {
      const u = new URLSearchParams();
      s.forEach((v) => u.append('service', v)); i.forEach((v) => u.append('industry', v));
      if (q.value.trim()) u.set('q', q.value.trim());
      try { history.replaceState('', '', location.pathname + (u.toString() ? `?${u}` : '') + location.hash); } catch { /* file:// */ }
    }
  };
  boxes.forEach((b) => b.addEventListener('change', () => apply(true)));
  q.addEventListener('input', () => apply(true));
  reset.addEventListener('click', () => { boxes.forEach((b) => { b.checked = false; }); q.value = ''; apply(true); });
  toggle.addEventListener('click', () => { const open = panel.hidden; panel.hidden = !open; toggle.setAttribute('aria-expanded', open); });
  if (picked.service.size || picked.industry.size) { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }
  apply(false);
}
