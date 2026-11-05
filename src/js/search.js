// Внутренний поиск по сайту (иконка лупы в меню). Работает как на оригинале: строка, счётчик «N результатов по запросу: …», список
// «заголовок-ссылка + фрагмент текста с выделенными словами», выдача по 10 с кнопкой «Показать ещё».
// Индекс страниц (assets/search.<хэш>.json: [адрес, заголовок, описание, текст]) скачивается один раз при первом открытии поиска и ищется прямо в браузере —
// без серверов и внешних сервисов; слова ищутся по началу слова с обрезкой окончания («сайт» находит «сайта», «сайтов»).
const PAGE = 10;
const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plural = (n, f) => (n % 10 === 1 && n % 100 !== 11 ? f[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? f[1] : f[2]);
// основа слова запроса: для длинных слов отбрасываем окончание
const stem = (t) => (t.length >= 7 ? t.slice(0, -2) : t.length >= 5 ? t.slice(0, -1) : t);

export function init(root) {
  if (root._srInit) return;
  root._srInit = true;
  const input = root.querySelector('input[type=search]');
  const clear = root.querySelector('.sr-cl');
  const box = root.querySelector('.sr-b');
  const count = root.querySelector('.sr-n');
  const list = root.querySelector('.sr-l');
  const more = root.querySelector('.sr-m');
  const form = root.querySelector('form');
  const base = (root.dataset.index || '').replace(/\/assets\/[^/]*$/, '');
  let docs = null; let loading = null;
  let results = []; let shown = 0; let words = []; let query = '';

  const load = () => {
    if (docs) return Promise.resolve(docs);
    if (!loading) {
      loading = fetch(root.dataset.index).then((r) => r.json()).then((j) => {
        docs = j.d.map((d) => ({ path: d[0], title: d[1], descr: d[2], text: d[3], nt: norm(d[1]), nd: norm(d[2]), nx: norm(d[3]) }));
        return docs;
      }).catch(() => { loading = null; docs = []; return docs; });
    }
    return loading;
  };

  const wordRe = (w) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${w.map(esc).join('|')})[\\p{L}\\p{N}]*`, 'giu');
  const countIn = (h, w) => { let n = 0; for (let i = h.indexOf(w); i >= 0 && n < 50; i = h.indexOf(w, i + w.length)) { if (i === 0 || !/[\p{L}\p{N}]/u.test(h[i - 1])) n++; } return n; };

  const search = (q) => {
    words = norm(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(stem);
    if (!words.length || !docs) return [];
    const out = [];
    for (const d of docs) {
      let score = 0; let ok = true;
      for (const w of words) {
        const t = countIn(d.nt, w); const de = countIn(d.nd, w); const x = countIn(d.nx, w);
        if (!t && !de && !x) { ok = false; break; }
        score += t * 40 + (d.nt.startsWith(w) ? 20 : 0) + de * 12 + Math.min(x, 12);
      }
      if (ok) out.push({ d, score });
    }
    return out.sort((a, b) => b.score - a.score).map((x) => x.d);
  };

  // фрагмент вокруг первого найденного слова; найденные слова выделяются жирным
  const snippet = (d) => {
    const re = wordRe(words);
    // сначала описание страницы (если в нём есть искомое слово) — оно короткое и осмысленное; иначе — фрагмент основного текста
    const inDescr = d.descr && words.some((w) => countIn(d.nd, w));
    const hay = inDescr ? d.descr : (d.text || d.descr || d.title);
    const nh = norm(hay);
    let at = -1; for (const w of words) { const m = new RegExp(`(?<![\\p{L}\\p{N}])${esc(w)}`, 'iu').exec(nh); if (m && (at < 0 || m.index < at)) at = m.index; }
    let from = Math.max(0, at - 70); if (from > 0) { const sp = hay.indexOf(' ', from); if (sp >= 0 && sp < at) from = sp + 1; }
    let to = Math.min(hay.length, from + 170); if (to < hay.length) { const sp = hay.lastIndexOf(' ', to); if (sp > from + 80) to = sp; }
    const frag = hay.slice(from, to).trim();
    const el = document.createElement('span'); el.className = 'sr-s';
    if (from > 0) el.append('… ');
    let last = 0; re.lastIndex = 0;
    for (let m = re.exec(frag); m; m = re.exec(frag)) { el.append(frag.slice(last, m.index)); const b = document.createElement('b'); b.textContent = m[0]; el.append(b); last = m.index + m[0].length; if (!m[0]) re.lastIndex++; }
    el.append(frag.slice(last));
    if (to < hay.length) el.append(' …');
    return el;
  };

  const renderMore = () => {
    results.slice(shown, shown + PAGE).forEach((d) => {
      const li = document.createElement('li'); const a = document.createElement('a'); a.href = base + d.path;
      const t = document.createElement('span'); t.className = 'sr-t'; t.textContent = d.title || d.path; a.append(t, snippet(d)); li.append(a); list.append(li);
    });
    shown = Math.min(results.length, shown + PAGE);
    more.hidden = shown >= results.length;
  };

  const run = () => {
    query = input.value.trim();
    clear.hidden = !input.value;
    root.classList.toggle('q', !!query);
    box.hidden = !query;
    if (!query) { list.textContent = ''; count.textContent = ''; more.hidden = true; return; }
    load().then(() => {
      if (input.value.trim() !== query) return; // пока грузился индекс, запрос изменился
      results = search(query); shown = 0; list.textContent = ''; box.scrollTop = 0;
      count.textContent = results.length ? `${results.length} ${plural(results.length, ['результат', 'результата', 'результатов'])} по запросу: ${query}` : `Ничего не найдено по запросу: ${query}`;
      renderMore();
    });
  };

  let timer = 0;
  input.addEventListener('input', () => { clearTimeout(timer); clear.hidden = !input.value; timer = setTimeout(run, 120); });
  input.addEventListener('focus', () => { load(); }, { once: true });
  form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); run(); });
  clear.addEventListener('click', () => { input.value = ''; run(); input.focus(); });
  more.addEventListener('click', renderMore);
  // переход по результату закрывает поиск (на странице без перезагрузки — якорь — иначе поиск остался бы открытым)
  list.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a && a.pathname === location.pathname) root.querySelector('[data-close]').click(); });
  load();
}
