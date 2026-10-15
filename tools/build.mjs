// Сборка статической копии dviga.marketing: страницы из tools/pages.mjs (снимки HTML Tilda) -> чистые HTML/CSS/JS в dist/.
// Запуск: node tools/build.mjs   (переменные: SITE_URL, NOINDEX=1, BASE=/подкаталог, OUT, CSS_MODE)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import * as esbuild from 'esbuild';
import * as csstree from 'css-tree';
import { convertZero } from './lib/zero.mjs';
import { picture, cssImage, lookup, usedAssets } from './lib/assets.mjs';
import { renderZeroForm, renderTildaForm } from './lib/forms.mjs';
import { subsetFonts } from './subset-fonts.mjs';
import { cookie, reviewsSlider, reviewPopups, blankPopups, widget, search, fixLinks } from './lib/components.mjs';
import { setLocalPaths, link } from './lib/util.mjs';
import { tabsBlock, loadMoreBlock, shareBlock } from './lib/listing.mjs';
import { casesCatalog } from './lib/cases.mjs';
import { PAGES } from './pages.mjs';

const OUT = process.env.OUT || 'dist';
// BASE — подкаталог публикации (например /dviga-marketing для GitHub Pages проекта); по умолчанию сайт в корне
const BASE = (process.env.BASE || '').replace(/\/$/, '');
const SITE_URL = (process.env.SITE_URL || 'https://dviga.marketing').replace(/\/$/, '');
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const NL = String.fromCharCode(10);
setLocalPaths(PAGES.map((p) => p.path));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const videoManifest = fs.existsSync('data/video-manifest.json') ? JSON.parse(fs.readFileSync('data/video-manifest.json', 'utf8')) : {};

// ----------------------------------------------------------------- общий CSS (одинаков для всех страниц)
const readCss = (f) => fs.readFileSync(f, 'utf8');
// cookie и виджет: все px масштабируются явно (calc(Npx*var(--ui))) — без CSS zoom, который по-разному работает в браузерах
const scaleUi = (css) => {
  const ast = csstree.parse(css);
  csstree.walk(ast, { visit: 'Declaration', enter(decl) {
    csstree.walk(decl.value, { visit: 'Dimension', enter(node, item, list) {
      if (node.unit !== 'px' || +node.value === 0 || !list) return;
      list.replace(item, list.createItem({ type: 'Function', name: 'calc', children: new csstree.List().fromArray([{ type: 'Dimension', value: node.value, unit: 'px' }, { type: 'Operator', value: '*' }, { type: 'Function', name: 'var', children: new csstree.List().fromArray([{ type: 'Identifier', name: '--ui' }]) }]) }));
    } });
  } });
  return csstree.generate(ast);
};
const dot = lookup('https://static.tildacdn.com/tild6163-3064-4564-b862-643738343166/Frame_2.png');
usedAssets.add(dot.webp.at(-1).src);
const FB = (t) => t.replace(/font-family:Inter,Arial,sans-serif/g, 'font-family:Inter,Inter Fallback,Arial,sans-serif').replace(/font-family:'?Inter'?;/g, 'font-family:Inter,Inter Fallback,Arial,sans-serif;').replace(/--t-(headline|text)-font:Inter,Arial,sans-serif/g, '--t-$1-font:Inter,Inter Fallback,Arial,sans-serif');
const embeds = readCss('src/css/embeds.css').replace(/%%DOT%%/g, dot.webp.at(-1).src);
const staticCrit = [readCss('src/css/base.css'), scaleUi(readCss('src/css/critical.css')), embeds];
const staticRest = [readCss('src/css/forms.css'), readCss('src/css/components.css'), readCss('src/css/listing.css'), scaleUi(readCss('src/css/cases.css'))];
const tgt = ['chrome110', 'safari16', 'firefox110'];
const CSS_MODE = process.env.CSS_MODE || 'link';
const withBase = (s) => (BASE ? s.replace(/url\((['"]?)\/assets\//g, `url($1${BASE}/assets/`) : s);

// ----------------------------------------------------------------- JS (общий для всех страниц)
const jsRes = await esbuild.build({
  entryPoints: ['src/js/main.js'], bundle: true, splitting: true, format: 'esm', minify: true, target: tgt,
  outdir: path.join(OUT, 'assets'), entryNames: 'app.[hash]', chunkNames: 'chunk.[name].[hash]', write: true, metafile: true, legalComments: 'none',
});
const jsEntry = Object.keys(jsRes.metafile.outputs).find((f) => /app\.[^/]+\.js$/.test(f) && jsRes.metafile.outputs[f].entryPoint);
const jsName = path.basename(jsEntry);

// ----------------------------------------------------------------- общие элементы head
const ogDefault = lookup('https://static.tildacdn.com/tild3235-6362-4338-b632-346162646239/_.jpg');
usedAssets.add(ogDefault.webp.at(-1).src);
const logo = lookup('https://static.tildacdn.com/tild6364-3730-4234-b039-643962393136/Layer_2.svg');
const icon = (u) => { const m = lookup(u); if (m) usedAssets.add(m.src); return m ? m.src : ''; };
const ic32l = icon('https://static.tildacdn.com/tild3064-6261-4234-a433-633065396438/32-1.png');
const ic32d = icon('https://static.tildacdn.com/tild3539-6364-4563-b635-383131316562/32-1.png');
const icSvg = icon('https://static.tildacdn.com/tild6366-6462-4930-b765-623636353931/Frame_60.svg');
const icApple = icon('https://static.tildacdn.com/tild3063-3138-4639-b765-316663623732/_.png');
const fontPre = ['inter-cyrillic', 'inter-latin'].map((f) => `<link rel="preload" href="/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join('');
const noindex = process.env.NOINDEX ? '<meta name="robots" content="noindex,nofollow">' : '';
const closeSvg = '<svg role="presentation" width="23" height="23" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><rect transform="translate(11.31 11.31) rotate(-45) translate(-11.31 -11.31)" x="10.31" y="-3.69" width="2" height="30"/><rect transform="translate(11.31 11.31) rotate(-315) translate(-11.31 -11.31)" x="10.31" y="-3.69" width="2" height="30"/></g></svg>';
const closeBtn = `<div class="px"><button type="button" aria-label="Закрыть диалоговое окно" data-close>${closeSvg}</button></div>`;
const FORM_VARS = '--ih:50px;--ir:20px;--ibc:#dedede;--ibg:#f2f2f2;--ic:#121212;--tc:#121212;--ec:#000;--bbg:#f5d5d2;--bc:#d93433;--bhb:#d93433;--bhc:#fff;--bw:auto;';
const POPUP_RECS = { 1121678416: 'menu', 1064388596: 'form' };
const HOME_ANX = new Set(['991113446:1743673825773', '991113446:1744966468663', '991105351:1743673825787', '991105351:1743673825773', '991105346:1744705724941', '991105346:1744966643206']);

// url() внутри пользовательских свойств (--icon: url(…)) css-tree не разбирает — подставляем локальные файлы здесь
const localUrls = (t) => t.replace(/url\((['"]?)(https?:\/\/(?:static|thb)\.tildacdn\.com\/[^)'"]+)\1\)/g, (m, q, u) => { const a = lookup(u); if (!a) { console.warn('NO CSS ASSET', u); return m; } const f = a.kind === 'svg' ? a.src : a.webp.at(-1).src; usedAssets.add(f); return `url(${f})`; });
const isZero = (rec) => rec.attr('data-record-type') === '396' || rec.attr('data-alias-record-type') === '396';

// ----------------------------------------------------------------- одна страница
async function buildPage(spec) {
  const $ = cheerio.load(fs.readFileSync(spec.src, 'utf8'), { decodeEntities: false });
  const home = spec.kind === 'home';
  const extraCss = [];
  const idCount = {};
  $('.t396__elem').each((i, e) => { const id = $(e).attr('data-elem-id'); idCount[id] = (idCount[id] || 0) + 1; });
  // «ранние» записи (первый экран) — критический CSS: шапка и первые Zero-блоки основной части
  const mainZero = $('#allrecords > .r').toArray().filter((n) => isZero($(n))).map((n) => $(n).attr('id').replace('rec', ''));
  // свёрнутые вкладками/«Загрузить еще» записи на первом экране не видны — ранними считаем первые видимые
  const hiddenAtStart = new Set();
  $('.t400__submit').each((i, b) => ($(b).attr('data-hidden-rec-ids') || '').split(',').forEach((x) => hiddenAtStart.add(x)));
  $('li.t395__tab').each((i, li) => { const act = $(li).closest('ul').find('li.t395__tab_active').attr('data-tab-rec-ids') || ''; ($(li).attr('data-tab-rec-ids') || '').split(',').forEach((x) => { if (!act.split(',').includes(x)) hiddenAtStart.add(x); }); });
  const eagerRecs = new Set(home ? ['680556230', '1438775181'] : ['680556230', ...mainZero.filter((x) => !hiddenAtStart.has(x)).slice(0, 6)]);
  const ctx = {
    sel: (rec, id) => (idCount[id] > 1 ? `#r${rec} .e${id}` : `.e${id}`),
    anx: home ? HOME_ANX : new Set(),
    href: link,
    picture,
    cssImage,
    eager() { return ctx.eagerRecs.has(ctx.rec); },
    drag: new Set(home ? ['864137673'] : []),
    eagerRecs,
    textHtml: (h) => fixLinks(h),
    video(url) {
      const v = videoManifest[url];
      if (!v) return '<video class="vd" muted loop playsinline preload="none" aria-hidden="true"></video>';
      usedAssets.add(v.mp4);
      if (v.poster) usedAssets.add(v.poster);
      if (v.webm) usedAssets.add(v.webm);
      return `<video class="vd" muted loop playsinline preload="none"${v.poster ? ` data-poster="${v.poster}"` : ''} data-src="${v.mp4}"${v.webm ? ` data-webm="${v.webm}"` : ''} width="${v.w}" height="${v.h}" aria-hidden="true"></video>`;
    },
    form(e) {
      const el = e.el;
      const inputs = JSON.parse(el.find('.tn-atom__inputs-data').attr('data-value'));
      const screens = (el.closest('.t396__artboard').attr('data-artboard-screens') || '320,480,640,960,1200').split(',').map(Number);
      const r = renderZeroForm(e.attrs, inputs, `${ctx.rec}_${e.id}`, screens);
      extraCss.push(r.css);
      return r.html;
    },
  };

  // ---------------- записи страницы
  const regions = {
    header: $('header.t-records > .r').toArray(),
    main: $('#allrecords > .r').toArray(),
    footer: $('footer.t-records > .r').toArray(),
  };
  const css = [];
  const recCss = {}; // CSS записи по id — для отложенной загрузки стилей свёрнутых записей
  const critZero = [];
  const html = { header: [], main: [], footer: [] };
  const popupZero = {};
  const hasTabs = { v: false };
  const tabInfo = { tabs: [], more: [] }; // для начального состояния записей (вкладки/«загрузить еще»)
  let catalog = null;
  for (const [name, list] of Object.entries(regions)) {
    for (const node of list) {
      const rec = $(node);
      const type = rec.attr('data-record-type');
      const rid = rec.attr('id').replace('rec', '');
      if (catalog && catalog.skip.has(rid)) { if (catalog.at === rid) html[name].push(catalog.html); continue; }
      if (spec.kind === 'cases' && name === 'main' && !catalog) { catalog = casesCatalog($, rec, ctx, spec); if (catalog.skip.has(rid)) { if (catalog.at === rid) html[name].push(catalog.html); continue; } }
      if (type === '525') { html[name].push(reviewsSlider($)); continue; }
      if (type === '395' && name === 'main') { const t = tabsBlock($, rec); css.push(t.css); html[name].push(t.html); hasTabs.v = true; tabInfo.tabs.push(t.tabs); continue; }
      if (type === '400' && name === 'main') { const t = loadMoreBlock($, rec); css.push(t.css); html[name].push(t.html); hasTabs.v = true; tabInfo.more.push(t.more); continue; }
      if (type === '151' && name === 'main') { const t = shareBlock($, rec); css.push(t.css); html[name].push(t.html); continue; }
      if (!isZero(rec)) continue;
      const r = convertZero($, rec, ctx);
      r.css = localUrls(r.css);
      if (ctx.eagerRecs.has(rid)) critZero.push(r.css); else { css.push(r.css); recCss[rid] = r.css; }
      if (POPUP_RECS[rid]) popupZero[POPUP_RECS[rid]] = r.html; else html[name].push(r.html);
    }
  }
  if (catalog) { css.push(catalog.css); }

  // начальное состояние: записи неактивных вкладок и скрытые кнопкой «Загрузить еще» свёрнуты сразу в разметке (без вспышки)
  const off = new Set(tabInfo.more.flat());
  const inTab = new Set();
  for (const tabs of tabInfo.tabs) { const act = tabs.find((t) => t.on); for (const t of tabs) for (const i of t.ids) { inTab.add(i); if (t !== act || false) { if (!(act && act.ids.includes(i))) off.add(i); } } }
  // CSS свёрнутых записей (неактивные вкладки, «Загрузить еще») грузится отдельным файлом после загрузки страницы
  const deferred = [];
  for (const id of off) if (recCss[id]) { deferred.push(recCss[id]); const k = css.indexOf(recCss[id]); if (k >= 0) css.splice(k, 1); }
  for (const part of Object.keys(html)) html[part] = html[part].map((h) => h.replace(/^<section id="r([0-9]+)" class="r/, (m, id) => (off.has(id) ? m + ' off' : m)));

  // ---------------- попапы и виджет (одинаковые на всех страницах)
  const menuPopup = `<div class="pp blk menu cq" id="p-menu" data-hook="menu" role="dialog" aria-modal="true" aria-label="Меню" tabindex="-1"><div class="pc">${popupZero.menu}</div></div>`;
  const formPopup = `<div class="pp blk form cq" id="p-form" data-hook="form" role="dialog" aria-modal="true" aria-label="Обсудить проект" tabindex="-1">${closeBtn}<div class="pc">${popupZero.form}</div></div>`;
  const calcRec = $('#rec742904618');
  const calcForm = renderTildaForm($, calcRec.find('form'), 'calc', { success: 'Спасибо! Мы свяжемся с вами в ближайшее время.', vars: `${FORM_VARS}--br:30px;--mb:25px;--tfs:20px;--tfw:500;--tmb:5px;` });
  const calcPopup = `<div class="pp" id="p-calculate" data-hook="popup:calculate" role="dialog" aria-modal="true" tabindex="-1" aria-label="${calcRec.find('.t702__title').text().trim()}">${closeBtn}<div class="pc cl"><div class="cl-w"><div class="cl-t">${calcRec.find('.t702__title').html()}</div>${calcForm}</div></div></div>`;
  const wRec = $('#rec1468283321');
  const widgetForm = renderTildaForm($, wRec.find('form'), 'widget', { success: 'Спасибо! Мы свяжемся с вами в ближайшее время.', vars: `${FORM_VARS}--br:100px;--mb:15px;--bfs:14px;--bfw:500;--bmt:30px;--btt:uppercase;` });
  const popups = [menuPopup, formPopup, calcPopup, reviewPopups($), blankPopups($), search($)].join('');

  // ---------------- CSS страницы
  const critAll = readCss('src/css/fonts.css') + FB([...staticCrit, critZero.join(NL)].join(NL));
  const restAll = FB([...staticRest, css.join(NL), extraCss.join(NL)].join(NL));
  const critCss = (await esbuild.transform(critAll, { loader: 'css', minify: true, target: tgt })).code;
  const minCss = (await esbuild.transform(restAll, { loader: 'css', minify: true, target: tgt })).code;
  const fullCss = (await esbuild.transform(critAll + NL + restAll, { loader: 'css', minify: true, target: tgt })).code;
  const outCss = CSS_MODE === 'async' ? minCss : fullCss;
  const cssName = `app.${hash(outCss)}.css`;
  fs.writeFileSync(path.join(OUT, 'assets', cssName), withBase(outCss));
  let deferTag = '';
  if (deferred.length) {
    const dCss = (await esbuild.transform(FB(deferred.join(NL)), { loader: 'css', minify: true, target: tgt })).code;
    const dName = `app.${hash(dCss)}.d.css`;
    fs.writeFileSync(path.join(OUT, 'assets', dName), withBase(dCss));
    deferTag = `<link rel="stylesheet" href="/assets/${dName}" media="print" data-defer><noscript><link rel="stylesheet" href="/assets/${dName}"></noscript>`;
  }

  // ---------------- head
  const title = $('title').text();
  const descr = $('meta[name=description]').attr('content') || '';
  const url = `${SITE_URL}${spec.path === '/' ? '/' : spec.path + '/'}`;
  const ogSrc = $('meta[property="og:image"]').attr('content');
  const ogM = (ogSrc && lookup(ogSrc)) || ogDefault;
  usedAssets.add(ogM.webp.at(-1).src);
  const ldFile = home ? JSON.parse(fs.readFileSync('data/jsonld.json', 'utf8')) : $('script[type="application/ld+json"]').map((i, e) => { try { return JSON.parse($(e).text()); } catch { return null; } }).get().filter(Boolean);
  const ld = ldFile
    .map((o) => JSON.parse(JSON.stringify(o).replace(/https?:\\?\/\\?\/(static|thb)\.tildacdn\.com[^"\\]*/g, SITE_URL + logo.src).replace(/https:\/\/dviga\.marketing/g, SITE_URL)))
    .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('');
  const noscript = '<style>.e[data-fi]{opacity:1!important}.e[data-h0]>.sw{opacity:1!important}</style>';
  const cssTags = CSS_MODE === 'inline' ? `<style>${fullCss}</style>` : CSS_MODE === 'async'
    ? `<style>${critCss}</style><link rel="stylesheet" href="/assets/${cssName}" media="print" onload="this.media='all';dispatchEvent(new Event('cssload'))"><noscript><link rel="stylesheet" href="/assets/${cssName}">${noscript}</noscript>`
    : `<link rel="stylesheet" href="/assets/${cssName}"><noscript>${noscript}</noscript>`;
  const ogTitle = $('meta[property="og:title"]').attr('content') || title;
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>(function(e){function f(){e.style.setProperty("--cw",e.clientWidth)}f();addEventListener("resize",f)})(document.documentElement)</script><title>${title}</title><meta name="description" content="${descr}">${noindex}<link rel="canonical" href="${url}"><meta name="format-detection" content="telephone=no"><meta name="theme-color" content="#ffffff">`
    + `<meta property="og:url" content="${url}"><meta property="og:title" content="${ogTitle}"><meta property="og:description" content="${descr}"><meta property="og:type" content="${/^\/blog\/.+/.test(spec.path) ? 'article' : 'website'}"><meta property="og:image" content="${SITE_URL}${ogM.webp.at(-1).src}"><meta name="twitter:card" content="summary_large_image">`
    + `<link rel="icon" type="image/png" sizes="32x32" href="${ic32l}" media="(prefers-color-scheme: light)"><link rel="icon" type="image/png" sizes="32x32" href="${ic32d}" media="(prefers-color-scheme: dark)"><link rel="icon" type="image/svg+xml" sizes="any" href="${icSvg}"><link rel="apple-touch-icon" href="${icApple}">`
    + `${fontPre}${cssTags}${deferTag}${ld}`;

  const body = `<header id="hd">${html.header.join('')}</header><main id="main" class="cq">${html.main.join('')}</main><footer class="cq">${html.footer.join('')}</footer>${popups}${cookie($)}${widget($, widgetForm)}`;
  const page = `<!doctype html><html lang="ru"><head>${head}</head><body${catalog ? ' data-cases' : ''}>${body}<script type="module" src="/assets/${jsName}"></script></body></html>`;
  // локальные ссылки на страницы (href="/…") и ассеты (/assets/…) получают префикс подкаталога — каждая ровно один раз
  const fixed = BASE ? page.replace(/href="\/(?!\/|assets\/)/g, `href="${BASE}/`).replace(/(["'(,\s])\/assets\//g, `$1${BASE}/assets/`) : page;
  const outFile = path.join(OUT, spec.path === '/' ? '' : spec.path, 'index.html');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, fixed);
  return { spec, page, critCss, minCss, cssLen: minCss.length };
}

const built = [];
for (const spec of PAGES) built.push(await buildPage(spec));

// ----------------------------------------------------------------- статика
const fontReport = await subsetFonts(built.map((b) => b.page).join(''), path.join(OUT, 'assets/fonts'));
let copied = 0;
for (const a of usedAssets) {
  const src = path.join('public', a);
  if (!fs.existsSync(src)) { console.warn('MISSING asset', a); continue; }
  fs.mkdirSync(path.dirname(path.join(OUT, a)), { recursive: true });
  fs.copyFileSync(src, path.join(OUT, a));
  copied++;
}
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${PAGES.map((p) => `<url><loc>${SITE_URL}${p.path === '/' ? '/' : p.path + '/'}</loc></url>`).join('')}</urlset>\n`);
fs.writeFileSync(path.join(OUT, '_headers'), '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
const kb = (n) => (n / 1024).toFixed(1);
for (const b of built) console.log(`${b.spec.path.padEnd(60)} html ${kb(b.page.length)} KB, css ${kb(b.cssLen)} KB`);
console.log(`fonts: ${fontReport}`);
console.log(`build ok: pages ${built.length}, js ${kb(fs.statSync(path.join(OUT, 'assets', jsName)).size)} KB, assets copied ${copied}`);
