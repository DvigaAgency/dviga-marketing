// Страница /ai: запись T1370 оригинала (каркас чата с вымышленной базой знаний и заглушкой-скриптом) заменяется рабочим помощником.
// Разметка и дизайн — каркас оригинала (классы vb-a2s), его скрипт отбрасывается; логика — src/js/ai-engine.js + src/js/ai.js, база знаний — assets/ai.<хэш>.json.
import fs from 'node:fs';

export function aiBlock($, rec, aiUrl) {
  const id = rec.attr('id').replace('rec', '');
  const c = $(rec.toString());
  c.find('script,style').remove();
  const root = c.find('.vb-a2s').first();
  root.attr('data-ai', aiUrl);
  const chat = root.find('#vb-a2s-chat');
  chat.prepend('<div class="vb-a2s__chat-head"><span class="vb-a2s__status" role="status" aria-live="polite"></span><button type="button" class="vb-a2s__reset" hidden>Новый диалог</button></div>');
  root.find('.vb-a2s__title').find('.vb-a2s__cursor').attr('aria-hidden', 'true');
  root.find('.vb-a2s__input').attr('maxlength', '300').attr('enterkeyhint', 'send');
  root.find('.vb-a2s__send').addClass('vb-a2s__send');
  const css = fs.readFileSync('src/css/ai.css', 'utf8');
  return { id, css, html: `<section id="r${id}" class="r emb">${c.html().replace(/<!--[\s\S]*?-->/g, '').replace(/\bt-rec\b/g, 'emb-rec')}</section>` };
}
