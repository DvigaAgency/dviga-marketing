// Страницы копии: адрес -> снимок HTML оригинала (data/pages/, обновляется tools/fetch-html.mjs --pages).
// kind: home | cases (каталог кейсов с новой фильтрацией) | page (любая страница из Zero-блоков)
// Страницы кейсов, статей и услуг подхватываются автоматически: data/pages/cases__<slug>.html -> /cases/<slug>, blog__<slug>.html -> /blog/<slug>, services__<slug>.html -> /services/<slug>, contacts__<slug>.html -> /contacts/<slug>.
import fs from 'node:fs';

const dir = 'data/pages';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
const sub = (prefix) => files.filter((f) => f.startsWith(prefix + '__') && f.endsWith('.html')).map((f) => ({ path: `/${prefix}/${f.slice(prefix.length + 2, -5)}`, src: `${dir}/${f}`, kind: 'page' }));

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
];
