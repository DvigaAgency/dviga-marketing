// База знаний AI-помощника (/ai): один файл assets/ai.<хэш>.json, который страница скачивает при первом касании. Всё берётся из снимков страниц копии —
// помощник отвечает только тем, что написано на сайте:
//   d — документы (страницы услуг, кейсы, статьи, прочее): [адрес, заголовок, вид (s|c|b|p), описание, текст, сектор(ы) для кейсов]
//   f — «вопрос — ответ» из аккордеонов FAQ страниц услуг и статей и из «Частых вопросов» Annexx: [вопрос, ответ, адрес страницы]
//   t — прайс Tilda-сайтов со страницы /services/sozdanie-sajtov-na-tilda (проверяется по тексту страницы при сборке)
//   c — контакты (проверяются по тексту подвала)
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import { pageText } from './search-index.mjs';

const clean = (s) => String(s || '').replace(/ /g, ' ').replace(/(?:https?:\/\/)?[\w.-]*tilda\.(?:ws|cc)\S*/gi, '').replace(/\s+/g, ' ').trim(); // адреса тестовых доменов Tilda в базу не попадают
const kindOf = (p) => (/^\/services\/./.test(p) ? 's' : /^\/cases\/./.test(p) ? 'c' : /^\/blog\/./.test(p) ? 'b' : 'p');
const MAX = { s: 3200, c: 2200, b: 2000, p: 2500 };

// сектор кейса по названию и описанию: несколько ярлыков через пробел
const SECTORS = [
  ['realty', /жк\b|жило|застройщ|квартал|недвижим|коттедж|поселок|посёлок|девелопер|апартамент/i],
  ['logistics', /логист|порт\b|порта|перевоз|грузо|судоремонт/i],
  ['fmcg', /газиров|напитк|колбас|продукт|эко-|акци|fmcg|упаковк|дистрибьютор/i],
  ['production', /производ|завод|кабел|цемент|промышлен|строительн/i],
  ['retail', /сеть|магазин|интернет-магазин/i],
  ['services', /консалтинг|бухгалтер|ии-бот|туристич|ресторан|путешеств|агентств/i],
];
const WORKS = [
  ['site', /сайт|лендинг|интернет-магазин|промо/i],
  ['brand', /бренд|логотип|фирменн|упаковк|айдентик/i],
  ['naming', /нейминг/i],
  ['ads', /реклам|акци|лидогенерац|контекст/i],
  ['ui', /интерфейс|калькулятор|личный кабинет|терминал/i],
];

// окна вокруг упоминаний цены/срока в полном тексте страницы услуги (в индексе text обрезан, а цена бывает внизу страницы)
const PRICE_RE = /[^.!?]{0,110}от\s*\d[\d\s ]*\s*(?:₽|руб[а-я]*)[^.!?]{0,80}/gi;
const TIME_RE = /[^.!?]{0,100}(?:от\s*|до\s*|в среднем\s*)?\d+(?:[,.]\d)?(?:\s*[–−-]\s*\d+)?\s*(?:рабочих\s+)?(?:дн[а-я]*|недел[а-я]*|месяц[а-я]*)[^.!?]{0,70}/gi;
const GOOD_TIME = /занимает|срок|разработк|создани|внедрен|запуск|готов|в течение/i; const BAD_TIME = /окупаем|гаранти|исправл|опыт|лет /i;
function windows(text, re, n, ok) {
  const out = []; const seen = new Set(); const t = text.replace(/([а-яё])([А-ЯЁ])/g, '$1. $2');
  for (const m of t.matchAll(re)) { const w = m[0].replace(/^[^А-ЯЁA-Z0-9«"]*/, '').replace(/\s+/g, ' ').trim(); const key = (w.match(/\d[\d\s ]*/) || [w])[0].replace(/\s/g, ''); if (w.length < 25 || seen.has(key) || (ok && !ok(w))) continue; seen.add(key); out.push(w); if (out.length >= n) break; }
  return out;
}

function faqFrom($, slugPath, annexx) {
  const out = [];
  for (const p of ['t668', 't849']) {
    $(`.${p}__accordion`).each((i, a) => {
      const q = clean($(a).find(`.${p}__title, .${p}__trigger-button span`).first().text());
      const ans = clean($(a).find(`.${p}__text, .${p}__content`).first().text());
      if (q && ans && /\?$|^(как|что|зачем|почему|сколько|можно|какие|какой|кто|есть|нужно|входит|работаете|делаете)/i.test(q)) out.push([q, ans, slugPath]);
    });
  }
  const txt = (id) => { const r = $(`#rec${id}`).clone(); r.find('style,script').remove(); return clean(r.text()); };
  for (const x of (annexx[slugPath] || {}).faq || []) { const q = txt(x.q); const a = txt(x.tab); if (q && a) out.push([q, a, slugPath]); }
  return out;
}

export function buildAiIndex(pages) {
  const annexx = fs.existsSync('data/annexx.json') ? JSON.parse(fs.readFileSync('data/annexx.json', 'utf8')) : {};
  const docs = []; const faq = []; const seen = new Set(); const texts = {};
  for (const p of pages) {
    if (p.kind === 'redirect' || !p.src || !fs.existsSync(p.src)) continue;
    if (p.tab !== undefined && p.path !== '/blog') continue;
    if (p.out || p.path === '/ai' || p.path === '/karta-saita') continue;
    const $ = cheerio.load(fs.readFileSync(p.src, 'utf8'), { decodeEntities: false });
    const title = clean($('title').first().text()).replace(/\s*[|–—]\s*(DVIGA|Dviga|dviga).*$/i, '').replace(/\. Кейс от агентства Dviga\.?$/i, '').replace(/:\s*(наш )?кейс( DVIGA)?$/i, '').replace(/,\s*кейс DVIGA$/i, '').replace(/\s*\|\s*Кейс.*$/i, '');
    const descr = clean($('meta[name=description]').attr('content'));
    const kind = kindOf(p.path);
    const slug = p.path.split('/').pop();
    const text = p.path === '/blog' ? '' : clean(pageText($, slug)).slice(0, MAX[kind]);
    const row = [p.path + '/', title, kind, descr, text];
    if (kind === 'c') {
      const hay = `${title} ${descr}`;
      row.push([...SECTORS, ...WORKS].filter(([, re]) => re.test(hay)).map(([k]) => k).join(' '));
    }
    const full = clean($('body').clone().find('style,script').remove().end().text());
    if (kind === 's') { row[5] = ''; row[6] = windows(full, PRICE_RE, 3); row[7] = windows(full, TIME_RE, 3, (w) => GOOD_TIME.test(w) && !BAD_TIME.test(w)); }
    docs.push(row);
    texts[p.path] = full;
    if (kind === 's' || kind === 'b') for (const f of faqFrom($, p.path, annexx)) { const k = f[0] + f[2]; if (!seen.has(k)) { seen.add(k); faq.push([f[0], f[1].slice(0, 900), p.path + '/']); } }
  }
  // прайс Tilda-сайтов (страница «Создание сайтов на Tilda»): каждая позиция сверяется с текстом страницы
  const src = '/services/sozdanie-sajtov-na-tilda';
  const tiers = [
    ['Экспресс-лендинг', '10 дней', '150 000 руб.', 'Одностраничный сайт в экспресс-формате (без правок). Идеальный вариант для быстрого запуска рекламы.'],
    ['Лендинг на Тильде', 'от 20 дней', 'от 250 000 руб.', 'Одностраничный сайт для рекламы услуги или товара. Идеально подходит для быстрого тестирования гипотез или старта бизнеса.'],
    ['Яркий промосайт', 'от 20 дней', 'от 400 000 руб.', 'Для запуска креативных спецпроектов и пиара бренда.'],
    ['Многостраничный сайт на Тильде', 'от 45 дней', 'от 450 000 руб.', 'Яркий корпоративный сайт компании для презентации услуг, проектов, команды и актуальных новостей.'],
    ['Интернет-магазин', 'от 45 дней', 'от 450 000 руб.', 'Для небольших бизнесов: если товаров мало, они популярные, нишевые, и вы хотите сделать крутой визуал.'],
  ];
  const base = texts[src] || '';
  for (const t of tiers) for (const piece of [t[0], t[2].replace(/\s/g, ' ')]) if (!base.replace(/\s/g, ' ').includes(piece.replace(/\s/g, ' '))) console.warn('AI-индекс: на странице', src, 'не найдено «' + piece + '»');
  const foot = texts['/ai'] || texts['/about'] || Object.values(texts)[0] || '';
  const contacts = { email: 'sales@dviga.marketing', phone: '8 800 200 23 02', tel: '+78002002302', address: 'Владивосток, Океанский проспект, д.135, офис 57', offices: 'Владивосток и Сингапур' };
  for (const piece of [contacts.email, contacts.phone, 'Океанский проспект, д.135, офис 57']) if (!foot.includes(piece)) console.warn('AI-индекс: в подвале не найдено «' + piece + '»');
  // проверенные фразы со страниц сайта (оплата, гарантия, сроки в договоре, скорость ответа): достаются из полного текста страницы, при отсутствии — предупреждение
  const GF = [
    ['pay', '/services/sozdanie-sajtov-na-tilda', /Обычно при создании сайта на Тильде мы делим оплату на 3 равные части\.[^.]*\.[^.]*\./],
    ['guarantee', '/services/korporativnyj-sajt-na-tilda', /Исправляем недоработки в течение 6 месяцев после сдачи проекта\.?\s*Но обычно исправления не требуются\./],
    ['contract', '/services/sozdaniye-i-razrabotka-saytov-vo-vladivostoke', /Фиксируем даты в договоре и придерживаемся их\.[^.]*\./],
    ['reply', '/services/korporativnyj-sajt-na-tilda', /Отвечаем в течение 60 минут в рабочее время\.\s*Отчитываемся по каждому этапу разработки сайта на Тильде[^.]*\./],
    ['about', '/services/sozdanie-sajtov-na-tilda', /Разработали более 200 сайтов[^.]*\.[^.]*\.[^.]*«Сайт дня» на CSSDA\./],
  ];
  const facts = [];
  for (const [tag, path, re] of GF) { const m = re.exec(texts[path] || ''); if (m) facts.push([tag, clean(m[0]).replace('проекта Но', 'проекта. Но'), path + '/']); else console.warn('AI-индекс: не найден факт «' + tag + '» на странице', path); }
  const json = JSON.stringify({ v: 1, d: docs, f: faq, t: { src: src + '/', rows: tiers }, c: contacts, g: facts });
  const name = `ai.${crypto.createHash('sha1').update(json).digest('hex').slice(0, 8)}.json`;
  return { name, json, docs: docs.length, faq: faq.length };
}
