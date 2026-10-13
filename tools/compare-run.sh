#!/bin/sh
# Снимает эталон (оригинал) с одинаковой подготовкой: видео и пульсирующая кнопка чата скрыты (недетерминированы).
INJ='video,.tn-atom__videoiframe,.e[data-t=video],.t396__elem[data-elem-type=video],.t708__btn,.wg-b{visibility:hidden!important}'
export INJECT="$INJ"
REF_URL=https://dviga.marketing/ REF_OUT=reference/home node tools/crawl.mjs
