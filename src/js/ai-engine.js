// Движок AI-помощника DVIGA (/ai): отвечает только тем, что написано на сайте. Без серверов и внешних сервисов — работает в браузере по базе знаний
// assets/ai.<хэш>.json (tools/lib/ai-index.mjs: страницы услуг, кейсы, статьи, вопросы-ответы FAQ, прайс, контакты, проверенные фразы со страниц).
// Как устроен ответ: 1) понимаем намерение (цена, сроки, кейсы, статьи, услуги, контакты, оплата, гарантии, «умеете ли вы …») и тему (услуга, отрасль);
// 2) ищем по базе (BM25 по основам слов с синонимами); 3) собираем ответ: готовый ответ из FAQ или данные страницы услуги, карточки страниц-источников и
// подсказки «что спросить дальше». Диалог помнит тему («а сроки?» — про ту же услугу). Файл без DOM — его же проверяют в Node (tools/ai-test.mjs).

const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');
const R = (src) => new RegExp('(?<![а-яa-z0-9])(?:' + src + ')'); // начало слова: \b для кириллицы не работает
const STOP = new Set(('и в во не на с со как что это а но или для по из у к о об от до за при же ли бы то так все вы вам вас мы нас ваш ваша ваше ваши наш наша ' +
  'есть быть можно нужно какой какие какая какое каких какую где когда почему зачем сколько можете могу хочу хотим хотел хотела расскажите расскажи подскажите подскажи покажите ' +
  'покажи скажите скажи пожалуйста мне нам меня тебя вами компании компания dviga которые который которая этот эта эти там тут чем кто был была были будет будут ' +
  'ещё еще уже если чтобы также очень просто можешь могли хотите нужна нужен нужны надо делаете делаю сделайте сделать ли над под про без его её их').split(' '));
const END = /(ами|ями|ого|его|ому|ему|ыми|ими|ешь|ишь|ую|юю|ая|яя|ое|ее|ие|ые|ий|ый|ой|ом|ем|ах|ях|ов|ев|ей|ам|ям|ет|ут|ют|ит|ат|ят|ть|ся|а|я|о|е|и|ы|у|ю|ь|й)$/;
export const stem = (t) => { if (t.length <= 3) return t; let r = t.replace(END, ''); if (r.length > 4) r = r.replace(END, ''); return r.length >= 3 ? r : t; };
const tok = (s) => norm(s).match(/[a-zа-я0-9]+/g) || [];
const stems = (s) => tok(s).filter((t) => !STOP.has(t) && (t.length > 1 || /\d/.test(t))).map(stem);

// синонимы (по основам): запрос расширяется соседями группы с весом 0,45
const GROUPS = [
  ['сайт', 'веб', 'web', 'website', 'вебсайт'], ['тильд', 'tilda'], ['лендинг', 'landing', 'одностраничник', 'одностраничн'],
  ['стоимост', 'цен', 'прайс', 'расценк', 'бюджет', 'руб', 'стоит', 'стоить'], ['срок', 'врем', 'дн', 'недел', 'месяц', 'быстр', 'длит', 'занима'],
  ['кейс', 'проект', 'портфоли', 'работ', 'пример'], ['жк', 'жил', 'застройщик', 'девелопер', 'недвижим', 'квартал'],
  ['логотип', 'айдентик', 'фирменн', 'стил', 'бренд', 'брендинг'], ['нейминг', 'названи', 'наименован'],
  ['продвижени', 'seo', 'сео', 'реклам', 'трафик', 'контекст', 'таргет', 'лидогенерац'], ['битрикс', 'bitrix', 'битрикс24', 'crm', 'црм'],
  ['магазин', 'ecommerce', 'интернет-магазин', 'корзин'], ['исследован', 'аналитик', 'research'],
  ['связ', 'контакт', 'телефон', 'почт', 'email', 'mail', 'адрес', 'позвон', 'написа'], ['логист', 'перевоз', 'грузо'],
  ['гарант', 'договор', 'ответственност'], ['стать', 'блог', 'материал', 'пост', 'публикац'],
];
const SYN = new Map(); for (const g of GROUPS) for (const w of g) SYN.set(stem(w), g.map(stem));

const FACETS = {
  sector: {
    realty: R('жк|жило|застройщ|недвижим|квартал|девелопер|коттедж|поселок|посёлок|апартамент|новостро'),
    logistics: R('логист|порт|перевоз|грузо|судо|доставк'),
    fmcg: R('fmcg|напит|газиров|продукт|еда|еды|продовольств|колбас|пищев|упаков'),
    production: R('производ|завод|промышлен|кабел|цемент|строител|фабрик'),
    retail: R('магазин|сеть|сети|ритейл|розниц|торгов|кофе|кофеен|кафе|рестора|общепит'),
    services: R('консалтинг|бухгалтер|ии-|ии |бот(?![а-я])|туризм|туристич|путешеств'),
  },
  work: { site: R('сайт|лендинг|интернет-магазин|веб|промо'), brand: R('бренд|логотип|фирменн|упаков|айдентик'), naming: R('нейминг|названи'), ads: R('реклам|акци|лидогенерац|контекст|трафик|продвижен'), ui: R('интерфейс|калькулятор|кабинет|терминал') },
};
const SECTOR_NAME = { realty: 'недвижимости', logistics: 'логистики и портов', fmcg: 'FMCG и продуктов', production: 'производства', retail: 'ритейла и сетей', services: 'сферы услуг' };
const WORK_NAME = { site: 'по разработке сайтов', brand: 'по брендингу', naming: 'по неймингу', ads: 'по рекламе и продвижению', ui: 'по интерфейсам' };

const INTENT = [
  ['thanks', R('спасибо|благодар|круто|отлично|супер')],
  ['greet', /^(привет|здравствуй|добр(ый|ое|ого)|хай|hello|hi|салют)(\s|$|!|,|\.)/],
  ['contacts', R('контакт|связат|связь|позвонить|телефон|номер|почт|email|e-mail|адрес|где вы|где наход|офис|написать|как с вами|как до вас|whatsapp|телеграм|созвон')],
  ['price', R('сколько стоит|стоимост|цен[аыуе]|прайс|расценк|бюджет|во сколько|дорого|стоить|сколько будет|сколько надо|тариф|сколько денег|цены')],
  ['timeline', R('срок|как долго|сколько врем|за сколько (дн|недел|месяц)|как быстро|сколько (дн|недел|месяц)|длит|занимает|когда будет готов|быстро ли|успеете')],
  ['cases', R('кейс|портфолио|пример|ваши работы|проекты для|проекты по|что вы (делали|сделали)|работали с|кому делали|покажите (работы|проекты)|сделанн')],
  ['blog', R('стать[яиейю]|блог|почитать|материал|гайд|инструкц|публикац|пост(ы|ов)?(\\s|$)|полезн')],
  ['services', R('услуг|что (вы )?(делаете|умеете|предлагаете)|чем занимаетесь|направлени|чем (вы )?занимает|что можете|ваши (возможности|компетенции)')],
  ['process', R('как (вы )?(работаете|делаете|создаете|создаёте|разрабатываете)|этап|процесс|с чего начать|как (заказать|начать|оформить)|порядок работ|как проходит|как происходит|как мы будем|алгоритм')],
  ['pay', R('оплат|предоплат|как платить|рассрочк|счет|счёт|платеж|платёж')],
  ['guarantee', R('гарант|ответственност|после сдачи|правки|недоработк|поддержк|сопровожден')],
  ['about', R('кто вы|о компании|о dviga|о вас|команд|сколько (лет|человек)|опыт|награды|сайт дня|css ?da|почему (вы|dviga)|чем вы лучше|преимуществ')],
  ['partners', R('партнер|партнёр|сотрудничеств|для агентств|реферал')],
  ['capability', R('вы (делаете|разрабатываете|занимаетесь|умеете|создаёте|создаете|работаете с)|делаете ли вы|можете ли вы|есть ли у вас|умеете ли|работаете ли|занимаетесь ли|беретесь')],
  ['order', R('сделайте|сделаете|хочу (заказать|сайт|логотип|лендинг|магазин)|нужен (сайт|логотип|лендинг|магазин)|нужна (разработка|реклама)|заказать|хотим (сайт|заказать)|помогите (с|сделать)|надо сделать')],
  ['define', R('что такое|что значит|что это|зачем нужен|зачем нужна|для чего нужен|в чем разница|в чём разница')],
];

// тема -> страница услуги (slug); первая совпавшая; каждая позиция проверена по списку страниц
const TOPIC_RULES = [
  [R('нейминг.*жк|жк.*нейминг|название.*жк|жк.*назван'), 'nejming-zhk'],
  [R('нейминг|придумать (название|имя)|название для (компании|бренда|продукта)'), 'zakazat-nejming'],
  [R('платформ[аы]? бренда|брендплатформ|позиционирован'), 'brandplatform'],
  [R('key ?visual|кей ?визуал|ключев(ой|ого) визуал'), 'key-visual'],
  [R('(логотип|фирменн|айдентик|стил).*жк|жк.*(логотип|фирменн|айдентик)'), 'razrabotka-logotipa-i-firmennogo-stilya-dlya-zhilogo-kompleksa'],
  [R('логотип|фирменн|айдентик|стиль'), 'razrabotka-logotipa-i-firmennogo-stilya'],
  [R('интернет-магазин|интернет магазин|онлайн-магазин|магазин'), 'razrabotka-internet-magazina'],
  [R('лендинг|одностраничн|landing'), 'zakazat-lending-na-tilda'],
  [R('корпоративн.*(тильд|tilda)|(тильд|tilda).*корпоративн'), 'korporativnyj-sajt-na-tilda'],
  [R('корпоративн'), 'korporativnyj-sajt'],
  [R('сайт.*(жк|жилого комплекса|застройщик)|(жк|жилого комплекса|застройщик).*сайт'), 'razrabotka-sajta-zhilogo-kompleksa'],
  [R('битрикс|bitrix|crm|црм'), 'bitrix24_crm'],
  [R('(продвижен|seo|сео|реклам|трафик|таргет|контекст).*(жк|жилого|застройщик)|(жк|жилого|застройщик).*(продвижен|реклам)'), 'prodvizhenie-sajta-zhilogo-kompleksa'],
  [R('продвижен|seo|сео|реклам|трафик|таргет|контекст'), 'paid-traffic'],
  [R('исследован|аналитик'), 'research'],
  [R('сайт.*(владивосток)|владивосток.*сайт'), 'sozdaniye-i-razrabotka-saytov-vo-vladivostoke'],
  [R('тильд|tilda'), 'sozdanie-sajtov-na-tilda'],
];
// тема -> фильтры кейсов
const TOPIC_CASES = { 'nejming-zhk': { sector: ['realty'], work: ['naming'] }, 'zakazat-nejming': { work: ['naming'] }, 'razrabotka-logotipa-i-firmennogo-stilya': { work: ['brand'] },
  'razrabotka-logotipa-i-firmennogo-stilya-dlya-zhilogo-kompleksa': { sector: ['realty'], work: ['brand'] }, 'brandplatform': { work: ['brand'] },
  'razrabotka-internet-magazina': { sector: ['retail'], work: ['site'] }, 'zakazat-lending-na-tilda': { work: ['site'] }, 'razrabotka-sajta-zhilogo-kompleksa': { sector: ['realty'], work: ['site'] },
  'prodvizhenie-sajta-zhilogo-kompleksa': { sector: ['realty'], work: ['ads'] }, 'paid-traffic': { work: ['ads'] }, 'korporativnyj-sajt': { work: ['site'] }, 'korporativnyj-sajt-na-tilda': { work: ['site'] }, 'sozdanie-sajtov-na-tilda': { work: ['site'] } };

// слова-намерения (цена, срок, кейс, контакт, блог, гарантия): не считаются «предметом» вопроса
const INTENT_WORDS = new Set([3, 4, 5, 13, 15, 16].flatMap((g) => GROUPS[g].map(stem)).concat(['оплат', 'предоплат', 'как', 'проход', 'работ', 'услуг', 'предлага', 'направлен', 'умеет', 'возможност', 'делает', 'сделат'].map(stem)));
const kindName = { s: 'Услуга', c: 'Кейс', b: 'Статья', p: 'Страница' };

/* ----------------------------- индекс ----------------------------- */
function indexCollection(items, fieldsOf) {
  const rows = items.map((it) => { const tf = new Map(); let len = 0; let tt = null; for (const [text, w] of fieldsOf(it)) { const st = stems(text); if (!tt) tt = new Set(st); for (const s of st) { tf.set(s, (tf.get(s) || 0) + w); len += w; } } return { it, tf, len, tt }; });
  const df = new Map(); for (const r of rows) for (const s of r.tf.keys()) df.set(s, (df.get(s) || 0) + 1);
  return { rows, df, avg: rows.reduce((a, r) => a + r.len, 0) / (rows.length || 1), n: rows.length };
}
const idf = (c, s) => { const d = c.df.get(s) || 0; return Math.log(1 + (c.n - d + 0.5) / (d + 0.5)); };
/** BM25; terms — [{s, w}]. cov — доля от максимума (если бы нашлись все термы запроса), hits — сколько основных (w=1) термов найдено */
function rank(c, terms, filter) {
  const k1 = 1.3; const b = 0.7; const out = []; let best = 0; let maxS = null; let maxI = -1; let np = 0;
  for (const t of terms) if (t.w === 1) { const i = idf(c, t.s); best += i * (k1 + 1); np++; if (i > maxI) { maxI = i; maxS = t.s; } }
  for (const r of c.rows) {
    if (filter && !filter(r.it)) continue;
    let sc = 0; let psc = 0; let hits = 0;
    for (const t of terms) {
      const f = r.tf.get(t.s); if (!f) continue; if (t.w === 1) hits++;
      let v = idf(c, t.s) * t.w * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * r.len) / c.avg)));
      if (t.w === 1 && r.tt && r.tt.has(t.s)) v += idf(c, t.s) * 1.2;
      sc += v; if (t.w === 1) psc += v;
    }
    if (sc > 0) out.push({ it: r.it, score: sc, cov: best ? Math.min(1, psc / best) : 0, hits, ratio: np ? hits / np : 0, key: maxS !== null && r.tf.has(maxS) });
  }
  return out.sort((a, b2) => b2.score - a.score);
}
const queryTerms = (q) => { const base = stems(q); const seen = new Map(); for (const s of base) seen.set(s, 1); for (const s of base) for (const n of SYN.get(s) || []) if (!seen.has(n)) seen.set(n, 0.45); return [...seen].map(([s, w]) => ({ s, w })); };

/* ----------------------------- вспомогательное ----------------------------- */
const short = (s, n = 170) => { s = String(s || '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return s; const cut = s.slice(0, n); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' ')); return cut.slice(0, i > 60 ? i : n).replace(/[,;:\s-]+$/, '') + '…'; };
// окна вокруг упоминаний цены/срока в тексте страницы: «…от 350 000 рублей за полный набор…»
const GOOD_TIME = /занимает|срок|разработк|создани|внедрен|запуск|готов|в течение/i; const BAD_TIME = /окупаем|гаранти|исправл|опыт|лет /i;
const windows = (text, re, n = 3, ok) => {
  const out = []; const seen = new Set(); const t = text.replace(/([а-яё])([А-ЯЁ])/g, '$1. $2');
  for (const m of t.matchAll(re)) { const w = m[0].replace(/^[^А-ЯЁA-Z0-9«"]*/, '').replace(/\s+/g, ' ').trim(); const key = (w.match(/\d[\d\s ]*/) || [w])[0].replace(/\s/g, ''); if (w.length < 25 || seen.has(key) || (ok && !ok(w))) continue; seen.add(key); out.push(w); if (out.length >= n) break; }
  return out;
};
const PRICE_RE = /[^.!?]{0,110}от\s*\d[\d\s ]*\s*(?:₽|руб[а-я]*)[^.!?]{0,80}/gi;
const TIME_RE = /[^.!?]{0,100}(?:от\s*|до\s*|в среднем\s*)?\d+(?:[,.]\d)?(?:\s*[–−-]\s*\d+)?\s*(?:рабочих\s+)?(?:дн[а-я]*|недел[а-я]*|месяц[а-я]*)[^.!?]{0,70}/gi;

/* ----------------------------- помощник ----------------------------- */
export function createAssistant(data) {
  const docs = data.d.map((r) => ({ u: r[0], t: r[1], k: r[2], d: r[3], x: r[4], f: r[5] || '', pr: r[6] || null, tm: r[7] || null }));
  const faq = data.f.map((r) => ({ q: r[0], a: r[1], u: r[2] }));
  const fact = Object.fromEntries((data.g || []).map((g) => [g[0], g]));
  const byUrl = new Map(docs.map((d) => [d.u, d]));
  const docIdx = indexCollection(docs, (d) => [[d.t, 4], [d.d, 2], [d.x, 1]]);
  const faqIdx = indexCollection(faq, (f) => [[f.q, 4], [f.a, 1]]);
  const cases = docs.filter((d) => d.k === 'c');
  const articles = docs.filter((d) => d.k === 'b');
  const C = data.c;
  const ctx = { topic: null };
  const service = (slug) => byUrl.get('/services/' + slug + '/');
  const card = (d) => ({ t: d.t, d: short(d.d || d.x, 150), u: d.u, k: kindName[d.k] });
  const uniq = (list) => { const seen = new Set(); return list.filter((c) => { const k = norm(c.t); if (seen.has(k)) return false; seen.add(k); return true; }); };
  const faqOf = (doc, re) => faq.find((f) => f.u === doc.u && re.test(norm(f.q)));
  const intents = (nq) => INTENT.filter(([, re]) => re.test(nq)).map(([k]) => k);
  const topicOf = (nq) => { for (const [re, slug] of TOPIC_RULES) if (re.test(nq)) { const d = service(slug); if (d) return d; } return null; };

  const CHIPS = {
    price: ['Какие сроки разработки?', 'Покажите кейсы по сайтам', 'Как проходит оплата?'],
    timeline: ['Сколько это стоит?', 'Как проходит работа над сайтом?', 'Покажите кейсы по сайтам'],
    cases: ['Сколько стоит сайт на Тильде?', 'Какие услуги предлагает компания?', 'Как связаться с командой?'],
    blog: ['Покажите кейсы по сайтам', 'Сколько стоит сайт на Тильде?', 'Как связаться с командой?'],
    services: ['Сколько стоит сайт на Тильде?', 'Какие сроки разработки сайта?', 'Покажите кейсы по сайтам'],
    contacts: ['Какие услуги предлагает компания?', 'Сколько стоит сайт на Тильде?', 'Покажите кейсы по сайтам'],
    process: ['Сколько стоит сайт на Тильде?', 'Какие сроки разработки сайта?', 'Какие гарантии вы даёте?'],
    faq: ['Сколько это стоит?', 'Какие сроки?', 'Покажите кейсы по теме'],
    about: ['Какие услуги предлагает компания?', 'Покажите кейсы по сайтам', 'Как связаться с командой?'],
    service: ['Сколько это стоит?', 'Какие сроки?', 'Покажите кейсы по теме'],
    none: ['Какие услуги предлагает компания?', 'Сколько стоит сайт на Тильде?', 'Покажите кейсы по сайтам', 'Как связаться с командой?'],
  };
  const chips = (k, extra = []) => [...extra, ...(CHIPS[k] || [])].slice(0, 4);
  const cta = 'Обсудить проект';

  function pickCases(f, q, n = 5) {
    const has = (d, arr) => !arr || !arr.length || arr.some((a) => d.f.split(' ').includes(a));
    let pool = cases.filter((d) => has(d, f.sector) && has(d, f.work)); let exact = true;
    if (!pool.length && f.sector) { pool = cases.filter((d) => has(d, f.sector)); exact = false; }
    if (!pool.length) { pool = cases; exact = false; }
    const set = new Set(pool); const ranked = rank(docIdx, queryTerms(q), (d) => set.has(d)).map((x) => x.it);
    for (const d of pool) if (!ranked.includes(d)) ranked.push(d);
    return { list: ranked.slice(0, n), exact };
  }

  const answerContacts = () => ({ kind: 'contacts', text: ['Свяжитесь с командой DVIGA любым удобным способом — мы отвечаем в течение 60 минут в рабочее время.'],
    contacts: [['Телефон', C.phone, 'tel:' + C.tel], ['Email', C.email, 'mailto:' + C.email], ['Адрес', C.address, ''], ['Офисы', C.offices, '']], cta, chips: chips('contacts') });

  function answerPrice(q, nq, topic) {
    const out = { kind: 'price', text: [], cta };
    if (topic && topic.u === data.t.src) topic = null; // страница с прайсом сайтов на Тильде: показываем таблицу
    if (topic) {
      const f = faqOf(topic, /стоим|сколько стоит|цен/);
      const lines = (topic.pr || windows(topic.x, PRICE_RE, 3));
      out.cards = [card(topic)];
      if (f) { out.title = f.q; out.text.push(short(f.a, 640)); if (lines.length > 1 && !/\d/.test(f.a)) out.bullets = lines; }
      else if (lines.length) { out.text.push(`Ориентиры по теме «${short(topic.t, 70)}» — так написано на странице услуги:`); out.bullets = lines; }
      else { out.text.push(`Точной цены для «${short(topic.t, 70)}» на странице не указано — она зависит от объёма работ. Посчитаем после короткого созвона на 30 минут.`); }
      out.chips = chips('price'); return out;
    }
    out.text.push('Стоимость зависит от задачи. Ориентиры для сайтов на Тильде — со страницы нашей услуги:');
    out.table = data.t.rows; out.cards = [byUrl.get(data.t.src)].filter(Boolean).map(card);
    out.text.push('Точную цену назовём после короткого созвона на 30 минут: посоветуем рабочие инструменты под ваш бюджет и посчитаем сроки. Цены на логотип, нейминг, продвижение — спросите отдельно.');
    out.chips = ['Сколько стоит логотип?', 'Сколько стоит нейминг для ЖК?', 'Сколько стоит продвижение?', ...CHIPS.price].slice(0, 4); return out;
  }
  function answerTimeline(q, nq, topic) {
    const out = { kind: 'timeline', text: [], cta };
    if (topic) {
      const f = faqOf(topic, /срок|сколько врем|как долго|занимает|как быстро/);
      const lines = (topic.tm || windows(topic.x, TIME_RE, 3, (w) => GOOD_TIME.test(w) && !BAD_TIME.test(w)));
      out.cards = [card(topic)];
      if (f) { out.title = f.q; out.text.push(short(f.a, 640)); }
      else if (lines.length) { out.text.push(`Сроки по теме «${short(topic.t, 70)}» — со страницы услуги:`); out.bullets = lines; }
      else out.text.push(`Точные сроки для «${short(topic.t, 70)}» зависят от объёма — назовём после анализа задачи на созвоне.`);
      out.chips = chips('timeline'); return out;
    }
    out.text.push('Сроки зависят от типа проекта. Для сайтов на Тильде, по странице нашей услуги:');
    out.table = data.t.rows; out.cards = [byUrl.get(data.t.src)].filter(Boolean).map(card);
    out.text.push('Для сложных проектов сроки считаем отдельно — после анализа и прототипа.');
    out.chips = ['Сколько времени занимает создание логотипа?', 'Сколько занимает нейминг?', ...CHIPS.timeline].slice(0, 4); return out;
  }
  function answerCases(q, nq, topic) {
    const sectors = Object.entries(FACETS.sector).filter(([, re]) => re.test(nq)).map(([k]) => k);
    const works = Object.entries(FACETS.work).filter(([, re]) => re.test(nq)).map(([k]) => k);
    const f = { sector: sectors, work: works };
    if (!sectors.length && !works.length && topic && TOPIC_CASES[topic.u.split('/')[2]]) Object.assign(f, TOPIC_CASES[topic.u.split('/')[2]]);
    const { list, exact } = pickCases(f, q);
    const oov = stems(q).filter((s) => !docIdx.df.has(s) && !['кейс', 'проект', 'портфоли', 'пример'].includes(s));
    const out = { kind: 'cases', text: [], cards: list.map(card), chips: chips('cases'), link: { t: 'Все кейсы', u: '/cases/' } };
    const what = [f.work && f.work.length ? f.work.map((w) => WORK_NAME[w]).join(' и ') : '', f.sector && f.sector.length ? 'для ' + f.sector.map((s) => SECTOR_NAME[s]).join(' и ') : ''].filter(Boolean).join(' ');
    if (oov.length) { out.text.push(`Кейсов именно со словом «${oov[0]}» в портфолио не нашёл, но вот близкие по смыслу проекты. Разработали более 200 сайтов — возможно, подходящий опыт есть, расскажите о задаче.`); out.cta = cta; }
    else if (!exact) { out.text.push('Точно под ваш запрос проектов в портфолио не нашёл — вот ближайшие по смыслу. Расскажите о задаче — подскажем, что подойдёт.'); out.cta = cta; }
    else out.text.push(what ? `Подобрал кейсы ${what}. Всего в портфолио более 200 проектов — вот самые близкие:` : 'Вот несколько проектов из портфолио DVIGA — чаще всего мы работаем с застройщиками, производствами, логистическими компаниями и FMCG:');
    return out;
  }
  function answerBlog(q) {
    const skip = new Set(['стать', 'блог', 'материал', 'пост', 'публикац', 'гайд', 'полезн', 'инструкц'].map(stem));
    const terms = queryTerms(q).filter((t) => !skip.has(t.s));
    let top = terms.some((t) => t.w === 1) ? rank(docIdx, terms, (d) => d.k === 'b').slice(0, 6).filter((x) => x.cov >= 0.25 && x.hits >= Math.min(2, terms.filter((t) => t.w === 1).length)).map((x) => x.it) : [];
    const out = { kind: 'blog', text: [], chips: chips('blog'), link: { t: 'Все статьи блога', u: '/blog/' } };
    if (top.length) out.text.push('Нашёл статьи в блоге DVIGA по вашей теме:');
    else { top = articles.slice(0, 5); out.text.push(terms.some((t) => t.w === 1) ? 'Точной статьи по этой теме не нашёл — вот материалы блога про сайты, брендинг и маркетинг недвижимости:' : 'В блоге DVIGA — гайды про сайты на Тильде, брендинг, нейминг и маркетинг недвижимости. Вот несколько материалов:'); }
    out.cards = uniq(top.map(card)); return out;
  }
  function answerServices() {
    const slugs = ['sozdanie-sajtov-na-tilda', 'razrabotka-sajta-zhilogo-kompleksa', 'razrabotka-logotipa-i-firmennogo-stilya', 'zakazat-nejming', 'brandplatform', 'prodvizhenie-sajta-zhilogo-kompleksa', 'razrabotka-internet-magazina', 'bitrix24_crm'];
    return { kind: 'services', text: ['DVIGA — маркетинговое агентство: разработка сайтов на Тильде и Битрикс, брендинг и нейминг, продвижение, исследования. Основные направления:'], cards: slugs.map(service).filter(Boolean).map(card), chips: chips('services'), link: { t: 'Все услуги', u: '/services/' }, cta };
  }
  // профиль услуги: описание, цена и срок со страницы, 2 похожих кейса
  function answerService(topic, lead) {
    const out = { kind: 'service', text: [lead || short(topic.d || topic.x, 280)], bullets: [], cards: [card(topic)], cta, chips: chips('service') };
    const fp = faqOf(topic, /стоим|сколько стоит|цен/); const pl = (topic.pr ? topic.pr.slice(0, 1) : windows(topic.x, PRICE_RE, 1));
    if (fp && /\d/.test(fp.a)) out.bullets.push('Стоимость: ' + short(fp.a, 200)); else if (pl.length) out.bullets.push('Стоимость: ' + short(pl[0], 200));
    const ft = faqOf(topic, /срок|сколько врем|как долго|занимает|как быстро/); const tl = (topic.tm ? topic.tm.slice(0, 1) : windows(topic.x, TIME_RE, 1, (w) => GOOD_TIME.test(w) && !BAD_TIME.test(w)));
    if (ft && /\d/.test(ft.a)) out.bullets.push('Сроки: ' + short(ft.a, 200)); else if (tl.length) out.bullets.push('Сроки: ' + short(tl[0], 200));
    if (!out.bullets.length) delete out.bullets;
    const f = TOPIC_CASES[topic.u.split('/')[2]];
    if (f) out.cards.push(...pickCases(f, topic.t, 2).list.map(card));
    return out;
  }
  function answerFaq(hit, terms) {
    const page = byUrl.get(hit.it.u);
    const rel = rank(faqIdx, terms).filter((x) => x.it !== hit.it && x.it.u === hit.it.u).slice(0, 2).map((x) => x.it.q);
    return { kind: 'faq', title: hit.it.q, text: [short(hit.it.a, 700)], cards: page ? [card(page)] : [], chips: chips('faq', rel), cta: /стои|цен|срок|начать|заказ|связ/i.test(hit.it.q) ? cta : '' };
  }
  function answerFact(tag, intro, more) {
    const g = fact[tag]; if (!g) return null;
    const page = byUrl.get(g[2]);
    return { kind: 'fact', text: [intro, g[1]].filter(Boolean), cards: page ? [card(page)] : [], chips: chips('process', more), cta };
  }
  function answerAbout() {
    const g = fact.about; const p = byUrl.get('/about/');
    return { kind: 'about', text: ['DVIGA — маркетинговое агентство из Владивостока: офисы во Владивостоке и Сингапуре. ' + (g ? g[1] : 'Разработали более 200 сайтов.'), (fact.reply ? fact.reply[1] : '')].filter(Boolean), cards: p ? [card(p)] : [], chips: chips('about'), cta };
  }
  function answerOrder(q, nq, topic) {
    const t = topic || service('sozdanie-sajtov-na-tilda');
    const f = {}; for (const [k, re] of Object.entries(FACETS.sector)) if (re.test(nq)) (f.sector ||= []).push(k); if (topic && TOPIC_CASES[topic.u.split('/')[2]]) Object.assign(f, TOPIC_CASES[topic.u.split('/')[2]]);
    const out = { kind: 'order', text: ['Сделаем! Расскажите о задаче на бесплатной консультации: ответим на вопросы, посоветуем рабочие инструменты под ваш бюджет, посчитаем сроки и стоимость заранее. На созвон уходит 30 минут.'], cards: [], cta, chips: chips('process') };
    if (t) out.cards.push(card(t));
    const { list } = pickCases(f.sector || f.work ? f : {}, q, 2); out.cards.push(...list.map(card));
    return out;
  }
  function answerDefine(q, terms) {
    const skip = new Set(['что', 'такое', 'значит', 'это'].map(stem));
    const ts = terms.filter((t) => !skip.has(t.s));
    const f = rank(faqIdx, ts).find((x) => /^что (такое|значит|это)/i.test(x.it.q) && x.cov >= 0.45);
    if (f) return answerFaq(f, ts);
    const r = rank(docIdx, ts, (d) => d.k === 'b' || d.k === 's').filter((x) => x.hits >= 1 && x.cov >= 0.3).slice(0, 3);
    if (!r.length) return null;
    const lead = r.find((x) => /^что такое/i.test(x.it.t)) || r[0];
    return { kind: 'general', text: [short(lead.it.d || lead.it.x, 300)], cards: uniq([lead, ...r.filter((x) => x !== lead)].map((x) => card(x.it))), chips: chips('services') };
  }
  function answerGeneral(q, terms) {
    const need = Math.min(2, terms.filter((t) => t.w === 1).length);
    const r = rank(docIdx, terms).filter((x) => x.it.u !== '/vse-stranicy/' && (x.hits >= need || (x.key && x.cov >= 0.25))).slice(0, 4);
    if (!r.length || r[0].cov < (r[0].hits >= 2 ? 0.2 : 0.3)) return null;
    const lead = r[0].it;
    return { kind: 'general', text: [short(lead.d || lead.x, 300)], cards: r.slice(0, 3).map((x) => card(x.it)), chips: chips('services'), cta: lead.k === 's' ? cta : '' };
  }
  const answerNone = () => ({ kind: 'none', text: ['Не нашёл на сайте точного ответа на этот вопрос. Я помогаю с услугами, ценами, сроками, кейсами и статьями DVIGA — попробуйте переформулировать или выберите вариант ниже. А если вопрос нестандартный, команда ответит лично: оставьте заявку или позвоните по телефону ' + C.phone + '.'], chips: chips('none'), cta });

  /** ответ на вопрос пользователя -> структура для отображения (ai.js рисует её без innerHTML) */
  function ask(question) {
    const q = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    if (!q) return null;
    const nq = norm(q);
    const its = intents(nq); const has = (k) => its.includes(k);
    const content = stems(q); const terms = queryTerms(q);
    if (has('thanks') && content.length <= 2) return { kind: 'thanks', text: ['Пожалуйста! Если появятся ещё вопросы про услуги, цены, сроки или кейсы — спрашивайте. А для точного расчёта лучше созвониться с командой.'], chips: chips('none'), cta };
    if (has('greet') && content.length <= 1) return { kind: 'greet', text: ['Здравствуйте! Я AI-помощник DVIGA. Подскажу, какие услуги мы оказываем, сколько стоит сайт на Тильде и в какие сроки, покажу подходящие кейсы и статьи блога. Что вас интересует?'], chips: chips('none') };

    let topic = topicOf(nq); const topicFromQuery = !!topic;
    const subject = content.filter((x) => !INTENT_WORDS.has(x));
    if (!topic && ctx.topic && subject.length <= 1 && (has('price') || has('timeline') || has('cases') || has('process') || has('guarantee') || has('pay') || content.length <= 2)) topic = ctx.topic;

    const fr = rank(faqIdx, terms); const fb = fr[0];
    const sameIntent = fb && (!has('price') || INTENT[3][1].test(norm(fb.it.q))) && (!has('timeline') || INTENT[4][1].test(norm(fb.it.q)));
    const qs = fb ? new Set(stems(fb.it.q)) : null;
    const qCover = fb && subject.length ? subject.filter((x) => qs.has(x)).length / subject.length : 0; // доля слов-предмета вопроса, которые есть в самом вопросе FAQ
    const vague = (has('price') || has('timeline')) && ((!topic && subject.length < 2) || (topic && topic.u === data.t.src && subject.filter((x) => !stems(topic.t).includes(x)).length < 1)); // общий вопрос про сайт на Тильде — таблица тарифов, а не случайный FAQ
    const strong = fb && !has('blog') && !vague && sameIntent && qCover >= 0.75 && fb.key && fb.ratio >= 0.6 && fb.cov >= 0.5 && fb.score > 4.5 && fb.hits >= Math.min(2, content.length) && (!has('define') || /^что (такое|значит|это)/i.test(fb.it.q));
    const extra = topic ? subject.filter((x) => !stems(topic.t).includes(x)).length : 99;
    const topicOnly = topicFromQuery && !its.length && extra <= (topic.u === data.t.src ? 0 : 2); // в вопросе только название услуги: показываем профиль услуги
    const strong0 = (f) => f && qCover >= 0.75 && f.key && f.ratio >= 0.6 && f.cov >= 0.45 && f.score > 4 && f.hits >= Math.min(2, content.length) && !has('define');
    let res = null;
    const pf = has('process') ? rank(faqIdx, terms, (f) => /процесс|этап|как (проходит|происходит|устроен)|с чего начать|как заказать|как (вы )?(делаете|создаете|разрабатываете)/i.test(f.q)).find((x) => x.hits >= 1 && x.cov >= 0.25) : null;
    if (pf) res = answerFaq(pf, terms);
    else if (topicOnly && !(strong && qCover === 1 && fb.hits >= 3)) res = answerService(topic);
    else if (has('contacts') && !strong) res = answerContacts();
    else if (strong) res = answerFaq(fb, terms);
    else if (has('pay')) res = answerFact('pay', 'Оплата — по этапам:', ['Какие гарантии вы даёте?']) || null;
    else if (has('guarantee')) { res = answerFact('guarantee', 'Гарантия на работу:', ['Как проходит оплата?']); if (res && fact.contract) res.text.push(fact.contract[1]); }
    else if (has('price')) res = answerPrice(q, nq, topic);
    else if (has('timeline')) res = answerTimeline(q, nq, topic);
    else if (has('cases')) res = answerCases(q, nq, topic);
    else if (has('blog')) res = answerBlog(q);
    else if (has('define')) res = answerDefine(q, terms);
    else if (has('capability') || has('order')) res = topic ? answerService(topic, has('order') ? 'Да, конечно: ' + short(topic.d || '', 220) : 'Да, это одно из наших направлений. ' + short(topic.d || '', 220)) : has('order') ? answerOrder(q, nq, topic) : null;
    else if (has('services')) res = answerServices();
    else if (has('contacts')) res = answerContacts();
    else if (has('about')) res = answerAbout();
    else if (has('partners') && byUrl.get('/partners/')) { const p = byUrl.get('/partners/'); res = { kind: 'general', text: [short(p.d || p.x, 260)], cards: [card(p)], chips: chips('about'), cta }; }
    else if (has('process')) { const pf = rank(faqIdx, terms, (f) => /процесс|этап|как (проходит|происходит|устроен)|с чего начать|как заказать/i.test(f.q)).find((x) => x.hits >= 1 && x.cov >= 0.25); res = pf ? answerFaq(pf, terms) : answerFact('reply', 'Как мы работаем:'); }
    if (has('order') && !res) res = answerOrder(q, nq, topic);
    if (!res && topic && topicFromQuery) res = answerService(topic);
    if (!res && strong0(fb)) res = answerFaq(fb, terms);
    if (!res) res = answerGeneral(q, terms);
    if (!res) res = answerNone();
    if (topic) ctx.topic = topic; else if (res.kind === 'general' && res.cards[0]) { const d = byUrl.get(res.cards[0].u); if (d && d.k === 's') ctx.topic = d; }
    return res;
  }
  const reset = () => { ctx.topic = null; };
  return { ask, reset, stats: { docs: docs.length, faq: faq.length } };
}
