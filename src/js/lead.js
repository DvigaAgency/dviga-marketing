// Отправка заявки: POST на эндпоинт из <meta name="lead-url"> (по умолчанию /api/lead), UTM-метки, источник перехода, событие в Яндекс.Метрику.
// Эндпоинт — Cloudflare Worker (server/lead-worker.js, Битрикс24) или Google Apps Script (server/sheets-script.gs: Google-таблица + файлы на Яндекс.Диск).
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'];

// метки рекламы и внешний источник перехода запоминаются на сессию: заявка уходит не обязательно с той страницы, куда пришёл посетитель
export function saveUtm() {
  try {
    const q = new URLSearchParams(location.search);
    UTM.forEach((k) => { if (q.get(k)) sessionStorage.setItem(k, q.get(k)); });
    if (!sessionStorage.getItem('referrer') && document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host && host !== location.hostname) sessionStorage.setItem('referrer', document.referrer);
    }
  } catch { /* sessionStorage недоступен */ }
}

function addUtm(body) {
  try {
    [...UTM, 'referrer'].forEach((k) => { const v = sessionStorage.getItem(k); if (v) body.append(k, v); });
  } catch { /* sessionStorage недоступен */ }
}

// как в оригинале (tilda-forms): виртуальный просмотр /tilda/<форма>/submitted/ в Метрике
function hit(form) {
  const id = window.mainMetrikaId;
  if (id && typeof window.ym === 'function') window.ym(id, 'hit', `/tilda/${form}/submitted/`, { title: `Send data from form ${form}` });
}

const pad = (n) => String(n).padStart(2, '0');

// Apps Script: файлы идут на Яндекс.Диск по одноразовому адресу, который выдаёт скрипт (токен остаётся в скрипте).
// Возвращает имена загруженных и не загрузившихся файлов; заявка уходит в любом случае.
async function uploadFiles(url, body) {
  const files = [...body.values()].filter((v) => typeof v !== 'string' && v && v.name && v.size);
  const out = { folder: '', done: [], failed: [] };
  if (!files.length) return out;
  const d = new Date();
  const who = String(body.get('Name') || '').trim();
  out.folder = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())} ${who}`.trim();
  for (const f of files) {
    try {
      const q = new URLSearchParams({ action: 'upload', folder: out.folder, name: f.name });
      const r = await (await fetch(`${url}?${q}`)).json();
      if (!r.ok) throw new Error(r.error);
      const put = await fetch(r.href, { method: 'PUT', body: f });
      if (!put.ok) throw new Error(`HTTP ${put.status}`);
      out.done.push(f.name);
    } catch { out.failed.push(f.name); }
  }
  return out;
}

// Apps Script не разбирает multipart: отправляем urlencoded, вместо файлов — их имена и папка на Диске
function toUrlEncoded(body, up) {
  const p = new URLSearchParams();
  for (const [k, v] of body.entries()) if (typeof v === 'string') p.append(k, v);
  if (up.done.length) { p.append('files', up.done.join(', ')); p.append('folder', up.folder); }
  if (up.failed.length) p.append('files_failed', up.failed.join(', '));
  return p;
}

export async function sendLead(body, form) {
  addUtm(body);
  const meta = document.querySelector('meta[name="lead-url"]');
  const url = (meta && meta.content) || '/api/lead';
  let ok = false;
  try {
    const gas = /^https:\/\/script\.google\.com\//.test(url);
    const payload = gas ? toUrlEncoded(body, await uploadFiles(url, body)) : body;
    const r = await fetch(url, { method: 'POST', body: payload });
    // Apps Script всегда отвечает 200, результат — в JSON ({ok:true|false})
    ok = r.ok && (gas ? !!(await r.json().catch(() => ({}))).ok : true);
    if (!ok && DEV) console.info(`[lead] ${url} недоступен — dev-заглушка считает отправку успешной`);
  } catch { /* сеть недоступна */ }
  ok = ok || DEV;
  if (ok) hit(form);
  return ok;
}
