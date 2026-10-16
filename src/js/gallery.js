// Галерея Zero-блока: горизонтальная прокрутка со scroll-snap, точки, автоплей (data-ap — секунды), зацикливание.
export function init(gl) {
  if (gl._init) return;
  gl._init = 1;
  const t = gl.querySelector('.gl-t');
  const dots = Array.from(gl.querySelectorAll('.gl-d i'));
  const n = t.children.length;
  let i = 0;
  const w = () => t.clientWidth || 1;
  const show = (k) => { i = (k + n) % n; t.scrollTo({ left: i * w(), behavior: k === i || k < 0 ? 'smooth' : 'auto' }); };
  t.addEventListener('scroll', () => { const k = Math.round(t.scrollLeft / w()); if (k !== i) { i = k; } dots.forEach((d, j) => d.classList.toggle('on', j === i)); }, { passive: true });
  const ap = +gl.dataset.ap;
  if (ap > 0 && n > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let vis = true; let hover = false;
    new IntersectionObserver((e) => { vis = e[0].isIntersecting; }).observe(gl);
    gl.addEventListener('mouseenter', () => { hover = true; });
    gl.addEventListener('mouseleave', () => { hover = false; });
    setInterval(() => { if (vis && !hover && !document.hidden) show(i + 1 === n ? 0 : i + 1); }, ap * 1000);
  }
}
