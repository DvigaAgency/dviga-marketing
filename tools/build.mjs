// Сборка статической копии главной dviga.marketing: HTML Tilda (выгрузка) -> чистые HTML/CSS/JS в dist/.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { convertZero } from './lib/zero.mjs';
import { picture, cssImage, usedAssets } from './lib/assets.mjs';

const DEV = process.argv.includes('--dev');
const SRC = 'reference/html/home.html';
const OUT = 'dist';

const $ = cheerio.load(fs.readFileSync(SRC, 'utf8'), { decodeEntities: false });

// ----------------------------------------------------------------- контекст конвертации
const ctx = {
  href(h) {
    if (!h) return h;
    if (/^\/(?!\/)/.test(h) && h !== '/') return 'https://dviga.marketing' + h;
    return h;
  },
  picture,
  cssImage,
  eager() { return ctx.eagerRecs.has(ctx.rec); },
  eagerRecs: new Set(),
  textHtml: (h) => h,
  video: (u) => `<video muted loop playsinline preload="none" data-src="${u}"></video>`,
  form: () => '',
};

const regions = {
  header: $('header.t-records > .r').toArray(),
  main: $('#allrecords > .r').toArray(),
  footer: $('footer.t-records > .r').toArray(),
};

ctx.eagerRecs = new Set(['680556230', '1438775181']);
const cssParts = [];
const htmlParts = { header: [], main: [], footer: [] };
const stats = [];
for (const [name, list] of Object.entries(regions)) {
  for (const node of list) {
    const rec = $(node);
    const type = rec.attr('data-record-type');
    if (type !== '396') continue;
    const r = convertZero($, rec, ctx);
    htmlParts[name].push(r.html);
    cssParts.push(r.css);
    stats.push([name, r.id, r.elems]);
  }
}

const base = fs.readFileSync('src/css/fonts.css', 'utf8') + fs.readFileSync('src/css/base.css', 'utf8');
fs.cpSync('public', OUT, { recursive: true });
const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dviga</title><style>${base}\n${cssParts.join('\n')}</style></head><body>
<header class="cq">${htmlParts.header.join('')}</header><main class="cq">${htmlParts.main.join('')}</main><footer class="cq">${htmlParts.footer.join('')}</footer></body></html>`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), page);
console.log('blocks', stats.length, 'html KB', (page.length / 1024).toFixed(0), DEV ? '(dev)' : '');
