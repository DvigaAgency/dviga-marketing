// Блок с кодом T264 (запись типа 285) в статье блога: серая плашка #f8f8f8 в колонке текста. Подсвеченную разметку (highlight.js на оригинале рисуется скриптом в браузере)
// берём из data/articles/code-blocks.json (tools/code-blocks.mjs); если её нет — код без подсветки.
import fs from 'node:fs';
import { recPadding } from './zero.mjs';

const FILE = 'data/articles/code-blocks.json';
let hl;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function codeBlock($, rec) {
  if (!hl) hl = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const id = rec.attr('id').replace('rec', '');
  const code = hl[id] ?? esc(rec.find('code').first().text());
  return { id, css: recPadding(rec.attr('class') || '', id), html: `<section id="r${id}" class="r ar ar-cdb"><div class="ar-c"><div class="ar-cd"><pre><code>${code}</code></pre></div></div></section>` };
}
