// Скачивает английскую главную (en.dviga.marketing, проект Tilda 85434) и кладёт урезанный снимок в data/en/home.source.html.
// Сеть: curl (Node fetch в этой среде наружу не ходит); прокси берётся из HTTPS_PROXY. Запуск: node tools/fetch-en.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { trim } from './trim-html.mjs';
const curl = fs.existsSync('C:/Program Files/Git/mingw64/bin/curl.exe') ? 'C:/Program Files/Git/mingw64/bin/curl.exe' : 'curl';
const url = process.argv[2] || 'https://en.dviga.marketing/';
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const args = ['-sS', '--ssl-no-revoke', '-L', '-m', '90', '-A', 'Mozilla/5.0', ...(proxy ? ['-x', proxy] : []), url];
const html = execFileSync(curl, args, { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
if (!/id="allrecords"/.test(html)) throw new Error('в ответе нет #allrecords: ' + url);
fs.mkdirSync('data/en', { recursive: true });
fs.writeFileSync('data/en/home.source.html', trim(html));
console.log('data/en/home.source.html', (html.length / 1024).toFixed(0), 'КБ ->', (fs.statSync('data/en/home.source.html').size / 1024).toFixed(0), 'КБ');
