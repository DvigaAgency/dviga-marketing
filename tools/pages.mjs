// Страницы копии: адрес -> снимок HTML оригинала (data/pages/, обновляется tools/fetch-html.mjs --pages).
// kind: home | cases (каталог кейсов с новой фильтрацией) | page (любая страница из Zero-блоков)
// Страницы кейсов, статей и услуг подхватываются автоматически: data/pages/cases__<slug>.html -> /cases/<slug>, blog__<slug>.html -> /blog/<slug>, services__<slug>.html -> /services/<slug>, contacts__<slug>.html -> /contacts/<slug>.
import fs from 'node:fs';

const dir = 'data/pages';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
const sub = (prefix) => files.filter((f) => f.startsWith(prefix + '__') && f.endsWith('.html')).map((f) => ({ path: `/${prefix}/${f.slice(prefix.length + 2, -5)}`, src: `${dir}/${f}`, kind: 'page' }));

// страницы-перенаправления: на оригинале это страница с блоком T305 (JS-редирект), содержимое которой посетитель не видит
export const REDIRECTS = { '/services/internet-magazin-na-tilda': '/blog/kak-sozdat-internet-magazin-na-tilde' };

export const PAGES = [
  { path: '/', src: 'data/home.source.html', kind: 'home' },
  { path: '/cases', src: `${dir}/cases.html`, kind: 'cases' },
  ...sub('cases'),
  { path: '/blog', src: `${dir}/blog.html`, kind: 'page' },
  ...sub('blog'),
  { path: '/services', src: `${dir}/services.html`, kind: 'page' },
  ...sub('services'),
  { path: '/contacts', src: `${dir}/contacts.html`, kind: 'page' },
  ...sub('contacts'),
  ...Object.entries(REDIRECTS).map(([path, to]) => ({ path, to, kind: 'redirect' })),
];
