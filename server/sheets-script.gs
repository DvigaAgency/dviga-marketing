/**
 * Приём заявок с сайта в Google-таблицу «Лиды с сайта двига».
 * Google Apps Script, веб-приложение. Развёртывание — README, раздел «Заявки в Google-таблицу».
 *
 * Колонки ищутся по заголовкам первой строки (регистр не важен), порядок можно менять:
 *   дата | email | имя | телефон | источник | заявка пришла со страницы | utm-метка | форма | комментарий
 * Колонки «форма» и «комментарий» добавляются справа сами, если их нет.
 * В «комментарий» попадает всё, что не имеет своей колонки: поле «Комментарий», ответы квиза и калькулятора, имена файлов.
 */

// Читаемые названия форм (идентификатор формы → название). Неизвестный идентификатор пишется как есть.
var FORM_NAMES = {
  '1064388596_1703387323408': 'Попап «Получить консультацию»',
  '862071020_1699179852242': 'Блок «Рабочие инструменты под ваш бюджет»',
  'calc': 'Калькулятор «Рассчитайте стоимость сайта»',
  'widget': 'Виджет «Давайте подскажем»'
};

var COLUMNS = {
  date: 'дата',
  email: 'email',
  name: 'имя',
  phone: 'телефон',
  source: 'источник',
  page: 'заявка пришла со страницы',
  utm: 'utm-метка',
  form: 'форма',
  comment: 'комментарий'
};

var SERVICE = { form: 1, page: 1, checkbox: 1, referrer: 1, files: 1, yclid: 1,
  utm_source: 1, utm_medium: 1, utm_campaign: 1, utm_content: 1, utm_term: 1 };

function first_(params, key) {
  var v = params[key];
  return v && v.length ? String(v[0]).trim() : '';
}

// «Яндекс (органика)», «Google (органика)», «Переход с <сайт>», «Прямой заход»
function organic_(referrer) {
  var host = String(referrer || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  if (!host) return 'Прямой заход';
  if (/(^|\.)(yandex|ya)\.[a-z]+$/.test(host)) return 'Яндекс (органика)';
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'Google (органика)';
  if (/(^|\.)bing\.com$/.test(host)) return 'Bing (органика)';
  return 'Переход с ' + host;
}

/** Параметры запроса (e.parameters) → { date, email, name, phone, source, page, utm, form, comment } или null, если нет контакта */
function buildLead_(params, now) {
  var lead = { date: now, email: '', name: '', phone: '', source: '', page: '', utm: '', form: '', comment: '' };
  var extra = [];
  Object.keys(params).forEach(function (key) {
    var k = key.trim().toLowerCase();
    var vals = params[key].map(function (x) { return String(x).replace(/\r\n/g, '\n').trim(); }).filter(String);
    if (!vals.length || SERVICE[k]) return;
    var v = vals.join(', ').slice(0, 4000);
    if (k === 'name') lead.name = v;
    else if (k === 'phone') lead.phone = v;
    else if (k === 'email') lead.email = v;
    else if (k === 'comment' || k === 'textarea') extra.unshift(v);
    else extra.push(key.trim() + ': ' + v);
  });
  if (lead.phone.replace(/\D/g, '').length < 10) lead.phone = '';   // «+7» без цифр — не телефон
  if (!lead.phone && !lead.email) return null;

  var src = first_(params, 'utm_source'), medium = first_(params, 'utm_medium');
  if (src) lead.source = medium ? src + ' / ' + medium : src;
  else if (first_(params, 'yclid')) lead.source = 'Яндекс Директ';
  else lead.source = organic_(first_(params, 'referrer'));

  lead.utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid']
    .map(function (u) { var v = first_(params, u); return v ? u + '=' + v : ''; }).filter(String).join('; ');

  var form = first_(params, 'form');
  lead.form = FORM_NAMES[form] || form;
  lead.page = first_(params, 'page');
  var files = first_(params, 'files');
  if (files) extra.push('Файлы: ' + files + ' (в таблицу не передаются)');
  lead.comment = extra.join('\n');
  return lead;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// номера колонок по заголовкам; недостающие «форма» и «комментарий» дописываются справа
function columns_(sheet) {
  var width = Math.max(sheet.getLastColumn(), 1);
  var head = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var map = {};
  Object.keys(COLUMNS).forEach(function (key) {
    var i = head.indexOf(COLUMNS[key]);
    if (i < 0 && (key === 'form' || key === 'comment')) {
      var col = head.length + 1;
      sheet.getRange(1, col).setValue(COLUMNS[key]);
      head.push(COLUMNS[key]);
      i = col - 1;
    }
    if (i >= 0) map[key] = i + 1;
  });
  return { map: map, width: head.length };
}

function append_(sheet, lead) {
  var c = columns_(sheet);
  var row = [];
  for (var i = 0; i < c.width; i++) row.push('');
  Object.keys(c.map).forEach(function (key) { row[c.map[key] - 1] = lead[key]; });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var r = sheet.getLastRow() + 1;
    var range = sheet.getRange(r, 1, 1, c.width);
    range.setNumberFormat('@');                                  // всё — текстом: «+7…» и «=…» не превращаются в формулы
    if (c.map.date) sheet.getRange(r, c.map.date).setNumberFormat('dd.MM.yyyy HH:mm:ss');
    range.setValues([row]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}

function doPost(e) {
  try {
    var lead = buildLead_((e && e.parameters) || {}, new Date());
    if (!lead) return json_({ ok: false, error: 'phone or email required' });
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    append_(sheet, lead);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// открытие адреса в браузере — проверка, что развёртывание работает
function doGet() { return json_({ ok: true, service: 'dviga-leads' }); }

// пробная заявка: запустить из редактора (кнопка «Выполнить»), чтобы проверить права и таблицу
function testLead() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  append_(sheet, buildLead_({ Name: ['Тест'], Phone: ['+79990000000'], Email: ['test@example.com'], comment: ['Пробная заявка, можно удалить'],
    form: ['widget'], page: ['https://dviga.marketing/'], utm_source: ['yandex'], utm_medium: ['cpc'] }, new Date()));
}
