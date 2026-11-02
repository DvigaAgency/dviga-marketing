// Галерея Zero-блока: горизонтальная прокрутка со scroll-snap, точки (кликабельные), стрелки, переключение кликом по левому/правому краю картинки,
// автоплей (data-ap — секунды), зацикливание.
export function init(gl) {
  if (gl._init) return;
  gl._init = 1;
  const t = gl.querySelector('.gl-t');
  const dots = Array.from(gl.querySelectorAll('.gl-d i'));
  const n = t.children.length;
  const w = () => t.clientWidth || 1;
  const cur = () => Math.round(t.scrollLeft / w()); // текущий слайд берём из положения прокрутки: так нет рассинхрона с автоплеем и свайпом
  let lock = 0; // после ручного переключения автоплей на время замолкает
  const show = (k) => { lock = Date.now(); t.scrollTo({ left: (((k % n) + n) % n) * w(), behavior: 'smooth' }); };
  t.addEventListener('scroll', () => { const k = cur(); dots.forEach((d, j) => d.classList.toggle('on', j === k)); }, { passive: true });
  gl.querySelectorAll('.gl-pv').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); show(cur() - 1); }));
  gl.querySelectorAll('.gl-nx').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); show(cur() + 1); }));
  dots.forEach((d, j) => d.addEventListener('click', (e) => { e.stopPropagation(); show(j); }));
  if (n > 1 && !gl.closest('.pp')) { // клик по левой/правой трети картинки (в лайтбоксе не нужен)
    const zone = (e) => { const r = gl.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; return x < 0.3 ? -1 : x > 0.7 ? 1 : 0; };
    gl.addEventListener('mousemove', (e) => { t.style.cursor = e.target.closest('.gl-ar,.gl-d') ? '' : ['w-resize', 'default', 'e-resize'][zone(e) + 1]; });
    gl.addEventListener('click', (e) => { if (e.target.closest('.gl-ar,.gl-d,a')) return; const z = zone(e); if (z) show(cur() + z); });
  }
  const ap = +gl.dataset.ap;
  if (ap > 0 && n > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let vis = true; let hover = false;
    new IntersectionObserver((e) => { vis = e[0].isIntersecting; }).observe(gl);
    gl.addEventListener('mouseenter', () => { hover = true; });
    gl.addEventListener('mouseleave', () => { hover = false; });
    setInterval(() => { if (vis && !hover && !document.hidden && Date.now() - lock > ap * 1000) show(cur() + 1); }, ap * 1000);
  }
}
