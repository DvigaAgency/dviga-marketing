// Урезает шрифты Inter (variable wght, woff2 из Google Fonts, src/fonts/) до символов, реально используемых на странице
// (+ ASCII и частая типографика на случай правок текстов). Ось wght сохраняется.
// Вызывается из tools/build.mjs; отдельно: node tools/subset-fonts.mjs dist/index.html dist/assets/fonts
import subsetFont from 'subset-font';
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function subsetFonts(html, outDir) {
  const $ = cheerio.load(html);
  $('script,style').remove();
  let text = $('body').text() + $('[placeholder]').map((i, e) => $(e).attr('placeholder')).get().join('') + $('[aria-label]').map((i, e) => $(e).attr('aria-label')).get().join('');
  for (let c = 0x20; c <= 0x7e; c++) text += String.fromCharCode(c);
  text += '«»—–−…№₽€©®™°×·•↗→←↑↓\u00a0\u2009\u202f\u2011';
  const chars = new Set(text);
  const pick = (re) => [...chars].filter((c) => re.test(c)).join('');
  const jobs = [
    ['inter-latin', pick(/[\u0000-\u024f\u2000-\u206f\u20a0-\u20bf\u2100-\u2122\u2190-\u2193\u2212\u2215]/u)],
    ['inter-cyrillic', pick(/[\u0400-\u04ff\u2116\u0301]/u)],
  ];
  fs.mkdirSync(outDir, { recursive: true });
  const report = [];
  for (const [name, chs] of jobs) {
    const src = fs.readFileSync(`src/fonts/${name}.woff2`);
    const out = await subsetFont(src, chs, { targetFormat: 'woff2' });
    fs.writeFileSync(path.join(outDir, `${name}.woff2`), out);
    report.push(`${name} ${(src.length / 1024).toFixed(1)}→${(out.length / 1024).toFixed(1)} КБ`);
  }
  return report.join(', ');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(await subsetFonts(fs.readFileSync(process.argv[2] || 'dist/index.html', 'utf8'), process.argv[3] || 'dist/assets/fonts'));
}
