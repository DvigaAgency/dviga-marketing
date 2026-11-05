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

var SERVICE = { form: 1, page: 1, checkbox: 1, referrer: 1, files: 1, files_failed: 1, folder: 1, yclid: 1,
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
  var files = first_(params, 'files'), failed = first_(params, 'files_failed');
  if (files) extra.push('Файлы: ' + files);
  if (failed) extra.push('Не удалось загрузить файлы: ' + failed);
  lead.comment = extra.join('\n');
  lead.folder = files ? first_(params, 'folder') : '';   // папка на Яндекс.Диске, не колонка таблицы
  return lead;
}

// ---------- Яндекс.Диск ----------
// Токен приложения (право cloud_api:disk.app_folder) — свойство скрипта YANDEX_TOKEN. Файлы лежат в «Приложения/<приложение>/<папка заявки>/».
var DISK = 'https://cloud-api.yandex.net/v1/disk/resources';
var BLOCKED_EXT = /\.(exe|bat|cmd|com|scr|msi|js|jse|vbs|ps1|jar|apk|sh|dll|lnk)$/i;

function token_() { return PropertiesService.getScriptProperties().getProperty('YANDEX_TOKEN'); }

function safeName_(s, max) {
  return String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, max);
}

function disk_(method, url) {
  return UrlFetchApp.fetch(url, { method: method, headers: { Authorization: 'OAuth ' + token_() }, muteHttpExceptions: true });
}

/** Подготовка загрузки одного файла: создаёт папку заявки и возвращает адрес, на который браузер отправляет файл методом PUT */
function prepareUpload_(p) {
  if (!token_()) return { ok: false, error: 'YANDEX_TOKEN not set' };
  var folder = safeName_(p.folder, 80) || 'без имени';
  var name = safeName_(p.name, 120);
  if (!name || BLOCKED_EXT.test(name)) return { ok: false, error: 'file type not allowed' };
  var dir = 'app:/' + folder;
  var mk = disk_('put', DISK + '?path=' + encodeURIComponent(dir)).getResponseCode();
  if (mk !== 201 && mk !== 409) return { ok: false, error: 'folder ' + mk };   // 409 — папка уже есть (второй файл той же заявки)
  var r = disk_('get', DISK + '/upload?overwrite=true&path=' + encodeURIComponent(dir + '/' + name));
  var j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200 || !j.href) return { ok: false, error: 'upload ' + r.getResponseCode() };
  return { ok: true, href: j.href };
}

/** Ссылка на папку заявки в веб-интерфейсе Яндекс.Диска (откроется у владельца диска) */
function folderUrl_(folder) {
  var r = disk_('get', DISK + '?fields=path&path=' + encodeURIComponent('app:/' + safeName_(folder, 80)));
  if (r.getResponseCode() !== 200) return '';
  var path = String(JSON.parse(r.getContentText()).path || '').replace(/^disk:\//, '');
  return path ? 'https://disk.yandex.ru/client/disk/' + path.split('/').map(encodeURIComponent).join('/') : '';
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
    if (lead.folder && token_()) {
      try {
        var url = folderUrl_(lead.folder);
        if (url) lead.comment += '\nЯндекс.Диск: ' + url;
      } catch (err) { /* заявка важнее ссылки на папку */ }
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    append_(sheet, lead);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ?action=upload&folder=…&name=… — адрес для загрузки файла на Яндекс.Диск; без параметров — проверка, что развёртывание работает
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'upload') {
    try { return json_(prepareUpload_(p)); } catch (err) { return json_({ ok: false, error: String(err) }); }
  }
  return json_({ ok: true, service: 'dviga-leads' });
}

// проверка Яндекс.Диска: запустить из редактора — выдать права на внешние запросы, в «Приложения/…/Проверка» появится файл test.txt
function testDisk() {
  var r = prepareUpload_({ folder: 'Проверка', name: 'test.txt' });
  if (!r.ok) throw new Error(JSON.stringify(r));
  var put = UrlFetchApp.fetch(r.href, { method: 'put', payload: 'Проверка загрузки с сайта DVIGA', contentType: 'text/plain', muteHttpExceptions: true });
  Logger.log('Загрузка: HTTP ' + put.getResponseCode() + ' (201/202 — успешно). Папка: ' + folderUrl_('Проверка'));
}

// пробная заявка: запустить из редактора (кнопка «Выполнить»), чтобы проверить права и таблицу
function testLead() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  append_(sheet, buildLead_({ Name: ['Тест'], Phone: ['+79990000000'], Email: ['test@example.com'], comment: ['Пробная заявка, можно удалить'],
    form: ['widget'], page: ['https://dviga.marketing/'], utm_source: ['yandex'], utm_medium: ['cpc'] }, new Date()));
}
