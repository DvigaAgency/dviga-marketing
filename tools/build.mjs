// Сборка статической копии главной dviga.marketing: HTML Tilda (выгрузка) -> чистые HTML/CSS/JS в dist/.
// Запуск: node tools/build.mjs   (переменные: SITE_URL, NOINDEX=1)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import * as esbuild from 'esbuild';
import { convertZero } from './lib/zero.mjs';
import { picture, cssImage, lookup, usedAssets } from './lib/assets.mjs';
import { renderZeroForm, renderTildaForm } from './lib/forms.mjs';
import { subsetFonts } from './subset-fonts.mjs';
import { cookie, reviewsSlider, reviewPopups, blankPopups, widget, search, fixLinks } from './lib/components.mjs';

const SRC = 'data/home.source.html'; // снимок исходного HTML главной (обновляется tools/fetch-html.mjs)
const OUT = process.env.OUT || 'dist';
// BASE — подкаталог публикации (например /dviga-marketing для GitHub Pages проекта); по умолчанию сайт в корне
const BASE = (process.env.BASE || '').replace(/\/$/, '');
const SITE_URL = (process.env.SITE_URL || 'https://dviga.marketing').replace(/\/$/, '');
const SITE_ORIGINAL = 'https://dviga.marketing';
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

const $ = cheerio.load(fs.readFileSync(SRC, 'utf8'), { decodeEntities: false });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

// ----------------------------------------------------------------- видео
const videoManifest = fs.existsSync('data/video-manifest.json') ? JSON.parse(fs.readFileSync('data/video-manifest.json', 'utf8')) : {};

// ----------------------------------------------------------------- контекст конвертации
const extraCss = [];
const idCount = {};
$('.t396__elem').each((i, e) => { const id = $(e).attr('data-elem-id'); idCount[id] = (idCount[id] || 0) + 1; });
const ctx = {
  sel: (rec, id) => (idCount[id] > 1 ? `#r${rec} .e${id}` : `.e${id}`),
  anx: new Set(['991113446:1743673825773', '991113446:1744966468663', '991105351:1743673825787', '991105351:1743673825773', '991105346:1744705724941', '991105346:1744966643206']),
  href(h) {
    if (!h) return h;
    if (/^\/(?!\/)/.test(h) && h !== '/') return SITE_ORIGINAL + h;
    return h;
  },
  picture,
  cssImage,
  eager() { return ctx.eagerRecs.has(ctx.rec); },
  drag: new Set(['864137673']),
  eagerRecs: new Set(['680556230', '1438775181']),
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

// ----------------------------------------------------------------- Zero-блоки
const regions = {
  header: $('header.t-records > .r').toArray(),
  main: $('#allrecords > .r').toArray(),
  footer: $('footer.t-records > .r').toArray(),
};
const css = [];
const critZero = [];
const html = { header: [], main: [], footer: [] };
const popupZero = {};
const POPUP_RECS = { 1121678416: 'menu', 1064388596: 'form' };
for (const [name, list] of Object.entries(regions)) {
  for (const node of list) {
    const rec = $(node);
    const type = rec.attr('data-record-type');
    const rid = rec.attr('id').replace('rec', '');
    if (type === '525') { html[name].push(reviewsSlider($)); continue; }
    if (type !== '396') continue;
    const r = convertZero($, rec, ctx);
    (ctx.eagerRecs.has(rid) ? critZero : css).push(r.css);
    if (POPUP_RECS[rid]) popupZero[POPUP_RECS[rid]] = r.html; else html[name].push(r.html);
  }
}

// ----------------------------------------------------------------- попапы и виджет
const closeSvg = '<svg role="presentation" width="23" height="23" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg"><g fill-rule="evenodd"><rect transform="translate(11.31 11.31) rotate(-45) translate(-11.31 -11.31)" x="10.31" y="-3.69" width="2" height="30"/><rect transform="translate(11.31 11.31) rotate(-315) translate(-11.31 -11.31)" x="10.31" y="-3.69" width="2" height="30"/></g></svg>';
const closeBtn = `<div class="px"><button type="button" aria-label="Закрыть диалоговое окно" data-close>${closeSvg}</button></div>`;
const menuPopup = `<div class="pp blk menu cq" id="p-menu" data-hook="menu" role="dialog" aria-modal="true" aria-label="Меню" tabindex="-1"><div class="pc">${popupZero.menu}</div></div>`;
const formPopup = `<div class="pp blk form cq" id="p-form" data-hook="form" role="dialog" aria-modal="true" aria-label="Обсудить проект" tabindex="-1">${closeBtn}<div class="pc">${popupZero.form}</div></div>`;
const FORM_VARS = '--ih:50px;--ir:20px;--ibc:#dedede;--ibg:#f2f2f2;--ic:#121212;--tc:#121212;--ec:#000;--bbg:#f5d5d2;--bc:#d93433;--bhb:#d93433;--bhc:#fff;--bw:auto;';
const calcRec = $('#rec742904618');
const calcForm = renderTildaForm($, calcRec.find('form'), 'calc', { success: 'Спасибо! Мы свяжемся с вами в ближайшее время.', vars: `${FORM_VARS}--br:30px;--mb:25px;--tfs:20px;--tfw:500;--tmb:5px;` });
const calcPopup = `<div class="pp" id="p-calculate" data-hook="popup:calculate" role="dialog" aria-modal="true" tabindex="-1" aria-label="${calcRec.find('.t702__title').text().trim()}">${closeBtn}<div class="pc cl"><div class="cl-w"><div class="cl-t">${calcRec.find('.t702__title').html()}</div>${calcForm}</div></div></div>`;
const wRec = $('#rec1468283321');
const widgetForm = renderTildaForm($, wRec.find('form'), 'widget', { success: 'Спасибо! Мы свяжемся с вами в ближайшее время.', vars: `${FORM_VARS}--br:100px;--mb:15px;--bfs:14px;--bfw:500;--bmt:30px;--btt:uppercase;` });
const popups = [menuPopup, formPopup, calcPopup, reviewPopups($), blankPopups($), search($)].join('');

// ----------------------------------------------------------------- CSS
const readCss = (f) => fs.readFileSync(f, 'utf8');
const dot = lookup('https://static.tildacdn.com/tild6163-3064-4564-b862-643738343166/Frame_2.png');
usedAssets.add(dot.webp.at(-1).src);
const FB = (t) => t.replace(/font-family:Inter,Arial,sans-serif/g, 'font-family:Inter,Inter Fallback,Arial,sans-serif').replace(/font-family:'?Inter'?;/g, 'font-family:Inter,Inter Fallback,Arial,sans-serif;').replace(/--t-(headline|text)-font:Inter,Arial,sans-serif/g, '--t-$1-font:Inter,Inter Fallback,Arial,sans-serif');
const embeds = readCss('src/css/embeds.css').replace(/%%DOT%%/g, dot.webp.at(-1).src);
const NL = String.fromCharCode(10);
const critAll = readCss('src/css/fonts.css') + FB([readCss('src/css/base.css'), readCss('src/css/critical.css'), embeds, critZero.join(NL)].join(NL));
const restAll = FB([readCss('src/css/forms.css'), readCss('src/css/components.css'), css.join(NL), extraCss.join(NL)].join(NL));
const tgt = ['chrome110', 'safari16', 'firefox110'];
const critCss = (await esbuild.transform(critAll, { loader: 'css', minify: true, target: tgt })).code;
const minCss = (await esbuild.transform(restAll, { loader: 'css', minify: true, target: tgt })).code;
const CSS_MODE = process.env.CSS_MODE || 'link';
const fullCss = (await esbuild.transform(critAll + NL + restAll, { loader: 'css', minify: true, target: tgt })).code;
const outCss = CSS_MODE === 'async' ? minCss : fullCss;
const cssName = `app.${hash(outCss)}.css`;
fs.writeFileSync(path.join(OUT, 'assets', cssName), BASE ? outCss.replace(/url\((['"]?)\/assets\//g, `url($1${BASE}/assets/`) : outCss);

// ----------------------------------------------------------------- JS
const jsRes = await esbuild.build({
  entryPoints: ['src/js/main.js'], bundle: true, splitting: true, format: 'esm', minify: true, target: ['chrome110', 'safari16', 'firefox110'],
  outdir: path.join(OUT, 'assets'), entryNames: 'app.[hash]', chunkNames: 'chunk.[name].[hash]', write: true, metafile: true, legalComments: 'none',
});
const jsEntry = Object.keys(jsRes.metafile.outputs).find((f) => /app\.[^/]+\.js$/.test(f) && jsRes.metafile.outputs[f].entryPoint);
const jsName = path.basename(jsEntry);

// ----------------------------------------------------------------- head
const ogImage = lookup('https://static.tildacdn.com/tild3235-6362-4338-b632-346162646239/_.jpg');
usedAssets.add(ogImage.webp.at(-1).src);
const logo = lookup('https://static.tildacdn.com/tild6364-3730-4234-b039-643962393136/Layer_2.svg');
const icon = (u) => { const m = lookup(u); if (m) usedAssets.add(m.src); return m ? m.src : ''; };
const ic32l = icon('https://static.tildacdn.com/tild3064-6261-4234-a433-633065396438/32-1.png');
const ic32d = icon('https://static.tildacdn.com/tild3539-6364-4563-b635-383131316562/32-1.png');
const icSvg = icon('https://static.tildacdn.com/tild6366-6462-4930-b765-623636353931/Frame_60.svg');
const icApple = icon('https://static.tildacdn.com/tild3063-3138-4639-b765-316663623732/_.png');
const title = $('title').text();
const descr = $('meta[name=description]').attr('content');
const ld = JSON.parse(fs.readFileSync('data/jsonld.json', 'utf8'))
  .map((o) => JSON.parse(JSON.stringify(o).split('https://static.tildacdn.com/tild6364-3730-4234-b039-643962393136/Layer_2.svg').join(SITE_URL + logo.src)))
  .map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('');
const fontPre = ['inter-cyrillic', 'inter-latin'].map((f) => `<link rel="preload" href="/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join('');
const noindex = process.env.NOINDEX ? '<meta name="robots" content="noindex,nofollow">' : '';

const cssTags = CSS_MODE === 'inline' ? `<style>${fullCss}</style>` : CSS_MODE === 'async'
  ? `<style>${critCss}</style><link rel="stylesheet" href="/assets/${cssName}" media="print" onload="this.media='all';dispatchEvent(new Event('cssload'))"><noscript><link rel="stylesheet" href="/assets/${cssName}"><style>.e[data-fi]{opacity:1!important}.e[data-h0]>.sw{opacity:1!important}</style></noscript>`
  : `<link rel="stylesheet" href="/assets/${cssName}"><noscript><style>.e[data-fi]{opacity:1!important}.e[data-h0]>.sw{opacity:1!important}</style></noscript>`;
const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>(function(e){function f(){e.style.setProperty("--cw",e.clientWidth)}f();addEventListener("resize",f)})(document.documentElement)</script><title>${title}</title><meta name="description" content="${descr}">${noindex}<link rel="canonical" href="${SITE_URL}/"><meta name="format-detection" content="telephone=no"><meta name="theme-color" content="#ffffff">`
  + `<meta property="og:url" content="${SITE_URL}/"><meta property="og:title" content="${$('meta[property="og:title"]').attr('content')}"><meta property="og:description" content="${descr}"><meta property="og:type" content="website"><meta property="og:image" content="${SITE_URL}${ogImage.webp.at(-1).src}"><meta name="twitter:card" content="summary_large_image">`
  + `<link rel="icon" type="image/png" sizes="32x32" href="${ic32l}" media="(prefers-color-scheme: light)"><link rel="icon" type="image/png" sizes="32x32" href="${ic32d}" media="(prefers-color-scheme: dark)"><link rel="icon" type="image/svg+xml" sizes="any" href="${icSvg}"><link rel="apple-touch-icon" href="${icApple}">`
  + `${fontPre}${cssTags}${ld}`;

const body = `<header id="hd">${html.header.join('')}</header><main id="main" class="cq">${html.main.join('')}</main><footer class="cq">${html.footer.join('')}</footer>${popups}${cookie($)}${widget($, widgetForm)}`;
const page = `<!doctype html><html lang="ru"><head>${head}</head><body>${body}<script type="module" src="/assets/${jsName}"></script></body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), BASE ? page.replace(/(["'(,\s])\/assets\//g, `$1${BASE}/assets/`).replace(/href="\/"/g, `href="${BASE}/"`) : page);

// ----------------------------------------------------------------- статика
const fontReport = await subsetFonts(page, path.join(OUT, 'assets/fonts'));
let copied = 0;
for (const a of usedAssets) {
  const src = path.join('public', a);
  if (!fs.existsSync(src)) { console.warn('MISSING asset', a); continue; }
  fs.mkdirSync(path.dirname(path.join(OUT, a)), { recursive: true });
  fs.copyFileSync(src, path.join(OUT, a));
  copied++;
}
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc></url></urlset>\n`);
fs.writeFileSync(path.join(OUT, '_headers'), '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
const kb = (n) => (n / 1024).toFixed(1);
console.log(`critical css ${kb(critCss.length)} KB (inline), rest ${kb(minCss.length)} KB`);
console.log(`fonts: ${fontReport}`);
console.log(`build ok: html ${kb(page.length)} KB, css ${kb(minCss.length)} KB, js ${kb(fs.statSync(path.join(OUT, 'assets', jsName)).size)} KB, assets copied ${copied}`);
