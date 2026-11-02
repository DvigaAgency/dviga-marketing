// Аккордеон «Частые вопросы» в клонах статей: настройки с живой страницы (tools/faq-config.mjs -> data/articles/faq.json).
// Ответ (запись tab) скрыт, пока не открыт; вопрос (запись q) по клику открывает/закрывает ответ и поворачивает иконку «+».
import fs from 'node:fs';

const FILE = 'data/articles/faq.json';
const AX = 'data/annexx.json';
let cfg; let axCfg;
export function faqFor(path) {
  if (!cfg) cfg = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const m = /^\/blog\/([^/]+)/.exec(path);
  if (!m && !axCfg) axCfg = fs.existsSync(AX) ? JSON.parse(fs.readFileSync(AX, 'utf8')) : {};
  return (m ? cfg[m[1]] : axCfg[path]?.faq) || []; // блог — data/articles/faq.json; страницы услуг — data/annexx.json (tools/annexx-config.mjs)
}

/** html секции записи recId -> с метками аккордеона (если запись — вопрос или ответ) */
export function faqMark(html, recId, list) {
  const a = list.find((x) => x.tab === recId);
  if (a) return html.replace(`<section id="r${recId}" class="r`, `<section id="r${recId}" data-fq class="r fq${a.open ? ' fq-o' : ''}`);
  const q = list.find((x) => x.q === recId);
  if (q) return html.replace(`<section id="r${recId}" class="r`, `<section id="r${recId}" data-fq-t="r${q.tab}" class="r fq-q`);
  return html;
}
