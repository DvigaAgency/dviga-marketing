// Удаляет из public/assets/img файлы, которые не попали в dist (лишние варианты ширин). Восстанавливаются командой npm run assets.
import fs from 'node:fs';
import path from 'node:path';
const used = new Set(fs.readdirSync('dist/assets/img'));
let n = 0; let bytes = 0;
for (const f of fs.readdirSync('public/assets/img')) {
  if (used.has(f)) continue;
  const p = path.join('public/assets/img', f);
  bytes += fs.statSync(p).size; fs.unlinkSync(p); n++;
}
console.log('удалено файлов:', n, 'МБ:', (bytes / 1e6).toFixed(1));
