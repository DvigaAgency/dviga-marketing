// Фоновый слайдер обложки (T833): плавная смена и «Кен Бёрнс», как у tilda-cover — шаг 5 с, первый переход через 3 с после загрузки.
export function init(root) {
  const slides = Array.from(root.querySelectorAll('.hs-s'));
  const n = slides.length;
  if (n < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ken = (i) => {
    if (i === n) i = 0;
    slides[i].classList.add('fx');
    if (i === 0 && slides[n - 2]) { slides[n - 2].classList.remove('fx', 'f1'); }
    if (i === 1 && slides[n - 1]) { slides[n - 1].classList.remove('fx', 'f1'); slides.forEach((s) => s.classList.remove('op')); }
    if (i > 1 && slides[i - 2]) slides[i - 2].classList.remove('fx', 'f1');
    setTimeout(() => ken(i + 1), 5000);
  };
  const run = () => setTimeout(() => { slides[0].classList.add('f1'); setTimeout(() => ken(1), 500); }, 3000);
  if (document.readyState === 'complete') run(); else addEventListener('load', run, { once: true });
}
