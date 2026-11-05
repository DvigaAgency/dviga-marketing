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
    const r = spawnSync('curl', ['-sS', '--ssl-no-revoke', '-L', '-m', '90', '--fail', url], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
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
    if (!o) out.push((o = { slug, title: '', left: Infinity, top: Infinity }));
    if (title && !o.title) o.title = title;
    const el = $(a).closest('.t396__elem'); const l = parseFloat(el.attr('data-field-left-value')); const t = parseFloat(el.attr('data-field-top-value'));
    if (l < o.left || (l === o.left && t < o.top)) { o.left = l; o.top = t; }
  });
  // порядок карточек — по положению на экране (слева направо), а не по порядку элементов в разметке Tilda: он может не совпадать
  return out.sort((x, y) => (x.left - y.left) || (x.top - y.top));
}

/** «Свежие статьи» остаются как на оригинале: те же три карточки в том же порядке, с той же вёрсткой на всех брейкпоинтах (ссылки на статьи копии подставляет сборка).
 *  Раньше карточки подменялись статьями из копии — из-за этого путался порядок, отступы на мобильных и переносы тегов. Возвращаем список статей оригинала в порядке слотов
 *  (слева направо) и те из них, которых ещё нет в копии (их нужно добавить в clones.json и склонировать — иначе ссылка ведёт на оригинал). */
export function swapFresh($, self) {
  const rec = findFresh($);
  if (!rec) throw new Error(`${self}: блок «Свежие статьи» не найден`);
  const orig = currentFresh($, rec).map((o) => o.slug);
  return { orig, now: orig, missing: orig.filter((s) => s !== self && !cloned.includes(s)) };
}

const args = process.argv.slice(2);
const todo = args.length ? args : [...Object.values(cfg.topics).flat(), ...Object.keys(cfg.existing).filter((s) => s !== 'plyusy-i-minusy-sayta-na-bitrix')];
const report = {};
for (const slug of todo) {
  if (!topicOf[slug]) throw new Error('нет в clones.json: ' + slug);
  const file = `data/pages/blog__${slug}.html`;
  const html = trim(get(`https://dviga.marketing/blog/${slug}`));
  const $ = cheerio.load(html, { decodeEntities: false });
  const r = swapFresh($, slug);
  fs.writeFileSync(file, $.html());
  report[slug] = r;
  console.log(slug.padEnd(80), (fs.statSync(file).size / 1024).toFixed(0).padStart(5), 'КБ  свежие:', r.now.map((s) => s.slice(0, 22)).join(' | '), r.missing.length ? 'НЕТ В КОПИИ: ' + r.missing.join(', ') : '');
}
// статья про Битрикс (article-snapshot.mjs): «Свежие статьи» выбраны по ТЗ (data/articles/<slug>.json → fresh) — не трогаем, только проверяем, что все три есть в копии
const b = 'plyusy-i-minusy-sayta-na-bitrix';
if (!args.length || args.includes(b)) {
  const miss = JSON.parse(fs.readFileSync(`data/articles/${b}.json`, 'utf8')).fresh.filter((f) => !cloned.includes(f.slug)).map((f) => f.slug);
  console.log(b.padEnd(80), miss.length ? 'НЕ клонированы: ' + miss.join(', ') : 'fresh по ТЗ — все три статьи есть в копии');
}
