#!/bin/sh
# Снимает эталон (оригинал) и копию с одинаковой подготовкой и сравнивает.
INJ='video,.tn-atom__videoiframe,.t708__btn,.wg-b{visibility:hidden!important}'
export INJECT="$INJ"
REF_URL=https://dviga.marketing/ REF_OUT=reference/home node tools/crawl.mjs
REF_URL=http://localhost:4173/ REF_OUT=reference/copy SEL='header > .r, main > .r, footer > .r' node tools/crawl.mjs
