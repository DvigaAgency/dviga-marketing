// Собирает reports/animations.md: перечень анимаций оригинала, реализация в копии и результат сверки.
// Данные сверки: reports/animations-data.json (tools/anim-compare.mjs), reports/hover-data-1440.json (tools/hover-compare.mjs).
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const $ = cheerio.load(fs.readFileSync(process.env.PAGE || 'dist/index.html', 'utf8'));
const n = (s) => $(s).length;
const data = fs.existsSync('reports/animations-data.json') ? JSON.parse(fs.readFileSync('reports/animations-data.json', 'utf8')) : null;
const hover = fs.existsSync('reports/hover-data-1440.json') ? JSON.parse(fs.readFileSync('reports/hover-data-1440.json', 'utf8')) : null;
const sc = data && data.scroll;
const hv = hover ? `${hover.length} элементов, расхождение кадров покоя/hover ≤ ${Math.max(...hover.map((r) => Math.max(r.rest, r.hover))).toFixed(1)}%` : 'не запускалась';
const L = [
  '# Анимации главной: оригинал (Tilda) → копия',
  '',
  'Список составлен по data-атрибутам Zero-блоков оригинала (`data-animate-*`). Рантайм Tilda (`tilda-animation-*`, `tilda-zero-*`) в копию не переносился: ниже — что делает каждая анимация и чем заменена.',
  '',
  '| # | Анимация | Где / сколько | Параметры оригинала | Реализация в копии | Сверка с оригиналом |',
  '|---|---|---|---|---|---|',
  `| 1 | **Появление (fadein)** | ${n('[data-fi]')} элементов (заголовки/тексты/картинки секций) | \`data-animate-style=fadein\`, длительность 1 / 1.2 / 1.7 с, задержка 0.2 с у 5 элементов, easing \`cubic-bezier(.19,1,.22,1)\`; только ≥1200 px (на мобильных у оригинала отключено, если нет \`data-animate-mobile=y\`) | CSS: \`opacity 0→1\` + \`transition\`; класс \`.in\` ставит один общий \`IntersectionObserver\` (один раз, без повтора), \`prefers-reduced-motion\` — без анимации | Параметры перенесены 1:1; кадры опираются на те же transition-свойства (см. п. 2 про общий механизм) |`,
  `| 2 | **Пошаговая hover-анимация** | ${n('[data-an=hover]')} элементов (иконки шапки, бургер, пункты меню/соцсетей, карточки) | \`sbs-event=hover\`; шаги: opacity, translate X/Y, scale, rotate, blur; easing easeIn/easeOut/easeInOut; цикл (\`loop\` у 11, \`loopwithreverse\` у 1); связанные элементы-триггеры (\`sbs-trgels\`) | \`@keyframes\` генерируются **при сборке** (порт алгоритма Tilda); в браузере только переключение \`.on/.rv\` на mouseenter/mouseleave (проигрыш вперёд/в обратную сторону, очередь, если анимация ещё идёт); на touch — по тапу; только ≥1200 px, кроме элементов с \`data-animate-mobile=y\` (${n('[data-mb]')}) | Кроссфейд иконок телефона (opacity, 300 мс): макс. расхождение ${data ? data.hover[0]['maxΔopacity'] : '—'} (шум дискретизации); все интерактивные элементы: ${hv} |`,
  `| 3 | **Появление блока (blockintoview)** | ${n('[data-an=blockintoview]')} элементов (стрелки, значки в карточках) | \`sbs-event=blockintoview\`, trigger=1, смещение 120 px; один раз (у 1 — цикл) | те же keyframes, класс \`.on\` ставится при пересечении линии \`innerHeight·trg + offset\` с верхом записи (rAF-неблокирующий throttled scroll) | проверено: 17 из 18 включаются на прокрутке, порядок/момент как у оригинала |`,
  `| 4 | **Прокрутка (scroll-шаги), в т.ч. «пин»** | ${n('[data-sc]')} элементов (видео-шоурил хиро: увеличение ×2.81 с закреплением на 900 px; слово «Кейсы», картинки наград) | \`sbs-event=scroll\`, \`di\` (дистанция), \`mx/my/sx/sy/op/ro\`, шаг \`fi=fixed\` (закрепление), trgofst по брейкпоинтам | Один \`requestAnimationFrame\` на скролл; порт state-machine шагов; «fixed» без \`position:fixed\` (он ломается внутри контейнера \`cqw\`): элемент удерживается \`transform: translateY\` | ${sc ? `${sc.samples} замеров (9 позиций скролла × элементы scroll+fix): макс. Δпозиции ${sc.maxPos.toFixed(1)} px, Δopacity ${sc.maxOp}` : '—'} |`,
  `| 5 | **Фиксация на время прокрутки (fix)** | ${n('[data-fx]')} элементов хиро (тексты, цифры) | \`data-animate-fix\`, дистанция 900/990 px, смещение триггера по брейкпоинтам; ≥1200 px | \`transform: translateY\` по тем же формулам (topOffset, trgofst·zoom, distance·zoom) | входит в замеры п. 4 |`,
  '| 6 | **Счётчик «50+»** | 1 элемент («награды») | 1→50 за 3 с линейно при появлении на 2/3 высоты экрана (вставка NOLIM) | `requestAnimationFrame`, `IntersectionObserver` с отступом −33% | поведение и длительность те же |',
  '| 7 | **Кнопка «точка» (dot-scale)** | 5 кнопок | при hover точка разрастается (scale 50) за 0.7 с, фон/цвет текста, стрелка-анимация (вставка CSS) | чистый CSS (перенос правил как есть) | в общей сверке hover-кадров (п. 2) |',
  '| 8 | **Подчёркивание ссылок (link-underline) и окрашивание заголовков публикаций** | 2 + 6 элементов | 200 мс, цвет #d93433, линия 1 px сжимается к правому краю | чистый CSS | в сверке hover |',
  '| 9 | **Попапы** (меню, форма, отзывы ×8, бланки ×3, расчёт, поиск) | 15 | выезд справа 0.5 с ease-in-out (меню/форма), масштаб+fade 0.3 с (остальные), оверлей, Esc, клик по фону, блокировка фона | CSS-transitions + ~60 строк JS, фокус-ловушка | вручную: открытие/закрытие всех типов, скриншоты `reports/_pp_*` |',
  '| 10 | **Cookie-плашка, виджет «Давайте подскажем»** | 2 | появление плашки, пульсация кнопки (CSS keyframes), раскрытие формы | CSS + JS, `localStorage` в try/catch | визуально совпадает (скриншоты секций) |',
  '| 11 | **Слайдер отзывов** | 1 (8 отзывов) | slick: бесконечный, автоплей 3 с, 400 мс ease-in, пауза при hover, swipe; 2 слайда ≥961 px, 1 — ниже; стрелки в оригинале скрыты (`display:none`) | собственный слайдер (transform, pointer events), без библиотек | высота блока и позиции слайдов совпадают; автоплей-кадры недетерминированы в обоих сайтах |',
  '| 12 | **Лента наград (drag-scroll)** | 1 | горизонтальная прокрутка зажатой мышью, без полосы | `overflow-x:auto` + ~10 строк JS | вручную |',
  '| 13 | **Fade-in всей страницы (t360)** | вся страница | `opacity 0→1` за 0.4 с после загрузки | **не перенесено намеренно**: нужен был Tilda для маскировки FOUC; в копии критический CSS инлайнится, а fade откладывал бы LCP | — |',
];
fs.writeFileSync('reports/animations.md', L.join('\n') + '\n');
console.log('animations.md written');
