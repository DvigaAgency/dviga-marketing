// Отправка заявки: POST на эндпоинт из <meta name="lead-url"> (по умолчанию /api/lead), UTM-метки, событие в Яндекс.Метрику.
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'];

// метки рекламы запоминаются на сессию: заявка уходит не обязательно с той страницы, куда пришёл посетитель
export function saveUtm() {
  try {
    const q = new URLSearchParams(location.search);
    UTM.forEach((k) => { if (q.get(k)) sessionStorage.setItem(k, q.get(k)); });
  } catch { /* sessionStorage недоступен */ }
}

function addUtm(body) {
  try { UTM.forEach((k) => { const v = sessionStorage.getItem(k); if (v) body.append(k, v); }); } catch { /* sessionStorage недоступен */ }
}

// как в оригинале (tilda-forms): виртуальный просмотр /tilda/<форма>/submitted/ в Метрике
function hit(form) {
  const id = window.mainMetrikaId;
  if (id && typeof window.ym === 'function') window.ym(id, 'hit', `/tilda/${form}/submitted/`, { title: `Send data from form ${form}` });
}

export async function sendLead(body, form) {
  addUtm(body);
  const meta = document.querySelector('meta[name="lead-url"]');
  const url = (meta && meta.content) || '/api/lead';
  let ok = false;
  try {
    const r = await fetch(url, { method: 'POST', body });
    ok = r.ok;
    if (!ok && DEV) console.info(`[lead] ${url} недоступен — dev-заглушка считает отправку успешной`);
  } catch { /* сеть недоступна */ }
  ok = ok || DEV;
  if (ok) hit(form);
  return ok;
}
