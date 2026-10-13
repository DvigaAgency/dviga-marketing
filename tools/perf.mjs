// Lighthouse (мобильный профиль по умолчанию: эмуляция среднего телефона, 4G). Использование:
//   node tools/perf.mjs <url> <out.json> [runs]
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'node:fs';

const [url, out, runsArg] = process.argv.slice(2);
const runs = +(runsArg || 3);
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
const results = [];
for (let i = 0; i < runs; i++) {
  const r = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error' });
  const a = r.lhr.audits;
  const reqs = a['network-requests'].details.items;
  const sum = (f) => reqs.filter(f).reduce((s, x) => s + (x.transferSize || 0), 0);
  results.push({
    perf: Math.round(r.lhr.categories.performance.score * 100),
    lcp: a['largest-contentful-paint'].numericValue, tbt: a['total-blocking-time'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue, fcp: a['first-contentful-paint'].numericValue, si: a['speed-index'].numericValue,
    requests: reqs.length, bytes: sum(() => true),
    bytesNoVideo: sum((x) => !/\.(mp4|webm)(\?|$)/.test(x.url)),
    js: sum((x) => x.resourceType === 'Script'), css: sum((x) => x.resourceType === 'Stylesheet'),
    img: sum((x) => x.resourceType === 'Image'), font: sum((x) => x.resourceType === 'Font'),
    hosts: [...new Set(reqs.map((x) => new URL(x.url).host))],
  });
  console.log(i + 1, JSON.stringify(results.at(-1)).slice(0, 300));
}
await chrome.kill();
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync(out, JSON.stringify(results, null, 1));
