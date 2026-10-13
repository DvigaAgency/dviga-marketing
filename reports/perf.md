# Скорость: оригинал vs копия

Lighthouse (мобильный профиль по умолчанию: эмуляция среднего телефона, 4G), главная страница, медиана из 3 прогонов. Видео-ролики в метрику веса не входят (в Lighthouse-прогоне они не загружаются: `preload=none`; у оригинала показреел ещё и недоступен из тестовой сети).

| метрика | оригинал | копия |
|---|---|---|
| Performance (0–100) | 62 | 98 |
| LCP | 7.63 с | 1.88 с |
| FCP | 4.92 с | 1.20 с |
| TBT | 123 мс | 41 мс |
| CLS | 0.000 | 0.000 |
| Speed Index | 5.22 с | 3.60 с |
| Запросов | 161 | 33 |
| Вес первой загрузки (без видео) | 1389 КБ | 336 КБ |
| JS | 400 КБ | 4 КБ |
| CSS | 46 КБ | 32 КБ |
| Изображения | 536 КБ | 235 КБ |
| Шрифты | 235 КБ | 43 КБ |

Хосты запросов оригинала: dviga.marketing, neo.tildacdn.com, static.tildacdn.com, fonts.googleapis.com, fonts.gstatic.com, cdn.jsdelivr.net, thb.tildacdn.com, cc.calltracking.ru, , tilda.ws, cp80604-bitrix-8.tw1.ru, upwidget.tildacdn.com, mc.yandex.ru, stat.tildaapi.com, adfstat.yandex.ru, hdrc.yandex.net, mdd.yandex.net
Хосты запросов копии: localhost:4173

Отдельные прогоны (Performance): оригинал 42 / 63 / 62; копия 98 / 99 / 98
