// Слайдер отзывов: бесконечная лента, автоплей 3 с, пауза при наведении, свайп/drag, стрелки (в оригинале скрыты).
export function init(sl) {
  if (sl._init) return;
  sl._init = 1;
  const vp = sl.querySelector('.sl-vp');
  const tr = sl.querySelector('.sl-tr');
  const orig = Array.from(tr.children);
  const n = orig.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clone = (arr) => arr.map((li) => {
    const c = li.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.querySelectorAll('a,button').forEach((a) => a.setAttribute('tabindex', '-1'));
    return c;
  });
  tr.prepend(...clone(orig));
  tr.append(...clone(orig));
  let idx = n; // первый настоящий слайд
  let off = 0; // смещение при drag, px
  let stride = 0;
  let timer = 0;
  let hover = false;
  let visible = true;
  const z = () => parseFloat(getComputedStyle(sl).zoom) || 1;
  const measure = () => {
    stride = (tr.children[1].getBoundingClientRect().left - tr.children[0].getBoundingClientRect().left) / z();
  };
  const set = (animate) => {
    tr.style.transition = animate ? 'transform .4s ease-in' : 'none';
    tr.style.transform = `translateX(${(-idx * stride + off).toFixed(2)}px)`;
  };
  const wrap = () => {
    if (idx >= 2 * n) idx -= n; else if (idx < n) idx += n;
  };
  const go = (to, animate = true) => {
    idx = to;
    off = 0;
    set(animate && !reduce);
  };
  tr.addEventListener('transitionend', () => { const before = idx; wrap(); if (before !== idx) set(false); });
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);
  const play = () => {
    clearInterval(timer);
    if (reduce) return;
    timer = setInterval(() => { if (!hover && visible && !document.hidden) next(); }, 3000);
  };
  sl.addEventListener('mouseenter', () => { hover = true; });
  sl.addEventListener('mouseleave', () => { hover = false; });
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(sl);
  const bp = sl.querySelector('.sl-p');
  const bn = sl.querySelector('.sl-n');
  if (bp) bp.addEventListener('click', prev);
  if (bn) bn.addEventListener('click', next);
  // drag / swipe
  let sx = 0;
  let sy = 0;
  let drag = false;
  let moved = false;
  let pid = null;
  vp.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = true; moved = false; sx = e.clientX; sy = e.clientY; pid = e.pointerId; off = 0;
  });
  vp.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!moved && Math.abs(e.clientX - sx) < 6) return;
    if (!moved && Math.abs(e.clientY - sy) > Math.abs(e.clientX - sx)) { drag = false; return; }
    if (!moved) { moved = true; vp.setPointerCapture(pid); vp.classList.add('dr'); }
    off = (e.clientX - sx) / z();
    set(false);
  });
  const up = () => {
    if (!drag) return;
    drag = false;
    vp.classList.remove('dr');
    if (!moved) return;
    const dx = off;
    off = 0;
    const steps = Math.round(-dx / stride);
    go(idx + (steps || (Math.abs(dx) > stride * 0.15 ? (dx < 0 ? 1 : -1) : 0)));
  };
  vp.addEventListener('pointerup', up);
  vp.addEventListener('pointercancel', up);
  vp.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  vp.addEventListener('dragstart', (e) => e.preventDefault());
  vp.tabIndex = 0;
  vp.setAttribute('role', 'region');
  vp.setAttribute('aria-roledescription', 'carousel');
  vp.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); set(false); }, 120); });
  measure();
  set(false);
  play();
}
