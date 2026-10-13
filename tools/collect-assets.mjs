// Собирает список URL ассетов Tilda, которые используются на главной (из выгруженного HTML).
import fs from 'node:fs';
const t = fs.readFileSync('reference/html/home.html', 'utf8');
const re = /https?:\/\/[a-z0-9.-]*(?:tildacdn\.com|tilda\.ws|tilda\.cc)[^\s"')<>\x5c]*/gi;
const all = [...new Set(t.match(re))].map((u) => u.replace(/&amp;/g, '&'));
const byHost = {};
for (const u of all) { const h = new URL(u).host; byHost[h] = (byHost[h] || 0) + 1; }
console.log(all.length, byHost);
const media = all.filter((u) => /static\.tildacdn\.com\/(tild|vide|lib|img)/.test(u));
const ext = {};
for (const u of media) { const e = (u.split('?')[0].match(/\.([a-z0-9]+)$/i) || [, 'none'])[1].toLowerCase(); ext[e] = (ext[e] || 0) + 1; }
console.log('media', media.length, ext);
console.log('NOT media:\n' + all.filter((u) => !media.includes(u)).join('\n'));
fs.writeFileSync('data/assets-raw.json', JSON.stringify(all, null, 1));
