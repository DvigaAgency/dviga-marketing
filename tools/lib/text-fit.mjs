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
