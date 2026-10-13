// Ядро поведения страницы: анимации появления, пошаговые анимации, прокрутка, попапы, cookie, видео.
// Без зависимостей. Тяжёлые куски (слайдер, формы) подгружаются динамически.
const d = document;
const w = window;
const $ = (s, r = d) => r.querySelector(s);
const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
const num = (v, f = 0) => (v == null || v === '' || Number.isNaN(+v) ? f : +v);
const RES = [320, 480, 640, 960, 1200];
const resIdx = () => { let r = 0; RES.forEach((v, i) => { if (innerWidth >= v) r = i; }); return r; };
const zoomOf = (el) => num(getComputedStyle(el).zoom, 1) || 1;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const safe = (f) => { try { return f(); } catch { return null; } };

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
    const o = JSON.parse(el.dataset.sc);
    if (mobile && !o.m) return;
    let steps = o.s;
    if (ri < RES.length - 1) {
      for (let i = ri; i < RES.length - 1 && steps === o.s; i++) { const k = RES[i]; if (o.r[k]) { steps = o.r[k]; break; } }
      if (!steps) return;
    }
    sc.push({ el, w: el.querySelector('.sw') || el, steps, t: o.t, o: o.o });
  });
  $$('.e[data-fx]').forEach((el) => {
    const dist = num(el.dataset.fx);
    if (!dist || (mobile && !el.dataset.mb)) return;
    const arr = (el.dataset.fo || '').split(',');
    fx.push({ el, dist, ofst: num(arr[ri] ?? arr[arr.length - 1]) });
  });
  if (!sc.length && !fx.length) return;
  const pageTop = (el) => {
    const tr = el.style.transform; el.style.transform = 'none';
    const sw = el.querySelector('.sw');
    const pt = sw ? sw.style.transform : ''; if (sw) sw.style.transform = 'none';
    const y = el.getBoundingClientRect().top + scrollY;
    el.style.transform = tr; if (sw) sw.style.transform = pt;
    return y;
  };
  const measure = () => {
    const vh = innerHeight;
    sc.forEach((s) => {
      const z = zoomOf(s.el); s.z = z;
      s.top = pageTop(s.el);
      let to = s.o * z;
      if (s.t === 0.5 || s.t === 1) { to += vh * s.t; if (to > s.top && to <= vh * s.t) to = s.top; }
      s.to = to;
      let un = 0; let prev = s.top;
      s.st = s.steps.map((st) => { const dist = st.d * z; const r = { ...st, dist, start: prev, end: prev + dist, un }; prev += dist; if (!st.f) un += dist; return r; });
    });
    fx.forEach((f) => { f.z = zoomOf(f.el); f.top = pageTop(f.el); f.end = f.top + f.dist * f.z; });
  };
  const frame = () => {
    const y = scrollY;
    sc.forEach((s) => {
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
      const tf = `${n.x ? `translateX(${n.x.toFixed(2)}px)` : ''}${ty ? `translateY(${ty.toFixed(2)}px)` : ''}${n.sx !== 1 || n.sy !== 1 ? `scale(${n.sx},${n.sy})` : ''}${n.r ? `rotate(${n.r}deg)` : ''}`;
      s.w.style.transform = tf || 'scale(1)';
      s.w.style.opacity = n.o;
      if (n.fix !== s.fixed) { s.fixed = n.fix; s.w.style.willChange = n.fix ? 'transform' : ''; }
    });
    fx.forEach((f) => {
      const r = y + f.ofst * f.z;
      let ty = 0;
      if (r >= f.end) ty = f.dist;
      else if (r >= f.top) ty = (r - f.top) / f.z;
      if (ty !== f.ty) { f.ty = ty; f.el.style.transform = ty ? `translateY(${ty.toFixed(2)}px)` : ''; }
    });
  };
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
  const remeasure = () => { measure(); frame(); };
  measure(); frame();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { clearTimeout(remeasure.t); remeasure.t = setTimeout(remeasure, 150); });
  addEventListener('load', remeasure);
  addEventListener('cssload', remeasure);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(remeasure);
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

/* ---------- видео ---------- */
function initVideo() {
  const vs = $$('video[data-src]');
  if (!vs.length) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src) { v.src = v.dataset.src; v.load(); }
      if (!reduce) v.play().catch(() => {});
    } else v.pause();
  }), { rootMargin: '200px 0px' });
  vs.forEach((v) => io.observe(v));
}

/* ---------- горизонтальный drag-скролл (лента наград) ---------- */
function initDrag() {
  $$('.dg').forEach((el) => {
    let x = 0; let sl = 0; let down = false;
    el.addEventListener('mousedown', (e) => { down = true; x = e.pageX; sl = el.scrollLeft; el.classList.add('gr'); });
    addEventListener('mouseup', () => { down = false; el.classList.remove('gr'); });
    addEventListener('mousemove', (e) => { if (down) { el.scrollLeft = sl - (e.pageX - x); e.preventDefault(); } });
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
  const fm = $('.fm');
  if (fm && 'IntersectionObserver' in w) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); import('./forms.js').then((m) => m.init()); } }, { rootMargin: '400px 0px' });
    $$('.e[data-t=form]').forEach((f) => io.observe(f));
  }
}

const boot = () => {
  initAppear(); initSteps(); initScroll(); initCounter(); initVideo(); initDrag(); initCookie(); initPopups(); initLazy();
};
if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
