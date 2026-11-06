// Проверка AI-помощника в Node: node tools/ai-test.mjs [файл базы] — прогоняет типовые вопросы и печатает вид ответа (для ручного разбора качества).
// Без аргумента строит базу заново из снимков страниц.
import fs from 'node:fs';
import { createAssistant } from '../src/js/ai-engine.js';
import { PAGES } from './pages.mjs';
import { buildAiIndex } from './lib/ai-index.mjs';

const data = JSON.parse(process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : buildAiIndex(PAGES).json);
const QUERIES = fs.existsSync('tools/ai-queries.txt') ? fs.readFileSync('tools/ai-queries.txt', 'utf8').split('\n').map((s) => s.trim()).filter(Boolean) : [];
const as = createAssistant(data);
for (const q of QUERIES) {
  if (q === '---') { as.reset(); console.log('— новый диалог —'); continue; }
  const r = as.ask(q);
  const head = r.title ? `«${r.title}» ` : '';
  console.log(`\n? ${q}\n  [${r.kind}] ${head}${(r.text[0] || '').slice(0, 150)}`);
  if (r.bullets) console.log('  • ' + r.bullets.map((b) => b.slice(0, 80)).join(' | '));
  if (r.table) console.log('  таблица:', r.table.length, 'строк');
  if (r.cards) console.log('  карточки:', r.cards.map((c) => `${c.k}: ${c.t.slice(0, 50)}`).join(' | '));
  if (r.contacts) console.log('  контакты:', r.contacts.map((c) => c[1]).join(' | '));
}
