// Вкладки (T395) и «Загрузить еще» (T400): показ/скрытие записей страницы по их id — как в Tilda, но без jQuery.
// Вкладки блога — ссылки на собственные адреса (/blog/sajty/ …): адрес меняется через History API, при заходе по адресу нужная вкладка открыта уже в разметке.
// Скрытые записи (неактивные вкладки, «Загрузить еще») помечены hidden="until-found": поиск по странице (Ctrl+F) находит в них текст и раскрывает нужную вкладку/группу.
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const rec = (id) => document.getElementById(`r${id}`);
const ids = (s) => (s || '').split(',').filter(Boolean);

// стили свёрнутых записей (app.<хэш>.d.css) грузятся в простое после загрузки страницы; перед показом таких записей дожидаемся их загрузки,
// иначе карточки на миг (а при возврате на вкладку по адресу — надолго) остаются без оформления
const cssReady = () => new Promise((resolve) => {
  const links = $$('link[href*=".d.css"]');
  links.forEach((l) => { l.media = 'all'; l.removeAttribute('data-defer'); });
  const pending = links.filter((l) => !l.sheet);
  if (!pending.length) { resolve(); return; }
  let n = pending.length;
  const done = () => { if (--n <= 0) resolve(); };
  pending.forEach((l) => { l.addEventListener('load', done, { once: true }); l.addEventListener('error', done, { once: true }); });
  setTimeout(resolve, 4000);
});

// запись скрыта: класс off (состояние) + hidden="until-found" (находится поиском по странице); у кнопки «Загрузить еще» — обычный hidden
const setOff = (r, off, plain) => {
  r.classList.toggle('off', off);
  if (!off) r.removeAttribute('hidden'); else if (plain || r.classList.contains('lm-r')) r.setAttribute('hidden', ''); else r.setAttribute('hidden', 'until-found');
};

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
    inTab.forEach((i) => { const r = rec(i); if (r) setOff(r, !active.has(i) || hiddenByMore.has(i)); });
    allMore.forEach((i) => { const r = rec(i); if (r && !inTab.has(i)) setOff(r, hiddenByMore.has(i)); });
    if (ready) dispatchEvent(new Event('resize')); // анимации прокрутки перемеряют только показанные записи
  };
  const activate = (tb, t) => {
    $$('.tb-t', tb).forEach((x) => { x.classList.toggle('on', x === t); x.querySelector('.tb-b').setAttribute('aria-selected', x === t); });
    apply();
  };
  const hrefOf = (t) => { const a = t.querySelector('a.tb-b'); return a ? a.getAttribute('href') : null; };
  const samePath = (a, b) => a.replace(/[/]+$/, '') === b.replace(/[/]+$/, '');
  tabs.forEach((tb) => {
    $$('.tb-t', tb).forEach((t) => {
      t.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return; // «открыть в новой вкладке» работает как у обычной ссылки
        e.preventDefault();
        if (t.classList.contains('on')) return;
        cssReady().then(() => {
          activate(tb, t);
          const h = hrefOf(t);
          if (h) { try { history.pushState({ tab: true }, '', h); } catch { /* file:// */ } }
        });
      });
    });
    // кнопки «назад/вперёд» браузера: вкладка по адресу
    addEventListener('popstate', () => {
      const t = $$('.tb-t', tb).find((x) => { const h = hrefOf(x); return h && samePath(new URL(h, location.href).pathname, location.pathname); });
      if (t && !t.classList.contains('on')) cssReady().then(() => activate(tb, t));
    });
  });
  $$('.lm-b').forEach((b) => {
    const label = b.textContent;
    b.addEventListener('click', () => {
      cssReady().then(() => {
        if (b.dataset.state === 'open') { ids(b.dataset.more).forEach((i) => hiddenByMore.add(i)); b.dataset.state = ''; b.textContent = label; apply(); b.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        ids(b.dataset.more).forEach((i) => hiddenByMore.delete(i));
        apply();
        if (b.dataset.back) { b.dataset.state = 'open'; b.textContent = b.dataset.back; } else setOff(b.closest('.r'), true, true);
        dispatchEvent(new Event('resize'));
      });
    });
  });
  // поиск по странице: стили скрытых записей нужны до того, как найденная запись раскроется — подгружаем их, как только нажато Ctrl/Cmd+F
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А')) cssReady(); }, { once: true });
  // Ctrl+F нашёл текст в скрытой (until-found) записи: открываем вкладку и группу «Загрузить еще», в которых она лежит
  document.addEventListener('beforematch', (e) => {
    const r = e.target.closest ? e.target.closest('section.r') : null;
    if (!r || !r.classList.contains('off')) return;
    const id = r.id.slice(1);
    tabs.forEach((tb) => {
      const t = $$('.tb-t', tb).find((x) => ids(x.dataset.ids).includes(id));
      if (t && !t.classList.contains('on')) {
        $$('.tb-t', tb).forEach((x) => { x.classList.toggle('on', x === t); x.querySelector('.tb-b').setAttribute('aria-selected', x === t); });
        const h = hrefOf(t);
        if (h) { try { history.replaceState({ tab: true }, '', h); } catch { /* file:// */ } }
      }
    });
    $$('.lm-b').forEach((b) => {
      if (!ids(b.dataset.more).includes(id)) return;
      ids(b.dataset.more).forEach((i) => hiddenByMore.delete(i));
      if (b.dataset.back) { b.dataset.state = 'open'; b.textContent = b.dataset.back; } else setOff(b.closest('.r'), true, true);
    });
    r.removeAttribute('hidden');
    apply();
  });
  // старые адреса вида #!/tab/<запись>-<номер> (из закладок и ссылок оригинала): открываем вкладку и заменяем адрес на ЧПУ
  const m = /#!\/tab\/(\d+)-(\d+)/.exec(location.hash);
  if (m) {
    const tb = document.querySelector(`#r${m[1]} [data-tabs]`); const t = tb && $$('.tb-t', tb)[+m[2] - 1];
    if (t) {
      const h = hrefOf(t);
      cssReady().then(() => { activate(tb, t); if (h) { try { history.replaceState({ tab: true }, '', h); } catch { /* file:// */ } } });
    }
  }
  apply();
  ready = true;
}
