// Страницы копии: адрес -> снимок HTML оригинала (data/pages/, обновляется tools/fetch-html.mjs --pages).
// kind: home | cases (каталог кейсов с новой фильтрацией) | page (любая страница из Zero-блоков)
export const PAGES = [
  { path: '/', src: 'data/home.source.html', kind: 'home' },
  { path: '/cases', src: 'data/pages/cases.html', kind: 'cases' },
  { path: '/cases/tush-i-teni', src: 'data/pages/cases__tush-i-teni.html', kind: 'page' },
  { path: '/cases/sever-staff-groupp', src: 'data/pages/cases__sever-staff-groupp.html', kind: 'page' },
  { path: '/blog', src: 'data/pages/blog.html', kind: 'page' },
  { path: '/blog/kak-optimizirovat-smetu-proekta', src: 'data/pages/blog__kak-optimizirovat-smetu-proekta.html', kind: 'page' },
  { path: '/blog/ren-tv-obnovili-svoy-logotip-i-pozitsionirovaniye', src: 'data/pages/blog__ren-tv-obnovili-svoy-logotip-i-pozitsionirovaniye.html', kind: 'page' },
];
