// Вкладки (T395) и «Загрузить еще» (T400): показ/скрытие записей страницы по их id — как в Tilda, но без jQuery.
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const rec = (id) => document.getElementById(`r${id}`);
const ids = (s) => (s || '').split(',').filter(Boolean);

// пользователь начал листать вкладки — стили свёрнутых записей нужны сразу
const loadDeferredCss = () => $$('link[data-defer]').forEach((l) => { l.media = 'all'; l.removeAttribute('data-defer'); });

export function init() {
  let ready = false;
  const hiddenByMore = new Set();
  $$('.lm-b').forEach((b) => ids(b.dataset.more).forEach((i) => hiddenByMore.add(i)));
  const allMore = new Set(hiddenByMore); // все записи под кнопками «Загрузить еще» (в т.ч. не привязанные к вкладкам)
  const tabs = $$('[data-tabs]');
  const apply = () => {
    const inTab = new Set();
    const active = new Set();
    tabs.forEach((tb) => {
      $$('.tb-t', tb).forEach((t) => ids(t.dataset.ids).forEach((i) => { inTab.add(i); if (t.classList.contains('on')) active.add(i); }));
    });
    inTab.forEach((i) => { const r = rec(i); if (r) r.classList.toggle('off', !active.has(i) || hiddenByMore.has(i)); });
    allMore.forEach((i) => { const r = rec(i); if (r && !inTab.has(i)) r.classList.toggle('off', hiddenByMore.has(i)); });
    if (ready) dispatchEvent(new Event('resize')); // анимации прокрутки перемеряют только показанные записи
  };
  tabs.forEach((tb) => {
    $$('.tb-t', tb).forEach((t) => {
      t.addEventListener('click', () => {
        loadDeferredCss();
        $$('.tb-t', tb).forEach((x) => { x.classList.toggle('on', x === t); x.querySelector('.tb-b').setAttribute('aria-selected', x === t); });
        apply();
        const n = $$('.tb-t', tb).indexOf(t) + 1;
        try { history.replaceState('', '', `${location.pathname}#!/tab/${tb.closest('.r').id.slice(1)}-${n}`); } catch { /* file:// */ }
      });
    });
  });
  $$('.lm-b').forEach((b) => {
    const label = b.textContent;
    b.addEventListener('click', () => {
      loadDeferredCss();
      if (b.dataset.state === 'open') { ids(b.dataset.more).forEach((i) => hiddenByMore.add(i)); b.dataset.state = ''; b.textContent = label; apply(); b.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      ids(b.dataset.more).forEach((i) => hiddenByMore.delete(i));
      apply();
      if (b.dataset.back) { b.dataset.state = 'open'; b.textContent = b.dataset.back; } else b.closest('.r').classList.add('off');
      dispatchEvent(new Event('resize'));
    });
  });
  // адрес вида #!/tab/<запись>-<номер> открывает нужную вкладку
  const m = /#!\/tab\/(\d+)-(\d+)/.exec(location.hash);
  if (m) { const tb = document.querySelector(`#r${m[1]} [data-tabs]`); const t = tb && $$('.tb-t', tb)[+m[2] - 1]; if (t) { $$('.tb-t', tb).forEach((x) => x.classList.toggle('on', x === t)); } }
  apply();
  ready = true;
}
