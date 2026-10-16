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
  zoom(root);
}

// Фото карточек при прокрутке плавно увеличиваются 1 → 1,1 со сдвигом вверх внутри своей рамки (.cs-i обрезает по краям) —
// как scroll-анимация фото на оригинале: старт, когда карточка входит снизу, длина 770 px (в масштабе страницы).
function zoom(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const vis = new Set();
  const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target))); frame(); }, { rootMargin: '10% 0px' });
  $$('.cs-i', root).forEach((a) => io.observe(a));
  const ui = () => { const w = innerWidth; return w >= 1200 ? w / 1200 : w >= 960 ? w / 960 : w >= 640 ? w / 640 : w >= 480 ? w / 480 : w / 320; };
  let raf = 0;
  function frame() {
    raf = 0;
    const vh = innerHeight; const z = ui();
    vis.forEach((a) => {
      const img = $('.cs-p', a); if (!img) return;
      const box = a.getBoundingClientRect();
      const top = box.top + scrollY;
      const start = top > vh ? top - vh : top; // карточка с первого экрана стартует, когда дойдёт до верха окна
      const p = Math.max(0, Math.min(1, (scrollY - start) / (770 * z)));
      img.style.transform = p ? `translateY(${(-Math.min(30 * z, box.height * 0.05) * p).toFixed(2)}px) scale(${(1 + 0.1 * p).toFixed(4)})` : ''; // сдвиг не больше запаса от увеличения — снизу не открывается фон
    });
  }
  const tick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick);
  tick();
}
