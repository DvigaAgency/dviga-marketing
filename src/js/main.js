// Ядро поведения страницы: анимации появления, пошаговые анимации, прокрутка, попапы, cookie, видео.
// Без зависимостей. Тяжёлые куски (слайдер, формы) подгружаются динамически.
import { saveUtm } from './lead.js';

const d = document;
const w = window;
const $ = (s, r = d) => r.querySelector(s);
const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
const num = (v, f = 0) => (v == null || v === '' || Number.isNaN(+v) ? f : +v);
const RES = [320, 480, 640, 960, 1200];
const resIdx = () => { let r = 0; RES.forEach((v, i) => { if (innerWidth >= v) r = i; }); return r; };
const zoomOf = (el) => num(getComputedStyle(el).getPropertyValue('--zw'), 1) || 1;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const safe = (f) => { try { return f(); } catch (e) { console.error(e); return null; } };

/* ---------- анимация появления (fadein) ---------- */
function initAppear() {
  const els = $$('.e[data-fi]');
  if (!els.length) return;
  const on = (el) => el.classList.add('in');
  if (reduce) { els.forEach(on); return; }
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { on(en.target); io.unobserve(en.target); } });
  });
  els.forEach((el) => {
    if (innerWidth < 1200 && !el.dataset.mb) on(el); else io.observe(el);
  });
}

/* ---------- пошаговые анимации: hover / click / blockintoview ---------- */
function initSteps() {
  const touch = matchMedia('(hover: none)').matches;
  const all = $$('.e[data-an]').filter((el) => innerWidth >= 1200 || el.dataset.mb);
  const byId = (rec, id) => $(`#${rec.id} .e${id}`);
  const play = (el, rev) => {
    el.classList.remove('on');
    if (!rev) el.classList.remove('rv');
    void el.offsetWidth;
    el.classList.add('on');
    if (rev) el.classList.add('rv');
    if (num(el.dataset.tt) > 0 && !el._loop) {
      el._pl = 1;
      el.addEventListener('animationend', function f(e) {
        if (e.target.parentNode !== el) return;
        el.removeEventListener('animationend', f);
        el._pl = 0;
        const p = el._pd; el._pd = '';
        if (p === 'play' && el.classList.contains('rv')) play(el, false);
        else if (p === 'rev' && !el.classList.contains('rv')) play(el, true);
      });
    }
  };
  const start = (el) => { if (el._pl) el._pd = 'play'; else play(el, false); };
  const end = (el) => {
    const lp = el.dataset.lp || '';
    if (lp.includes('loop')) {
      el.addEventListener('animationiteration', () => el.classList.remove('on', 'rv'), { once: true });
    } else if (lp === 'noreverse') { /* остаётся в конечном состоянии */ } else if (el._pl) el._pd = 'rev'; else play(el, true);
  };
  const into = [];
  all.forEach((el) => {
    const ev = el.dataset.an;
    if (ev === 'hover' || ev === 'click') {
      const rec = el.closest('.r');
      const ids = (el.dataset.tr || '').split(',').filter(Boolean);
      const nodes = ids.length ? ids.map((i) => byId(rec, i)).filter(Boolean) : [el.querySelector('.sw') || el];
      nodes.forEach((n) => {
        n._tl = n._tl || [];
        n._tl.push(el);
        if (n._bound) return;
        n._bound = 1;
        const tl = () => n._tl;
        if (ev === 'click' || touch) {
          n.addEventListener('click', () => tl().forEach((t) => (t.classList.contains('on') && !t.classList.contains('rv') ? end(t) : start(t))));
        } else {
          n.addEventListener('mouseenter', () => tl().forEach(start));
          n.addEventListener('mouseleave', () => tl().forEach(end));
        }
      });
      if (el.dataset.lp && el.dataset.lp.includes('loop')) el._loop = 1;
    } else into.push(el);
  });
  if (!into.length) return;
  const recTop = (el) => el.closest('.r').getBoundingClientRect().top + scrollY;
  const check = () => {
    for (let i = into.length - 1; i >= 0; i--) {
      const el = into[i];
      const line = scrollY + num(el.dataset.to) + innerHeight * num(el.dataset.tg, 1);
      const top = el.dataset.an === 'blockintoview' ? recTop(el) : el.getBoundingClientRect().top + scrollY;
      if (line >= top) { el.classList.add('on'); into.splice(i, 1); }
    }
    if (!into.length) removeEventListener('scroll', onScroll);
  };
  let t = 0;
  const onScroll = () => { if (!t) t = setTimeout(() => { t = 0; check(); }, 100); };
  addEventListener('scroll', onScroll, { passive: true });
  check();
}

/* применение шага scroll-анимации (порт логики пошаговых анимаций) */
function step(n, st, p, i, s) {
  if (st.f && st.state === 1) { n.fix = true; n.sh = 0; n.un = st.un; }
  if (st.f && st.state === 2) { n.fix = false; n.sh += st.dist / s.z; }
  if (st.f && !st.state) { if (i > 0 && n.fix) return; n.fix = false; }
  n.o += p * (st.o - n.o); n.b += p * (st.b - n.b);
  n.x += p * st.x; n.y += p * st.y; n.sx += p * (st.sx - n.sx); n.sy += p * (st.sy - n.sy); n.r += p * st.r;
}

/* ---------- прокрутка: scroll-анимации и фиксация («виртуальный fixed» через transform) ---------- */
function initScroll() {
  const sc = [];
  const fx = [];
  const ri = resIdx();
  const mobile = innerWidth < 1200;
  $$('.e[data-sc]').forEach((el) => {
    if (el.closest('.r.off')) return; // записи, свёрнутые вкладками, измеряются при показе (событие resize)
    const o = JSON.parse(el.dataset.sc);
    if (mobile && !o.m) return;
    const cur = o.r[ri] || o.r[o.r.length - 1];
    if (!cur || !cur.s) return;
    sc.push({ el, w: el.querySelector('.sw') || el, steps: cur.s, t: o.t, o: cur.o });
  });
  $$('.e[data-fx]').forEach((el) => {
    if (el.closest('.r.off')) return;
    const dist = num(el.dataset.fx);
    if (!dist || (mobile && !el.dataset.mb)) return;
    const arr = (el.dataset.fo || '').split(',');
    fx.push({ el, dist, ofst: num(arr[ri] ?? arr[arr.length - 1]) });
  });
  if (!sc.length && !fx.length) return;
  // Измерение без принудительной раскладки на каждый элемент: сначала сбрасываем transform у всех (запись),
  // затем один раз читаем геометрию (одна раскладка), затем возвращаем transform (запись).
  const measure = () => {
    const vh = innerHeight;
    const items = [...sc.map((s) => s.el), ...fx.map((f) => f.el)];
    const saved = items.map((el) => { const sw = el.querySelector('.sw'); return [el.style.transform, sw ? sw.style.transform : '', sw]; });
    items.forEach((el, i) => { el.style.transform = 'none'; if (saved[i][2]) saved[i][2].style.transform = 'none'; });
    const tops = items.map((el) => el.getBoundingClientRect().top + scrollY);
    const zooms = items.map((el) => zoomOf(el));
    items.forEach((el, i) => { el.style.transform = saved[i][0]; if (saved[i][2]) saved[i][2].style.transform = saved[i][1]; });
    sc.forEach((s, i) => {
      const z = zooms[i]; s.z = z;
      s.top = tops[i];
      let to = s.o * z;
      if (s.t === 0.5 || s.t === 1) { to += vh * s.t; if (to > s.top && to <= vh * s.t) to = s.top; }
      s.to = to;
      let un = 0; let prev = s.top;
      s.st = s.steps.map((st) => { const dist = st.d * z; const r = { ...st, dist, start: prev, end: prev + dist, un }; prev += dist; if (!st.f) un += dist; return r; });
    });
    fx.forEach((f, k) => { const i = sc.length + k; f.z = zooms[i]; f.top = tops[i]; f.end = f.top + f.dist * f.z; });
  };
  // Состояние sc-элемента как чистая функция позиции прокрутки y (px) -> {x, y, sx, sy, r, o}
  const calc = (s, y) => {
    const r = y + s.to;
    const n = { o: 1, b: 0, fix: false, sh: 0, x: 0, y: 0, sx: 1, sy: 1, r: 0 };
    s.st.forEach((st, i) => {
      const started = r >= st.start; const fin = st.end <= r;
      if (started && !fin) {
        st.state = 1;
        step(n, st, st.dist === 0 ? 1 : (r - st.start) / st.dist, i, s);
      }
      if (fin) { st.state = 2; step(n, st, 1, i, s); }
      if (!started && st.state) { st.state = 0; step(n, st, 0, i, s); }
    });
    let ty = n.y + n.sh;
    if (n.fix) ty += ((s.to - (n.un || 0)) - (s.top - y)) / s.z;
    return { x: n.x, y: ty, sx: n.sx, sy: n.sy, r: n.r, o: n.o, fix: n.fix };
  };
  const calcFx = (f, y) => {
    const r = y + f.ofst * f.z;
    if (r >= f.end) return f.dist;
    return r >= f.top ? (r - f.top) / f.z : 0;
  };
  const tfOf = (c) => `translate(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px) scale(${c.sx},${c.sy}) rotate(${c.r}deg)`;
  const frame = () => {
    const y = scrollY;
    sc.forEach((s) => {
      const c = calc(s, y);
      const tf = `${c.x ? `translateX(${c.x.toFixed(2)}px)` : ''}${c.y ? `translateY(${c.y.toFixed(2)}px)` : ''}${c.sx !== 1 || c.sy !== 1 ? `scale(${c.sx},${c.sy})` : ''}${c.r ? `rotate(${c.r}deg)` : ''}`;
      s.w.style.transform = tf || 'scale(1)';
      s.w.style.opacity = c.o;
      if (c.fix !== s.fixed) { s.fixed = c.fix; s.w.style.willChange = c.fix ? 'transform' : ''; }
    });
    fx.forEach((f) => {
      const ty = calcFx(f, y);
      if (ty !== f.ty) { f.ty = ty; f.el.style.transform = ty ? `translateY(${ty.toFixed(2)}px)` : ''; }
    });
  };
  // Прокрутка идёт в потоке композитора, а rAF-обработчик отстаёт на кадр, поэтому «виртуальный fixed»
  // на transform дёргается. Где есть ScrollTimeline, раскладываем сцену в кусочно-линейные keyframes по
  // позиции прокрутки: анимацию ведёт композитор синхронно со скроллом, JS на скролле не нужен.
  const native = typeof ScrollTimeline === 'function' && typeof Element.prototype.animate === 'function';
  let anims = [];
  const clear = () => { anims.forEach((a) => a.cancel()); anims = []; };
  const bind = () => {
    const max = d.documentElement.scrollHeight - innerHeight;
    if (!(max > 0)) return false;
    const timeline = new ScrollTimeline({ source: d.scrollingElement, axis: 'block' });
    const pts = (list) => {
      const set = new Set([0, max]);
      list.forEach((v) => [v - 0.5, v, v + 0.5].forEach((p) => { if (p > 0 && p < max) set.add(+p.toFixed(3)); }));
      return [...set].sort((p, q) => p - q);
    };
    const run = (el, frames) => anims.push(el.animate(frames, { timeline, fill: 'both', easing: 'linear', duration: 'auto' }));
    sc.forEach((s) => {
      const ys = pts(s.st.flatMap((st) => [st.start - s.to, st.end - s.to]));
      const frames = ys.map((y) => { const c = calc(s, y); return { offset: y / max, transform: tfOf(c), opacity: c.o }; });
      s.w.style.transform = ''; s.w.style.opacity = ''; s.w.style.willChange = 'transform';
      run(s.w, frames);
    });
    fx.forEach((f) => {
      const ys = pts([f.top - f.ofst * f.z, f.end - f.ofst * f.z]);
      f.el.style.transform = '';
      run(f.el, ys.map((y) => ({ offset: y / max, transform: `translateY(${calcFx(f, y).toFixed(2)}px)` })));
    });
    return true;
  };
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
  let nativeOn = false;
  const apply = () => {
    clear();
    measure();
    try { nativeOn = native && bind(); } catch { clear(); nativeOn = false; }
    if (!nativeOn) { sc.forEach((x) => { x.w.style.willChange = ''; }); frame(); }
  };
  const remeasure = () => { clear(); apply(); };
  apply();
  addEventListener('scroll', () => { if (!nativeOn) onScroll(); }, { passive: true });
  addEventListener('resize', () => { clearTimeout(remeasure.t); remeasure.t = setTimeout(remeasure, 150); });
  addEventListener('load', remeasure);
  addEventListener('cssload', remeasure);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(remeasure);
  // высота страницы меняется по мере рендера секций с content-visibility — keyframes привязаны к диапазону прокрутки
  if (native && window.ResizeObserver) {
    let h = d.documentElement.scrollHeight;
    new ResizeObserver(() => { const nh = d.documentElement.scrollHeight; if (Math.abs(nh - h) > 1) { h = nh; clearTimeout(remeasure.t); remeasure.t = setTimeout(remeasure, 100); } }).observe(d.body);
  }
}

/* ---------- счётчик «50+» ---------- */
function initCounter() {
  const el = $('.myClass016 .a');
  if (!el) return;
  const to = 50; let done = false;
  const run = () => {
    if (done) return; done = true; const t0 = performance.now();
    const tick = (t) => { const b = Math.min(1, (t - t0) / 3000); el.textContent = `${Math.round(1 + (to - 1) * b)}+`; if (b < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  const host = el.closest('.e');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { run(); io.disconnect(); } }), { rootMargin: '0px 0px -33% 0px' });
  io.observe(host);
}

/* ---------- ленивые фоновые картинки ---------- */
function initBg() {
  const els = $$('[data-bg]');
  if (!els.length) return;
  const show = (el) => { el.style.backgroundImage = el.dataset.bg; el.removeAttribute('data-bg'); };
  if (!('IntersectionObserver' in w)) { els.forEach(show); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '700px 0px' });
  els.forEach((el) => io.observe(el));
}

/* ---------- кнопка «Поделиться» (Zero-кнопка с классом share в клонах статей): как на оригинале — системное меню «Поделиться» с адресом страницы;
   там, где Web Share нет (обычный десктопный браузер), копируем адрес в буфер ---------- */
function initShare() {
  $$('.e.share').forEach((b) => {
    b.style.cursor = 'pointer';
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const url = location.href.split('#')[0];
      const meta = $('meta[name="description"]');
      if (navigator.share) { navigator.share({ title: d.title, url, text: meta ? meta.content : '' }).catch(() => {}); return; }
      const t = $('.bt', b); const old = t && t.textContent;
      const done = () => { if (!t) return; t.textContent = 'Ссылка скопирована'; setTimeout(() => { t.textContent = old; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => {});
    });
  });
}

/* ---------- карусель из Zero-записей (клоны статей, tools/lib/slider.mjs): бесконечная, стрелки и перетаскивание ---------- */
function initSlider() {
  $$('.zc').forEach((sl) => {
    const t = sl.firstElementChild;
    const host = sl.closest('.zw') || sl.parentElement;
    const speed = +sl.dataset.speed || 600;
    let busy = false; let dragged = false;
    const w = () => t.firstElementChild.offsetWidth;
    const anim = (from, to, done) => {
      t.style.transition = 'none'; t.style.transform = `translateX(${from}px)`; void t.offsetWidth;
      t.style.transition = `transform ${speed}ms ease`; t.style.transform = `translateX(${to}px)`;
      let ended = false;
      const end = () => { if (ended) return; ended = true; t.removeEventListener('transitionend', end); t.style.transition = 'none'; done(); t.style.transform = 'none'; busy = false; };
      t.addEventListener('transitionend', end); setTimeout(end, speed + 80);
    };
    const next = (from = 0) => { if (busy) return; busy = true; anim(from, -w(), () => t.append(t.firstElementChild)); };
    const prev = (from = 0) => { if (busy) return; busy = true; t.prepend(t.lastElementChild); anim(from - w(), 0, () => {}); };
    $$(':scope .zc-nx', host).forEach((b) => b.addEventListener('click', () => next()));
    $$(':scope .zc-pv', host).forEach((b) => b.addEventListener('click', () => prev()));
    let x0 = null; let dx = 0;
    sl.addEventListener('pointerdown', (e) => { if (busy || (e.pointerType === 'mouse' && e.button)) return; x0 = e.clientX; dx = 0; dragged = false; });
    sl.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      if (Math.abs(dx) > 6 && !dragged) { dragged = true; try { sl.setPointerCapture(e.pointerId); } catch (_) { /* нет захвата — не страшно */ } }
      if (dragged) { const k = (sl.getBoundingClientRect().width || 1) / sl.offsetWidth; t.style.transition = 'none'; t.style.transform = `translateX(${dx / k}px)`; }
    });
    const up = () => {
      if (x0 === null) return;
      const k = (sl.getBoundingClientRect().width || 1) / sl.offsetWidth; const d0 = dx / k; x0 = null;
      if (!dragged) return;
      if (d0 < -w() / 5) next(d0); else if (d0 > w() / 5) prev(d0); else { t.style.transition = 'transform .3s ease'; t.style.transform = 'none'; }
    };
    sl.addEventListener('pointerup', up); sl.addEventListener('pointercancel', up);
    sl.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  });
}

/* ---------- «Частые вопросы» клонов статей: вопрос открывает/закрывает ответ (независимо друг от друга, как на оригинале) ---------- */
function initFaq() {
  $$('[data-fq-t]').forEach((q) => {
    const a = d.getElementById(q.dataset.fqT);
    if (!a) return;
    q.setAttribute('role', 'button'); q.tabIndex = 0; q.setAttribute('aria-expanded', String(a.classList.contains('fq-o')));
    const toggle = () => { const o = a.classList.toggle('fq-o'); q.classList.toggle('fq-on'); q.setAttribute('aria-expanded', String(o)); };
    q.addEventListener('click', toggle);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
}

/* ---------- плееры Rutube / Vimeo / YouTube: по клику на постер подставляем iframe ---------- */
function initEmbeds() {
  $$('.vem[data-embed]').forEach((b) => b.addEventListener('click', () => {
    const u = new URL(b.dataset.embed);
    u.searchParams.set('autoplay', '1');
    if (b.dataset.kind === 'rutube') u.searchParams.set('autoStart', 'true');
    const f = d.createElement('iframe');
    f.src = u.href; f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media'; f.allowFullscreen = true; f.title = 'Видео'; f.setAttribute('frameborder', '0');
    f.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;border:0';
    b.replaceChildren(f); b.removeAttribute('data-embed');
  }));
}

/* ---------- видео ---------- */
function initVideo() {
  const vs = $$('video[data-src]');
  const rv = $$('video[data-rsrc]'); // ролики с хостинга оригинала (тяжёлые, в репозитории их нет): как на Tilda — автоплей без звука по кругу, пока ролик рядом с экраном
  if (rv.length) {
    const start = (v) => {
      const b = v.nextElementSibling;
      if (!v.src) { v.src = v.dataset.rsrc; v.load(); }
      v.muted = true; v.defaultMuted = true; v.playsInline = true;
      return v.play().then(() => { if (b) b.hidden = true; }).catch(() => { if (b) b.hidden = false; }); // автоплей не разрешён (экономия энергии) — показываем кнопку
    };
    rv.forEach((v) => { const b = v.nextElementSibling; if (b) { b.hidden = true; b.addEventListener('click', () => start(v)); } });
    if ('IntersectionObserver' in w) {
      const rio = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) { if (reduce) { if (v.nextElementSibling) v.nextElementSibling.hidden = false; } else start(v); } else v.pause(); }), { rootMargin: '200px 0px' });
      rv.forEach((v) => rio.observe(v));
    } else rv.forEach((v) => { if (v.nextElementSibling) v.nextElementSibling.hidden = false; });
  }
  if (!vs.length && !rv.length) return;
  // постеры подгружаются заранее (за ~1,5 экрана), сами ролики — только вблизи экрана и играют только в нём
  const pio = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { const v = e.target; if (v.dataset.poster) v.poster = v.dataset.poster; pio.unobserve(v); }
  }), { rootMargin: '1200px 0px' });
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      v.muted = true; v.defaultMuted = true; v.playsInline = true;
      if (!v.src) { v.src = v.dataset.src; v.load(); }
      if (!reduce) v.play().catch(() => { wait.add(v); });
    } else v.pause();
  }), { rootMargin: '200px 0px' });
  vs.forEach((v) => { pio.observe(v); io.observe(v); });
  rv.forEach((v) => pio.observe(v));
  // iOS (режим энергосбережения) и часть браузеров не дают автоплей без жеста — повторяем при первом касании/прокрутке
  const wait = new Set();
  const retry = () => { wait.forEach((v) => { if (v.getBoundingClientRect().bottom > 0 && v.getBoundingClientRect().top < innerHeight) v.play().then(() => wait.delete(v)).catch(() => {}); }); };
  ['touchend', 'click', 'pointerup', 'scroll', 'keydown'].forEach((t) => addEventListener(t, retry, { passive: true }));
  vs.forEach((v) => { v.addEventListener('error', () => console.warn('video error', v.error && v.error.code)); v.addEventListener('stalled', () => { if (v.readyState < 2 && v.src) v.load(); }); });
}

/* ---------- горизонтальный drag-скролл (лента наград) ---------- */
function initDrag() {
  $$('.dg').forEach((el) => {
    const inertia = el.classList.contains('dgi') && !reduce; // ScrollBooster оригинала: после отпускания лента докатывается (трение ~5% за кадр)
    let x = 0; let sl = 0; let down = false; let px = 0; let v = 0; let t = 0; let raf = 0;
    el.addEventListener('mousedown', (e) => { cancelAnimationFrame(raf); down = true; x = px = e.pageX; sl = el.scrollLeft; v = 0; el.classList.add('gr'); });
    addEventListener('mouseup', () => {
      if (!down) return;
      down = false; el.classList.remove('gr');
      if (!inertia || performance.now() - t > 80) return;
      const run = () => { if (Math.abs(v) < 0.1) return; el.scrollLeft -= v; v *= 0.95; raf = requestAnimationFrame(run); };
      raf = requestAnimationFrame(run);
    });
    addEventListener('mousemove', (e) => { if (down) { v = e.pageX - px; px = e.pageX; t = performance.now(); el.scrollLeft = sl - (e.pageX - x); e.preventDefault(); } });
  });
}

/* ---------- cookie ---------- */
function initCookie() {
  const ck = $('#ck');
  if (!ck) return;
  const KEY = 'dviga_ck';
  if (safe(() => localStorage.getItem(KEY))) return;
  requestAnimationFrame(() => ck.classList.add('on'));
  $$('[data-ck-ok]', ck).forEach((b) => b.addEventListener('click', () => { ck.classList.remove('on'); safe(() => localStorage.setItem(KEY, '1')); }));
}

/* ---------- попапы ---------- */
function initPopups() {
  const hooks = {};
  $$('[data-hook]').forEach((el) => { hooks[el.dataset.hook] = el; });
  let cur = null; let opener = null;
  const lock = (on) => d.body.classList.toggle('pl', on);
  const loadForms = () => import('./forms.js').then((m) => m.init()).catch(() => {});
  const close = (pp, immediate) => {
    if (!pp) return;
    pp.classList.remove('on');
    const ms = immediate ? 0 : (pp.classList.contains('blk') ? 500 : 300);
    setTimeout(() => { if (!pp.classList.contains('on')) pp.classList.remove('sh'); }, ms);
    if (cur === pp) { cur = null; if (!pp.classList.contains('blk')) lock(false); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  };
  const open = (pp, from) => {
    if (cur && cur !== pp) close(cur, true);
    cur = pp; opener = from;
    pp.classList.add('sh');
    setTimeout(() => { pp.classList.add('on'); pp.focus({ preventScroll: true }); }, 50);
    if (!pp.classList.contains('blk')) lock(true);
    loadForms();
    if (pp.classList.contains('sr')) { const i = $('input[type=search]', pp); if (i) setTimeout(() => i.focus(), 80); }
  };
  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a) {
      const h = a.getAttribute('href').slice(1);
      if (h === 'closepopup' || h === 'closeallpopup') { e.preventDefault(); close(cur); return; }
      if (hooks[h]) { e.preventDefault(); open(hooks[h], a); return; }
      const t = h && d.getElementById(h);
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); return; }
    }
    if (e.target.closest('[data-close]')) { close(cur); return; }
    if (cur && (e.target === cur || (cur.classList.contains('blk') && (e.target.classList.contains('pc') || e.target.classList.contains('r') || e.target.classList.contains('ab') || e.target.classList.contains('cr'))))) close(cur);
  });
  d.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (cur) close(cur); wgClose(); }
    if (e.key === 'Tab' && cur) {
      const f = $$('a[href],button:not([hidden]),input:not([type=hidden]),textarea,select,[tabindex="0"]', cur).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && (d.activeElement === first || d.activeElement === cur)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // открытие по хэшу в адресе
  const byHash = () => { const h = location.hash.slice(1); if (h && hooks[h]) open(hooks[h]); };
  addEventListener('hashchange', byHash); byHash();
  // виджет
  const wb = $('[data-wg]'); const wp = $('[data-wgp]');
  function wgClose() { if (wp) { wp.classList.remove('on'); } }
  if (wb && wp) {
    wb.addEventListener('click', () => { wp.classList.toggle('on'); if (wp.classList.contains('on')) loadForms(); });
    $('[data-wg-close]', wp).addEventListener('click', wgClose);
    d.addEventListener('click', (e) => { if (wp.classList.contains('on') && !e.target.closest('[data-wgp],[data-wg]')) wgClose(); });
  }
  // поиск: «site:» в запросе Яндекса
  const sf = $('.sr form');
  if (sf) sf.addEventListener('submit', (e) => { e.preventDefault(); const q = $('input[type=search]', sf).value.trim(); if (q) open_(`https://yandex.ru/search/?text=${encodeURIComponent(`site:dviga.marketing ${q}`)}`); });
  function open_(u) { w.open(u, '_blank', 'noopener'); }
}

/* ---------- отложенные модули ---------- */
function initLazy() {
  const sl = $('.sl');
  if (sl && 'IntersectionObserver' in w) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); import('./slider.js').then((m) => m.init(sl)); } }, { rootMargin: '600px 0px' });
    io.observe(sl);
  } else if (sl) import('./slider.js').then((m) => m.init(sl));
  $$('[data-share]').forEach((a) => { a.href = a.dataset.share + encodeURIComponent(location.href.split('#')[0]); });
  if ($('[data-tabs],.lm-b')) import('./tabs.js').then((m) => m.init());
  $$('[data-gl]').forEach((g) => import('./gallery.js').then((m) => m.init(g)));
  $$('[data-acc]').forEach((a) => import('./accordion.js').then((m) => m.init(a)));
  $$('[data-hs]').forEach((h) => import('./hero.js').then((m) => m.init(h)));
  $$('[data-quiz]').forEach((qz) => {
    const load = () => import('./quiz.js').then((m) => m.init(qz));
    if ('IntersectionObserver' in w) { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: '800px 0px' }); io.observe(qz); } else load();
  });
  const cs = $('[data-cases-root]');
  if (cs) import('./cases.js').then((m) => m.init(cs));
  const fm = $('.fm');
  if (fm && 'IntersectionObserver' in w) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); import('./forms.js').then((m) => m.init()); } }, { rootMargin: '400px 0px' });
    $$('.e[data-t=form]').forEach((f) => io.observe(f));
  }
}

// Инициализация делится на две части: лёгкая (обработчики, без чтения геометрии) — сразу,
// тяжёлая (замеры, наблюдатели) — после первого кадра, чтобы не удлинять первую раскладку.
const afterPaint = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));
// стили свёрнутых записей (вкладки блога) подгружаются в простое после загрузки страницы — не мешают первому экрану
const loadDeferredCss = () => { $$('link[data-defer]').forEach((l) => { l.onload = () => dispatchEvent(new Event('cssload')); l.media = 'all'; l.removeAttribute('data-defer'); }); };
addEventListener('load', () => (self.requestIdleCallback || setTimeout)(loadDeferredCss, { timeout: 5000 }));
const boot = () => {
  [initCookie, initPopups, saveUtm].forEach((f) => safe(f));
  // картинки внутри скрытых попапов (display:none) не грузятся сами — подтягиваем в простое, чтобы при открытии они уже были
  addEventListener('load', () => (self.requestIdleCallback || setTimeout)(() => $$('.pp img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }), { timeout: 3000 }));
  // сначала то, что влияет на первый экран (фоны, появление), затем — тяжёлые обработчики по этапам, чтобы IntersectionObserver успел сработать
  afterPaint(() => { [initBg, initAppear].forEach((f) => safe(f)); afterPaint(() => { safe(initSteps); afterPaint(() => { [initScroll, initCounter, initVideo, initEmbeds, initFaq, initSlider, initShare, initDrag, initLazy].forEach((f) => safe(f)); }); }); });
};
if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
