/**
 * Уведомление в Телеграм и лид в Битрикс24 для заявок с сайта. Отдельный файл проекта Apps Script (рядом с sheets-script.gs).
 * Ключи хранятся только в свойствах скрипта (Настройки проекта → Свойства скрипта), в коде и на сайте их нет:
 *   TG_TOKEN          токен бота @dviga_leads_website_bot
 *   TG_CHAT_ID        ID группы с заявками (с минусом)
 *   B24_WEBHOOK       входящий вебхук Битрикс24 (https://dvigamarketing.bitrix24.ru/rest/<id>/<токен>/, со слешем в конце)
 *   B24_PORTAL        dvigamarketing.bitrix24.ru
 *   B24_ASSIGNED_ID   ID ответственного за лид (необязательно)
 * Если свойств нет, соответствующий шаг пропускается, остальные работают.
 */
var PROPS_ = function () { return PropertiesService.getScriptProperties(); };

// ---------- Телеграм ----------
function tg_(method, body) {
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + PROPS_().getProperty('TG_TOKEN') + '/' + method, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body)
  });
  var res = JSON.parse(r.getContentText());
  if (!res.ok) console.error('TG ' + method, res.error_code, res.description);
  return res;
}

function esc_(s) {
  return String(s || '').replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; });
}

// Текст в формате уведомлений Tilda: «Содержание заявки» и «Дополнительная информация», пустые поля не выводятся
function leadText_(d, footer) {
  var line = function (label, v) { return v ? label + ': ' + esc_(v) : null; };
  var info = function (label, v) { return v ? '<i>' + label + ': ' + esc_(v) + '</i>' : null; };
  return [
    '<b>Заявка с сайта dviga.marketing</b>',
    '<b>Содержание заявки:</b>',
    line('Имя', d.name),
    line('Телефон', d.phone),
    line('Email', d.email),
    line('Комментарий', d.comment),
    '',
    '<b>Дополнительная информация:</b>',
    info('Форма', d.form),
    info('Источник', d.source),
    d.page ? esc_(d.page) : null,
    info('UTM source', d.utm_source),
    info('UTM medium', d.utm_medium),
    info('UTM campaign', d.utm_campaign),
    info('UTM content', d.utm_content),
    info('UTM term', d.utm_term),
    footer ? '' : null,
    footer || null
  ].filter(function (v) { return v !== null; }).join('\n');
}

// Отправить заявку в группу. Возвращает message_id или null.
function notifyTelegram_(d, footer) {
  if (!PROPS_().getProperty('TG_TOKEN') || !PROPS_().getProperty('TG_CHAT_ID')) return null;
  try {
    var res = tg_('sendMessage', { chat_id: PROPS_().getProperty('TG_CHAT_ID'), text: leadText_(d, footer), parse_mode: 'HTML', disable_web_page_preview: true });
    return res.ok ? res.result.message_id : null;
  } catch (e) { console.error('TG send', e); return null; }
}

// Дописать в сообщение ссылку на лид (или предупреждение, если leadId пуст)
function updateTelegramWithLead_(d, messageId, leadId) {
  if (!messageId) return;
  var footer = leadId
    ? '<a href="https://' + PROPS_().getProperty('B24_PORTAL') + '/crm/lead/details/' + leadId + '/">Лид #' + leadId + ' в Битрикс24</a>'
    : 'В Битрикс не записалось, завести вручную';
  try {
    tg_('editMessageText', { chat_id: PROPS_().getProperty('TG_CHAT_ID'), message_id: messageId, text: leadText_(d, footer), parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (e) { console.error('TG edit', e); }
}

// ---------- Битрикс24 ----------
// Поля как у интеграции Tilda, чтобы отчёты и автоматизации не менялись. Возвращает ID лида или null.
function createB24Lead_(d) {
  try {
    var host = String(d.page || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '') || 'dviga.marketing';
    var fields = {
      TITLE: 'Заявка с формы: ' + (d.form || '') + ' отправлена с [' + host + ']',
      NAME: d.name,
      PHONE: d.phone ? [{ VALUE: d.phone, VALUE_TYPE: 'WORK' }] : [],
      EMAIL: d.email ? [{ VALUE: d.email, VALUE_TYPE: 'WORK' }] : [],
      SOURCE_ID: 'RC_GENERATOR',
      STATUS_ID: 'NEW',
      SOURCE_DESCRIPTION: d.page,
      COMMENTS: d.comment,
      UF_CRM_FORMNAME: d.form,
      UTM_SOURCE: d.utm_source,
      UTM_MEDIUM: d.utm_medium,
      UTM_CAMPAIGN: d.utm_campaign,
      UTM_CONTENT: d.utm_content,
      UTM_TERM: d.utm_term
    };
    var assigned = PROPS_().getProperty('B24_ASSIGNED_ID');
    if (assigned) fields.ASSIGNED_BY_ID = Number(assigned);
    var r = UrlFetchApp.fetch(PROPS_().getProperty('B24_WEBHOOK') + 'crm.lead.add.json', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ fields: fields, params: { REGISTER_SONET_EVENT: 'Y' } })
    });
    var res = JSON.parse(r.getContentText());
    if (!res.result) console.error('B24', res.error, res.error_description);
    return res.result || null;
  } catch (e) { console.error('B24', e); return null; }
}

// ---------- Источник по домену перехода ----------
// домен -> utm_source канала в сквозной аналитике Битрикс24
var REF_TO_UTM = {
  'yandex.ru': 'yandex', 'ya.ru': 'yandex',
  'google.ru': 'google', 'google.com': 'google', 'google.sg': 'google',
  'instagram.com': 'instagram', 'facebook.com': 'facebook', 'youtube.com': 'youtube',
  'claude.ai': 'claude.ai', 'chat.openai.com': 'chatgpt.com', 'chatgpt.com': 'chatgpt.com', 'perplexity.ai': 'perplexity.ai',
  'farpost.ru': 'farpost', 'vc.ru': 'vc.ru', 'workspace.ru': 'workspace', 'spark.ru': 'spark',
  'ratingruneta.ru': 'ratingruneta', 'marketing-tech.ru': 'marketing-tech',
  'sostav.ru': 'sostav', 'adpass.ru': 'adpass', 'rusability.ru': 'rusability',
  'awwwards.com': 'awww', 'designrush.com': 'designrush', 'cssdesignawards.com': 'cssdesign',
  'behance.net': 'behance', 'dprofile.ru': 'dprofile', 'crunchbase.com': 'crunchbase',
  'trustpilot.com': 'trustpilot', 'wadline.ru': 'wadline',
  'goodfirms.co': 'goodfirms', 'experts.tilda.cc': 'tilda-experts', 'upwork.com': 'upwork',
  'netology.ru': 'netology', 'galera-residents.ru': 'galera', 'vl.ru': 'vl.ru', 'beeline.ru': 'beeline'
};

// Нет utm_source — подставить по домену перехода (d.referrer — только домен)
function resolveUtm_(d) {
  if (d.utm_source) return;
  var host = String(d.referrer || '').toLowerCase().replace(/^www\./, '');
  if (!host) return;
  for (var dom in REF_TO_UTM) {
    if (host === dom || host.slice(-dom.length - 1) === '.' + dom) {
      d.utm_source = REF_TO_UTM[dom];
      d.utm_medium = d.utm_medium || 'referral';
      return;
    }
  }
}

// Проверка из редактора: пробное сообщение в группу, лид с пометкой теста — затем удалить сообщение и лид
function testNotify() {
  var d = { name: 'Тест', phone: '+79990000000', email: 'test@example.com', comment: 'Проверка из редактора, можно удалить', form: 'Тест',
    source: 'тест', page: 'https://dvigaagency.github.io/dviga-marketing/', referrer: 'workspace.ru' };
  resolveUtm_(d);
  var msgId = notifyTelegram_(d, 'Создаётся лид в Битриксе…');
  var leadId = PROPS_().getProperty('B24_WEBHOOK') ? createB24Lead_(d) : null;
  updateTelegramWithLead_(d, msgId, leadId);
  Logger.log('Телеграм: ' + (msgId ? 'отправлено' : 'не отправлено') + '; Битрикс: ' + (leadId ? 'лид #' + leadId : 'лид не создан'));
}
