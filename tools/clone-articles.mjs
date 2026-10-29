// Клонирует статьи блога dviga.marketing: снимок страницы -> data/pages/blog__<slug>.html (дальше его собирает tools/build.mjs).
// Список — data/articles/clones.json. В блоке «Свежие статьи» карточки заменяются на клонированные статьи
// (ссылки, не ведущие на копию, не остаются): сохраняем те из оригинальных трёх, что есть в копии, остальные добираем
// из той же темы, затем из остальных. Карточки (обложка, категории, время) берутся из листинга блога (data/pages/blog.html).
//
// Запуск:  node tools/clone-articles.mjs            — скачать и собрать все статьи из clones.json (topics) + заменить «Свежие статьи» в уже клонированных (existing)
//          node tools/clone-articles.mjs <slug>…   — только указанные
// Сеть: node fetch не ходит через прокси этой среды — страницы качаются через curl.
// «existing» (кроме статьи про Битрикс) правятся на месте (повторный запуск — после `git checkout data/pages/blog__<slug>.html`); статья про Битрикс
// собирается article-snapshot.mjs, её «Свежие статьи» выбраны по ТЗ (поле fresh в data/articles/plyusy-i-minusy-sayta-na-bitrix.json) и не меняются.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as cheerio from 'cheerio';
import { trim } from './trim-html.mjs';
import { fillFresh } from './lib/fresh-articles.mjs';
import { BPS, eff, parseRow } from './lib/blog-pin.mjs';

const cfg = JSON.parse(fs.readFileSync('data/articles/clones.json', 'utf8'));
const topicOf = { ...cfg.existing };
for (const [t, list] of Object.entries(cfg.topics)) for (const s of list) topicOf[s] = t;
const cloned = Object.keys(topicOf);
const order = [...Object.values(cfg.topics).flat(), ...Object.keys(cfg.existing)];
const listingSlug = (s) => cfg.listing[s] || s;
const ALIAS = { 'skolko-stoit-sdelat-sajt-na-tilde-v-2025-ceny': 'skolko-stoit-sdelat-sajt-na-tilde-v-2026-ceny' };
const norm = (s) => ALIAS[s] || s;

const $l = cheerio.load(fs.readFileSync('data/pages/blog.html', 'utf8'), { decodeEntities: false });

function get(url) {
  for (let k = 0; k < 4; k++) {
    const r = spawnSync('curl', ['-sS', '-L', '-m', '90', '--fail', url], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    if (r.status === 0 && r.stdout.length > 50000) return r.stdout;
  }
  throw new Error('не удалось скачать ' + url);
}

const hasImage = ($, shapes) => shapes.filter((j, e) => $(e).find('.tn-atom[data-original], .tn-atom[style*="url("]').length);

/** запись «Свежие статьи» — последний Zero-блок основной части с тремя карточками (картинка + ссылка на статью блога) */
function findFresh($) {
  const recs = $('#allrecords > .r[data-record-type="396"], #allrecords > .r[data-alias-record-type="396"]').toArray().map((n) => $(n));
  for (const r of recs.reverse()) {
    const imgs = hasImage($, r.find('.t396__elem[data-elem-type="shape"]'));
    const hrefs = new Set(r.find('.t396__elem a[href*="/blog/"]').map((i, a) => $(a).attr('href').replace(/^https:\/\/dviga\.marketing/, '')).get());
    if (imgs.length === 3 && hrefs.size >= 3) return r;
  }
  return null;
}

function currentFresh($, rec) {
  const out = [];
  rec.find('.t396__elem a[href*="/blog/"]').each((i, a) => {
    const href = $(a).attr('href').replace(/^https:\/\/dviga\.marketing/, '');
    const slug = norm(href.replace(/^\/blog\//, '').replace(/\/$/, ''));
    const title = $(a).text().replace(/\s+/g, ' ').trim();
    let o = out.find((x) => x.slug === slug);
    if (!o) out.push((o = { slug, title: '' }));
    if (title && !o.title) o.title = title;
  });
  return out;
}

/** 3 статьи для блока: оригинальные из копии + добор из той же темы, затем из остальных */
function pick(self, orig) {
  const topic = topicOf[self];
  const keep = orig.map((o) => o.slug).filter((s) => s !== self && cloned.includes(s));
  const res = [...new Set(keep)].slice(0, 3);
  const i = order.indexOf(self);
  const rot = [...order.slice(i + 1), ...order.slice(0, i)]; // по кругу от текущей: у соседей наборы разные
  for (const pool of [rot.filter((s) => topicOf[s] === topic), rot]) {
    for (const s of pool) { if (res.length >= 3) break; if (s !== self && !res.includes(s)) res.push(s); }
  }
  return res;
}

export function swapFresh($, self) {
  const rec = findFresh($);
  if (!rec) throw new Error(`${self}: блок «Свежие статьи» не найден`);
  const orig = currentFresh($, rec);
  const slugs = pick(self, orig);
  const titles = Object.fromEntries(orig.map((o) => [o.slug, o.title]));
  const items = slugs.map((s) => {
    const a = $l(`a[href$="/blog/${listingSlug(s)}"]`).first();
    if (!a.length) throw new Error(`${self}: в листинге нет ${s}`);
    return { slug: s, listing: listingSlug(s), href: `/blog/${s}`, title: titles[s] || a.text().replace(/\s+/g, ' ').trim() };
  });
  fillFresh($, $l, rec.attr('id').replace('rec', ''), items);
  return { orig: orig.map((o) => o.slug), now: slugs };
}

const args = process.argv.slice(2);
const todo = args.length ? args : [...Object.values(cfg.topics).flat(), ...Object.keys(cfg.existing).filter((s) => s !== 'plyusy-i-minusy-sayta-na-bitrix')];
const report = {};
for (const slug of todo) {
  if (!topicOf[slug]) throw new Error('нет в clones.json: ' + slug);
  const file = `data/pages/blog__${slug}.html`;
  const inPlace = slug in cfg.existing;
  const html = inPlace ? fs.readFileSync(file, 'utf8') : trim(get(`https://dviga.marketing/blog/${slug}`));
  const $ = cheerio.load(html, { decodeEntities: false });
  const r = swapFresh($, slug);
  fs.writeFileSync(file, $.html());
  report[slug] = r;
  console.log(slug.padEnd(80), (fs.statSync(file).size / 1024).toFixed(0).padStart(5), 'КБ  свежие:', r.now.map((s) => s.slice(0, 22)).join(' | '), r.orig.every((s) => r.now.includes(s)) ? '' : '(часть заменена)');
}
// статья про Битрикс (article-snapshot.mjs): «Свежие статьи» выбраны по ТЗ (data/articles/<slug>.json → fresh) — не трогаем, только проверяем, что все три есть в копии
const b = 'plyusy-i-minusy-sayta-na-bitrix';
if (!args.length || args.includes(b)) {
  const miss = JSON.parse(fs.readFileSync(`data/articles/${b}.json`, 'utf8')).fresh.filter((f) => !cloned.includes(f.slug)).map((f) => f.slug);
  console.log(b.padEnd(80), miss.length ? 'НЕ клонированы: ' + miss.join(', ') : 'fresh по ТЗ — все три статьи есть в копии');
}
