// Отправка заявки: POST на эндпоинт из <meta name="lead-url"> (по умолчанию /api/lead), UTM-метки, источник перехода, событие в Яндекс.Метрику.
// Эндпоинт — Cloudflare Worker (server/lead-worker.js, Битрикс24) или Google Apps Script (server/sheets-script.gs, Google-таблица).
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

// Apps Script не разбирает multipart: отправляем urlencoded, файлы заменяем списком имён (поле files)
function toUrlEncoded(body) {
  const p = new URLSearchParams();
  const files = [];
  for (const [k, v] of body.entries()) {
    if (typeof v === 'string') p.append(k, v);
    else if (v && v.name && v.size) files.push(v.name);
  }
  if (files.length) p.append('files', files.join(', '));
  return p;
}

export async function sendLead(body, form) {
  addUtm(body);
  const meta = document.querySelector('meta[name="lead-url"]');
  const url = (meta && meta.content) || '/api/lead';
  let ok = false;
  try {
    const gas = /^https:\/\/script\.google\.com\//.test(url);
    const r = await fetch(url, { method: 'POST', body: gas ? toUrlEncoded(body) : body });
    // Apps Script всегда отвечает 200, результат — в JSON ({ok:true|false})
    ok = r.ok && (gas ? !!(await r.json().catch(() => ({}))).ok : true);
    if (!ok && DEV) console.info(`[lead] ${url} недоступен — dev-заглушка считает отправку успешной`);
  } catch { /* сеть недоступна */ }
  ok = ok || DEV;
  if (ok) hit(form);
  return ok;
}
