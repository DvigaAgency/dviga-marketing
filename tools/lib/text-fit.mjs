// Правка раскладки Zero-блоков статей: тексты основного контента на десктопе — колонка 760px (left 220), как в правилах вёрстки статей.
// Новые ширины/высоты считает tools/fit-text.mjs (замер в браузере) и кладёт в data/articles/text-fit.json:
//   { "<recId>": { "e": { "<elemId>": { "l": 220, "w": 760, "h": 140, "t": 69 } }, "ab": 560 } }
// Здесь они подставляются в data-атрибуты записи ДО конвертации (только базовый брейкпоинт 1200+; планшет и мобильные не трогаем).
import fs from 'node:fs';

const FILE = 'data/articles/text-fit.json';
let cache;
export function loadFit() {
  if (process.env.NO_FIT === '1') return {};
  if (!cache) cache = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  return cache;
}

const F = { l: 'left', w: 'width', h: 'height', t: 'top' };

/** подставляет замеренные значения в запись (cheerio-объект rec); для брейкпоинта 960 фиксирует прежние значения, чтобы планшет не менялся */
export function applyFit(rec, recId) {
  const fit = loadFit()[recId];
  if (!fit) return;
  for (const [elemId, v] of Object.entries(fit.e || {})) {
    const el = rec.find(`.t396__elem[data-elem-id="${elemId}"]`).first();
    if (!el.length) continue;
    for (const [k, name] of Object.entries(F)) {
      if (v[k] === undefined) continue;
      const base = `data-field-${name}-value`; const t960 = `data-field-${name}-res-960-value`;
      if (el.attr(t960) === undefined && el.attr(base) !== undefined) el.attr(t960, el.attr(base));
      el.attr(base, String(v[k]));
    }
  }
  if (fit.ab) {
    const ab = rec.find('.t396__artboard').first();
    if (ab.attr('data-artboard-height-res-960') === undefined && ab.attr('data-artboard-height') !== undefined) ab.attr('data-artboard-height-res-960', ab.attr('data-artboard-height'));
    ab.attr('data-artboard-height', String(fit.ab));
  }
}

// ---- нормализация отступов и ширины заголовков по брейкпоинтам (замеры tools/fit-gaps.mjs → data/articles/gap-fit.json) ----
const GAP_FILE = 'data/articles/gap-fit.json';
const SCR = [320, 480, 640, 960];
let gapCache;
const gapFit = () => {
  if (process.env.NO_GAP === '1') return {};
  if (!gapCache) gapCache = fs.existsSync(GAP_FILE) ? JSON.parse(fs.readFileSync(GAP_FILE, 'utf8')) : {};
  return gapCache;
};
const attr = (name, bp) => (bp === 1200 ? `data-field-${name}-value` : `data-field-${name}-res-${bp}-value`);
const abAttr = (bp) => (bp === 1200 ? 'data-artboard-height' : `data-artboard-height-res-${bp}`);
const chainOf = (bp) => [bp, ...SCR.filter((s) => s > bp), 1200];
/** задаёт значение на брейкпоинте bp; нижние брейкпоинты, наследовавшие прежнее значение, фиксируются (иначе они «поплывут» вслед за верхним) */
function setBp(el, attrOf, bp, val) {
  const lowers = SCR.filter((s) => s < bp);
  const old = {};
  for (const b of lowers) for (const c of chainOf(b)) { const v = el.attr(attrOf(c)); if (v !== undefined && v !== '') { old[b] = v; break; } }
  el.attr(attrOf(bp), String(val));
  for (const b of lowers) if (el.attr(attrOf(b)) === undefined && old[b] !== undefined) el.attr(attrOf(b), old[b]);
}
export function applyGaps(rec, recId) {
  const g = gapFit()[recId];
  if (!g) return;
  const F2 = { l: 'left', w: 'width', h: 'height', t: 'top' };
  for (const bp of [1200, 960, 640, 480, 320]) {
    const v = g[bp]; if (!v) continue;
    for (const [elemId, vals] of Object.entries(v.e || {})) {
      const el = rec.find(`.t396__elem[data-elem-id="${elemId}"]`).first();
      if (!el.length) continue;
      for (const [k, name] of Object.entries(F2)) if (vals[k] !== undefined) setBp(el, (b) => attr(name, b), bp, vals[k]);
    }
    if (v.ab !== undefined) setBp(rec.find('.t396__artboard').first(), abAttr, bp, v.ab);
  }
}
