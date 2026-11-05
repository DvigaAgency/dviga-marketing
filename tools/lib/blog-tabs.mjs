// Адреса вкладок блога (ЧПУ): «Все статьи» — /blog, остальные — /blog/<слаг>. Вместо якоря вида #!/tab/<запись>-<номер> у оригинала.
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const SLUGS = {
  'Все статьи': '',
  'Сайты': 'sajty',
  'Брендинг': 'brending',
  'Недвижимость': 'nedvizhimost',
  'Продвижение': 'prodvizhenie',
  'Автоматизация': 'avtomatizaciya',
  'Логистические компании': 'logisticheskie-kompanii',
  'Новости': 'novosti',
};

/** вкладки блога по снимку data/pages/blog.html: [{ name, slug, index }] (index с 1, как в адресе оригинала) */
export function blogTabs(file = 'data/pages/blog.html') {
  if (!fs.existsSync(file)) return [];
  const $ = cheerio.load(fs.readFileSync(file, 'utf8'), { decodeEntities: false });
  return $('li.t395__tab').map((i, li) => {
    const name = $(li).text().replace(/\s+/g, ' ').trim();
    if (!(name in SLUGS)) throw new Error(`blog-tabs: для вкладки «${name}» не задан адрес (tools/lib/blog-tabs.mjs)`);
    return { name, slug: SLUGS[name], index: i + 1 };
  }).get();
}
