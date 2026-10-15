#!/bin/sh
# Сравнение страницы копии с оригиналом: sh tools/page-compare.sh <slug> </путь/страницы>   (preview-сервер на :4173)
SLUG=$1; P=$2
export INJECT='video,.tn-atom__videoiframe,.e[data-t=video],.t396__elem[data-elem-type=video],.t708__btn,.wg-b{visibility:hidden!important}'
[ -d reference/$SLUG ] || REF_URL=https://dviga.marketing$P REF_OUT=reference/$SLUG node tools/crawl.mjs
SECTION_WAIT=900 REF_URL=http://localhost:${PORT:-4173}$P/ REF_OUT=reference/$SLUG-copy SEL='header > .r, main > .r, footer > .r' node tools/crawl.mjs
mkdir -p reports
REF_DIR=reference/$SLUG COPY_DIR=reference/$SLUG-copy DIST=dist$P/index.html REPORT=reports/compare-$SLUG.md DIFF_DIR=reports/diff-$SLUG node tools/compare.mjs
