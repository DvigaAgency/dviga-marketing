// Собирает reports/baseline.md (оригинал) и reports/perf.md (оригинал vs копия) из результатов tools/perf.mjs.
//   node tools/perf.mjs https://dviga.marketing/ reports/baseline-lh.json 3
//   node tools/perf.mjs http://localhost:4173/    reports/copy-lh.json 3
//   node tools/perf-report.mjs
import fs from 'node:fs';

const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const load = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const base = load('reports/baseline-lh.json');
const copy = load('reports/copy-lh.json');
const m = (r, k) => med(r.map((x) => x[k]));
const kb = (n) => `${(n / 1024).toFixed(0)} КБ`;
const s = (n) => `${(n / 1000).toFixed(2)} с`;
const row = (name, f) => `| ${name} | ${base ? f(base) : '—'} | ${copy ? f(copy) : '—'} |`;

const lines = [
  '# Скорость: оригинал vs копия',
  '',
  'Lighthouse (мобильный профиль по умолчанию: эмуляция среднего телефона, 4G), главная страница, медиана из 3 прогонов. Видео-ролики в метрику веса не входят (в Lighthouse-прогоне они не загружаются: `preload=none`; у оригинала показреел ещё и недоступен из тестовой сети).',
  '',
  '| метрика | оригинал | копия |',
  '|---|---|---|',
  row('Performance (0–100)', (r) => m(r, 'perf')),
  row('LCP', (r) => s(m(r, 'lcp'))),
  row('FCP', (r) => s(m(r, 'fcp'))),
  row('TBT', (r) => `${Math.round(m(r, 'tbt'))} мс`),
  row('CLS', (r) => m(r, 'cls').toFixed(3)),
  row('Speed Index', (r) => s(m(r, 'si'))),
  row('Запросов', (r) => m(r, 'requests')),
  row('Вес первой загрузки (без видео)', (r) => kb(m(r, 'bytesNoVideo'))),
  row('JS', (r) => kb(m(r, 'js'))),
  row('CSS', (r) => kb(m(r, 'css'))),
  row('Изображения', (r) => kb(m(r, 'img'))),
  row('Шрифты', (r) => kb(m(r, 'font'))),
  '',
  `Хосты запросов оригинала: ${base ? base[0].hosts.join(', ') : '—'}`,
  `Хосты запросов копии: ${copy ? copy[0].hosts.join(', ') : '—'}`,
  '',
  'Отдельные прогоны (Performance): оригинал ' + (base ? base.map((x) => x.perf).join(' / ') : '—') + '; копия ' + (copy ? copy.map((x) => x.perf).join(' / ') : '—'),
];
fs.writeFileSync('reports/perf.md', lines.join('\n') + '\n');
if (base) {
  const b = [
    '# Базовые замеры оригинала (dviga.marketing, Tilda)',
    '',
    `Lighthouse, мобильный профиль (эмуляция телефона + 4G), 3 прогона, медиана. Снято ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '| метрика | значение |', '|---|---|',
    `| Performance | ${m(base, 'perf')} (прогоны: ${base.map((x) => x.perf).join(', ')}) |`,
    `| LCP | ${s(m(base, 'lcp'))} |`, `| FCP | ${s(m(base, 'fcp'))} |`, `| TBT | ${Math.round(m(base, 'tbt'))} мс |`, `| CLS | ${m(base, 'cls').toFixed(3)} |`,
    `| Speed Index | ${s(m(base, 'si'))} |`, `| Запросов | ${m(base, 'requests')} |`, `| Вес | ${kb(m(base, 'bytes'))} |`,
    `| JS | ${kb(m(base, 'js'))} |`, `| CSS | ${kb(m(base, 'css'))} |`, `| Изображения | ${kb(m(base, 'img'))} |`, `| Шрифты | ${kb(m(base, 'font'))} |`,
    '', `Хосты: ${base[0].hosts.join(', ')}`,
  ];
  fs.writeFileSync('reports/baseline.md', b.join('\n') + '\n');
}
console.log(lines.slice(4, 18).join('\n'));
