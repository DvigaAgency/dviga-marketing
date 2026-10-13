import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const t = Date.now();
await p.goto('https://dviga.marketing/', { waitUntil: 'networkidle', timeout: 90000 });
console.log('loaded', Date.now() - t, await p.title());
console.log(await p.evaluate(() => document.documentElement.scrollHeight));
await b.close();
