// Виджеты T1370 (HTML-вставка со своей разметкой, стилями и скриптом): конструктор политики конфиденциальности, квиз по тарифам Tilda, UTM-генератор.
// Каждый виджет самодостаточен (inline-<style> и inline-<script>, без сети), поэтому запись выводится как есть, без обёртки Tilda.
// Скрипты оригинала в снимок страницы не попадают (trim-html их вырезает) — их берёт data/articles/embeds.json (tools/embeds.mjs), собранный с живой страницы.
import fs from 'node:fs';

const FILE = 'data/articles/embeds.json';
let store;

export function embedBlock($, rec, { localUrls }) {
  if (!store) store = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const id = rec.attr('id').replace('rec', '');
  const raw = store[id];
  const c = $(rec.toString());
  c.find('script').remove();
  const style = c.find('style').map((i, e) => $(e).html()).get().join('\n');
  c.find('style').remove();
  const html = localUrls(c.html()).replace(/\bt-rec\b/g, 'emb-rec');
  const script = raw && raw.script ? `<script>${raw.script.replace(/<\/script/gi, '<\\/script')}</script>` : '';
  return { id, css: localUrls(style), html: `<section id="r${id}" class="r emb">${html}${script}</section>` };
}
