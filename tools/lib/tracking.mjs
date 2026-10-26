// Счётчики и приём заявок — как на оригинале dviga.marketing (проект Tilda 8290193):
// Яндекс.Метрика 36522530, коллтрекинг calltracking.ru / i-media (проект 13560), заявки в Битрикс24.
// Значения по умолчанию — боевые; переопределяются переменными сборки, 0/off отключает.
//   YM_ID       счётчик Метрики (по умолчанию 36522530)
//   CT_PROJECT  проект коллтрекинга (по умолчанию 13560), CT_SCRIPT — код скрипта (по умолчанию a0e70)
//   LEAD_URL    куда формы отправляют заявки (по умолчанию /api/lead; для GitHub Pages — адрес воркера server/lead-worker.js)
const val = (name, def) => {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return /^(0|off|no|false)$/i.test(v) ? '' : v;
};

export const YM_ID = val('YM_ID', '36522530');
export const CT_PROJECT = val('CT_PROJECT', '13560');
export const CT_SCRIPT = val('CT_SCRIPT', 'a0e70');
export const LEAD_URL = process.env.LEAD_URL || '/api/lead';

export const leadMeta = () => `<meta name="lead-url" content="${LEAD_URL.replace(/"/g, '&quot;')}">`;

// Метрика грузится через 2 секунды после загрузки, как в оригинале (не мешает LCP); параметры init — те же, что у оригинала
const metrika = () => (YM_ID
  ? `<script>setTimeout(function(){(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");window.mainMetrikaId='${YM_ID}';ym('${YM_ID}',"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});},2000);</script><noscript><div><img src="https://mc.yandex.ru/watch/${YM_ID}" style="position:absolute;left:-9999px" alt=""></div></noscript>`
  : '');

// скрипт подмены номера (кэшируется на 5 минут, как у оригинала) и пиксель для посетителей без JS
const calltracking = () => (CT_PROJECT
  ? `<script>(function(){var s=document.createElement('script');s.async=true;s.src='https://cc.calltracking.ru/phone.${CT_SCRIPT}.${CT_PROJECT}.async.js?nc='+Math.floor(new Date().getTime()/300000);document.head.appendChild(s)})()</script><noscript><img height="1" width="1" style="display:none" src="https://webhooks.i-media.ru/ct_alt_hook.php?pr=${CT_PROJECT}&amp;type=nojs&amp;ref=%2F" alt=""></noscript>`
  : '');

export const trackingTags = () => metrika() + calltracking();
