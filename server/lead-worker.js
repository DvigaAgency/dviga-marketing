// Приём заявок с форм сайта и создание лида в Битрикс24 (аналог интеграции «Битрикс24» в Tilda: dvigamarketing.bitrix24.ru).
// Cloudflare Worker, без зависимостей. Развёртывание и переменные — README, раздел «Заявки в Битрикс24».
//
// Переменные окружения воркера:
//   BITRIX_WEBHOOK_URL  входящий вебхук Битрикс24 с правом crm: https://dvigamarketing.bitrix24.ru/rest/<id>/<токен>/  (секрет, не хранить в репозитории)
//   ALLOWED_ORIGINS     адреса сайтов через запятую, с которых принимаются заявки (например https://dvigaagency.github.io,https://dviga.marketing); * — любые
//   RESPONSIBLE_ID      (необязательно) ID ответственного за лид
//
// Формат запроса — multipart/form-data, поля форм сайта (Name, Phone, Email, comment, Textarea, ответы квиза …),
// служебные form, page и utm_*/yclid (src/js/lead.js).

const UTM = { utm_source: 'UTM_SOURCE', utm_medium: 'UTM_MEDIUM', utm_campaign: 'UTM_CAMPAIGN', utm_content: 'UTM_CONTENT', utm_term: 'UTM_TERM' };
const SERVICE = new Set(['form', 'page', 'checkbox', 'yclid', ...Object.keys(UTM)]);
const MAX_FIELD = 4000;

const cors = (env, request) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': allowed.includes('*') ? '*' : origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } : null;
};

const json = (status, data, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const clean = (v) => String(v).replace(/\r\n/g, '\n').trim().slice(0, MAX_FIELD);

// поля формы -> поля лида Битрикс24
export function toLead(formData, env = {}) {
  const f = { NAME: '', PHONE: '', EMAIL: '' };
  const extra = [];
  const files = [];
  let form = ''; let page = '';
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') { if (value && value.name) files.push(value.name); continue; }
    const v = clean(value);
    const k = key.trim().toLowerCase();
    if (k === 'form') form = v;
    else if (k === 'page') page = v;
    else if (UTM[k]) { if (v) f[UTM[k]] = v; }
    else if (!v || SERVICE.has(k)) continue;
    else if (k === 'name') f.NAME = v;
    else if (k === 'phone') f.PHONE = v;
    else if (k === 'email') f.EMAIL = v;
    else if (k === 'comment' || k === 'textarea') extra.push(['Комментарий', v]);
    else extra.push([key.trim(), v]);
  }
  if (!f.PHONE && !f.EMAIL) return null;
  const comments = [...extra.map(([k, v]) => `${k}: ${v}`), files.length ? `Файлы (не переданы): ${files.join(', ')}` : '', page ? `Страница: ${page}` : '', form ? `Форма: ${form}` : ''].filter(Boolean).join('\n');
  const fields = {
    TITLE: `Заявка с сайта DVIGA${form ? ` (${form})` : ''}`,
    NAME: f.NAME || 'Без имени',
    COMMENTS: comments,
    SOURCE_ID: 'WEB',
    SOURCE_DESCRIPTION: page,
    OPENED: 'Y',
  };
  if (f.PHONE) fields.PHONE = [{ VALUE: f.PHONE, VALUE_TYPE: 'WORK' }];
  if (f.EMAIL) fields.EMAIL = [{ VALUE: f.EMAIL, VALUE_TYPE: 'WORK' }];
  for (const u of Object.values(UTM)) if (f[u]) fields[u] = f[u];
  if (env.RESPONSIBLE_ID) fields.ASSIGNED_BY_ID = env.RESPONSIBLE_ID;
  return fields;
}

export default {
  async fetch(request, env) {
    const headers = cors(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: headers ? 204 : 403, headers: headers || {} });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method' }, headers || {});
    if (!headers) return json(403, { ok: false, error: 'origin' });
    if (!env.BITRIX_WEBHOOK_URL) return json(500, { ok: false, error: 'not configured' }, headers);

    let fd;
    try { fd = await request.formData(); } catch { return json(400, { ok: false, error: 'body' }, headers); }
    const fields = toLead(fd, env);
    if (!fields) return json(422, { ok: false, error: 'phone or email required' }, headers);

    const url = `${env.BITRIX_WEBHOOK_URL.replace(/\/?$/, '/')}crm.lead.add.json`;
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields, params: { REGISTER_SONET_EVENT: 'N' } }) });
    } catch { return json(502, { ok: false, error: 'bitrix unreachable' }, headers); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.result) return json(502, { ok: false, error: 'bitrix', detail: data.error || res.status }, headers);
    return json(200, { ok: true, id: data.result }, headers);
  },
};
