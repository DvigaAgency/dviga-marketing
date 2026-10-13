#!/bin/sh
# Снимает копию (npm run preview на :4173) так же, как эталон.
export INJECT='video,.tn-atom__videoiframe,.e[data-t=video],.t396__elem[data-elem-type=video],.t708__btn,.wg-b{visibility:hidden!important}'
SECTION_WAIT=900 REF_URL=http://localhost:${PORT:-4173}/ REF_OUT=reference/copy SEL='header > .r, main > .r, footer > .r' node tools/crawl.mjs
