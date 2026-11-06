// Языковой профиль сборки. SITE_LANG=en собирает английскую версию (проект Tilda 85434, en.dviga.marketing),
// без переменной — русскую (проект 8290193, dviga.marketing). Всё, что зависит от языка и от идентификаторов записей Tilda, лежит здесь.
//   RU_URL / EN_URL — адреса главных страниц обеих версий (для переключателя языка и hreflang);
//   по умолчанию боевые, для превью на github.io задаются переменными сборки.
const url = (name, def) => (process.env[name] || def).replace(/\/?$/, '/');

export const LANG = process.env.SITE_LANG === 'en' ? 'en' : 'ru';
export const RU_URL = url('RU_URL', 'https://dviga.marketing/');
export const EN_URL = url('EN_URL', 'https://en.dviga.marketing/');

const PROFILES = {
  ru: {
    lang: 'ru',
    origin: 'https://dviga.marketing', // сюда ведут ссылки на страницы, которых нет в копии
    homeSrc: 'data/home.source.html',
    jsonLd: 'data/jsonld.json',
    switchFrom: 'https://en.dviga.marketing/', switchTo: EN_URL, // ссылка «en» в шапке
    popupRecs: { 1121678416: 'menu', 1064388596: 'form' },
    dropRecs: [],
    eagerHome: ['680556230', '1438775181'],
    homeAnx: ['991113446:1743673825773', '991113446:1744966468663', '991105351:1743673825787', '991105351:1743673825773', '991105346:1744705724941', '991105346:1744966643206'],
    homeDrag: ['864137673'],
    calcRec: '742904618', widgetRec: '1468283321', cookieRec: '979372986', searchRec: '3285898701', reviewsRec: '680540530',
    search: true, widget: true, cookie: true, serviceIndex: true,
    css: '',
  },
  en: {
    lang: 'en',
    origin: 'https://en.dviga.marketing',
    homeSrc: 'data/en/home.source.html',
    jsonLd: null,
    switchFrom: 'https://dviga.marketing/', switchTo: RU_URL,
    // 1137065701 — Zero-блок «Thanks for reaching out!»: на оригинале (плагин Nolim NLM056) скрыт и показывается поверх страницы после отправки формы
    popupRecs: { 1137023591: 'menu', 1137061616: 'form', 1137065701: 'thanks' },
    dropRecs: ['1137113066'], // такой же блок «спасибо» для формы подвала — одного попапа достаточно
    eagerHome: ['856855286', '1140054071'],
    homeAnx: ['1117501591', '1117502501', '1117503661'].flatMap((r) => [`${r}:1743673825773`, `${r}:1744966468663`]),
    homeDrag: ['1141243251'],
    calcRec: '856861567', widgetRec: null, cookieRec: null, searchRec: null, reviewsRec: '733743726',
    search: false, widget: false, cookie: false, serviceIndex: false,
    // CSS из HTML-блоков (T123) английской главной: шапка закреплена не настройкой Zero, а правилом на классе записи (rec856855289)
    css: '.uc-menu-header{z-index:999;position:fixed;width:100%}',
  },
};

export const P = PROFILES[LANG];

const STRINGS = {
  ru: {
    closeDialog: 'Закрыть диалоговое окно', closeNotice: 'Закрыть уведомление', close: 'Закрыть', menu: 'Меню', discuss: 'Обсудить проект',
    openMenu: 'Открыть меню', siteSearch: 'Поиск по сайту', call: 'Позвонить: 8 800 200 23 02',
    reviews: 'Отзывы', prevReview: 'Предыдущий отзыв', nextReview: 'Следующий отзыв', blank: 'Бланк отзыва', gallery: 'Галерея',
    contactUs: 'Связаться с нами', search: 'Поиск', clear: 'Очистить', closeSearch: 'Закрыть поиск', more: 'Показать ещё',
    upload: 'Загрузить файлы', thanks: 'Спасибо! Мы свяжемся с вами.', thanksSoon: 'Спасибо! Мы свяжемся с вами в ближайшее время.',
    send: 'Отправить', next: 'Далее', back: 'Назад', video: 'Видео', watch: 'Смотреть видео', prev: 'Назад', forward: 'Вперёд', dialog: 'Диалоговое окно',
  },
  en: {
    closeDialog: 'Close dialog window', closeNotice: 'Close notice', close: 'Close', menu: 'Menu', discuss: 'Discuss your project',
    openMenu: 'Open menu', siteSearch: 'Site search', call: 'Call us: +65 9853 6101',
    reviews: 'Reviews', prevReview: 'Previous review', nextReview: 'Next review', blank: 'Review form', gallery: 'Gallery',
    contactUs: 'Contact us', search: 'Search', clear: 'Clear', closeSearch: 'Close search', more: 'Show more',
    upload: 'Upload files', thanks: 'Thank you! We will contact you shortly.', thanksSoon: 'Thank you! We will contact you shortly.',
    send: 'Send', next: 'Next', back: 'Back', video: 'Video', watch: 'Watch video', prev: 'Back', forward: 'Forward', dialog: 'Dialog window',
  },
};
export const T = STRINGS[LANG];
