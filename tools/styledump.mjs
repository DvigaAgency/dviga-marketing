// Отладочный инструмент: дамп вычисленных стилей поддерева на живом сайте.
// node tools/styledump.mjs <selector> [width] [--click=<selector>] [--url=...]
import { chromium } from 'playwright';
const sel = process.argv[2]; const w = +(process.argv[3] || 1440);
const click = (process.argv.find((a) => a.startsWith('--click=')) || '').slice(8);
const url = (process.argv.find((a) => a.startsWith('--url=')) || '--url=https://dviga.marketing/').slice(6);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: w, height: 900 } });
await p.goto(url, { waitUntil: 'networkidle', timeout: 120000 }); await p.waitForTimeout(1500);
if (click) { await p.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); e.click(); }, click); await p.waitForTimeout(1500); }
const out = await p.evaluate((sel) => {
  const root = document.querySelector(sel); if (!root) return 'NOT FOUND';
  const props = ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'minHeight', 'maxWidth', 'margin', 'padding', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'textAlign', 'color', 'backgroundColor', 'backgroundImage', 'borderRadius', 'border', 'boxShadow', 'zIndex', 'opacity', 'transform', 'transition', 'flexDirection', 'alignItems', 'justifyContent', 'overflow', 'verticalAlign', 'backdropFilter', 'cursor', 'boxSizing'];
  const def = {};
  const lines = [];
  const walk = (e, depth) => {
    if (depth > 7 || ['SCRIPT', 'STYLE'].includes(e.tagName)) return;
    const cs = getComputedStyle(e); const o = [];
    for (const p of props) { const v = cs[p]; if (v && !['none', 'normal', 'auto', '0px', 'static', 'visible', 'start', 'rgba(0, 0, 0, 0)', 'baseline', '0', '1', 'row', 'stretch', 'inline', 'content-box', 'initial', 'scroll', 'running'].includes(v) && !/^0px 0px 0px 0px$|^all 0s ease 0s$|^none 0s ease 0s$/.test(v)) o.push(p + ':' + v.replace(/\s+/g, ' ')); }
    const r = e.getBoundingClientRect();
    lines.push('  '.repeat(depth) + e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + ' [' + [r.x, r.y, r.width, r.height].map((n) => Math.round(n)).join(',') + '] ' + o.join('; '));
    [...e.children].forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0); return lines.join('\n');
}, sel);
console.log(out.slice(0, +(process.env.MAX || 12000)));
await b.close();
