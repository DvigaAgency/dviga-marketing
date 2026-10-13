// Конвертер Zero-блока (record type 396) в статический HTML + CSS без рантайма Tilda.
import * as csstree from 'css-tree';
import { makeGetter, artboardAt, elemLayout, num } from './zero-layout.mjs';
import { buildKeyframes, scrollSteps } from './sbs.mjs';

const SEL_MAP = [
  [/\.t396__carrier-wrapper/g, '.cw'],
  [/\.t396__carrier/g, '.cr'],
  [/\.t396__filter/g, '.fl'],
  [/\.t396__artboard/g, '.ab'],
  [/\.tn-atom__img/g, '.ai'],
  [/\.tn-atom__button-text/g, '.bt'],
  [/\.tn-atom__button-border/g, '.bb'],
  [/\.tn-atom__button-content/g, '.bc'],
  [/\.tn-atom__video-play-icon/g, '.vpi'],
  [/\.tn-atom__vector/g, '.av'],
  [/\.tn-atom/g, '.a'],
];
const DROP_ELEM_PROPS = new Set(['top', 'left', 'width', 'height', 'display']);
const DROP_AB_PROPS = new Set(['height', 'min-height']);
const DEFAULTS = {
  'border-width': 'var(--t396-borderwidth,0)',
  'border-style': 'var(--t396-borderstyle,solid)',
  'border-color': 'var(--t396-bordercolor,transparent)',
  'background-position': 'center center',
  'white-space': 'normal',
  'vertical-align': 'middle',
  'background-size': 'cover',
};
function isDefault(d) {
  const v = csstree.generate(d.value);
  if (DEFAULTS[d.property] === v) return true;
  if (d.property === 'transition' && v.startsWith('background-color var(--t396-speedhover,0s) ease-in-out,color var(--t396-speedhover,0s)')) return true;
  if (d.property === 'text-shadow' && v.startsWith('var(--t396-shadow-text-x,0px) var(--t396-shadow-text-y,0px) var(--t396-shadow-text-blur,0px)')) return true;
  return false;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function convertZero($, rec, ctx) {
  const recId = rec.attr('id').replace('rec', '');
  ctx.rec = recId;
  const abEl = rec.find('.t396__artboard').first();
  const ab = abEl.attr();
  const screens = (ab['data-artboard-screens'] || '320,480,640,960,1200').split(',').map(Number);
  const maxR = screens[screens.length - 1];
  const rid = `#r${recId}`;
  const css = [];
  const elems = [];

  // ---------- 1. артборд на каждом брейкпоинте
  const A = Object.fromEntries(screens.map((R) => [R, artboardAt(ab, screens, R)]));
  const abGet = makeGetter(ab, screens, 'data-artboard-', '');
  const fixedPos = ab['data-artboard-pos']; // fixed | absolute
  const ovrflw = ab['data-artboard-ovrflw'];

  // ---------- 2. элементы
  abEl.children('.t396__elem').each((i, node) => {
    const el = $(node);
    elems.push({ el, attrs: el.attr(), id: el.attr('data-elem-id'), type: el.attr('data-elem-type') });
  });

  // раскладка: mobile-first, на каждом следующем брейкпоинте — только изменившиеся значения
  const layoutByR = {};
  for (const R of screens) {
    layoutByR[R] = {};
    for (const e of elems) layoutByR[R][e.id] = elemLayout(e.attrs, screens, R, A[R]);
  }
  const minR = screens[0];
  const mq = (R) => (R === minR ? null : `(min-width:${R}px)`);
  const layoutCss = {};
  for (const R of screens) {
    let rules = '';
    // артборд
    const a = A[R];
    const prev = R === minR ? null : A[screens[screens.indexOf(R) - 1]];
    const decl = [];
    const s = `tan(atan2(100cqw,${R}px))`;
    const heightExpr = (x) => {
      const hh = x.upscale ? `calc(${x.h}px*var(--s))` : `${x.h}px`;
      if (x.vh) return `max(${hh},${x.vh}${'svh'})`;
      return hh;
    };
    decl.push(`--s:${a.upscale ? s : '1'}`);
    decl.push(`--z:${a.upscale ? 'var(--s)' : '1'}`);
    decl.push(`height:${heightExpr(a)}`);
    rules += `${rid} .ab{${decl.join(';')}}`;
    for (const e of elems) {
      const cur = layoutByR[R][e.id];
      const p = prev ? layoutByR[screens[screens.indexOf(R) - 1]][e.id] : {};
      const d = [];
      for (const k of ['width', 'min-width', 'height', 'left', 'top', 'translate']) {
        if (cur[k] === undefined) continue;
        if (!prev && cur[k] === '') continue;
        if (!prev || cur[k] !== p[k]) d.push(`${k}:${cur[k] === '' ? 'unset' : cur[k]}`);
      }
      if ((prev ? cur.__zoom !== p.__zoom : !cur.__zoom)) d.push(`zoom:${cur.__zoom ? 'var(--z)' : '1'}`);
      if (d.length) rules += `${ctx.sel(recId, e.id)}{${d.join(';')}}`;
    }
    layoutCss[R] = rules;
  }
  for (const R of screens) css.push(mq(R) ? `@media${mq(R) ? ' ' + mq(R) : ''}{${layoutCss[R]}}` : layoutCss[R]);

  // ---------- 3. переписанный CSS записи
  const raw = rec.find('style').map((i, e) => $(e).text()).get().join('\n');
  const widthById = {};
  for (const e of elems) widthById[e.id] = parseFloat(layoutByR[maxR][e.id].width) || 0;
  css.push(rewriteCss(raw, recId, ctx, elems, widthById));

  // ---------- 4. keyframes пошаговых анимаций (hover/click/blockintoview)
  const abAttrs = [];
  const html = [];
  for (const e of elems) html.push(emitElement($, e, recId, ctx, css, A, screens));

  // ---------- 5. оболочка записи
  const cls = (rec.attr('class') || '').split(/\s+/).filter((c) => c && !/^t-rec/.test(c) && c !== 'r');
  const style = (rec.attr('style') || '').trim();
  const pad = recPadding(rec.attr('class') || '', recId);
  if (pad) css.push(pad);
  const abClass = ['ab'];
  if (ovrflw === 'visible') abClass.push('ov');
  if (ctx.drag && ctx.drag.has(recId)) abClass.push('dg');
  const abStyleBits = [];
  void abAttrs; void abStyleBits; void style; void fixedPos;
  const carrier = rec.find('.t396__carrier-wrapper').length
    ? '<div class="cw"><div class="cr"></div></div><div class="fl"></div>'
    : '<div class="cr"></div><div class="fl"></div>';
  const out = `<section id="r${recId}" class="r${cls.length ? ' ' + cls.join(' ') : ''}"${style && !/^padding/.test(style) ? '' : ''}><div class="${abClass.join(' ')}"${fixedPos ? ` data-pos="${fixedPos}"` : ''}>${carrier}${html.join('')}</div></section>`;
  return { id: recId, html: out, css: css.join('\n'), elems: elems.length, screens, maxR, upscale: A[maxR].upscale };
}

function recPadding(cls, recId) {
  let c = '';
  const pt = cls.match(/t-rec_pt_(\d+)/); const pb = cls.match(/t-rec_pb_(\d+)/);
  const pt480 = cls.match(/t-rec_pt-res-480_(\d+)/); const pb480 = cls.match(/t-rec_pb-res-480_(\d+)/);
  const base = [];
  if (pt) base.push(`padding-top:${pt[1]}px`);
  if (pb) base.push(`padding-bottom:${pb[1]}px`);
  if (base.length) c += `#r${recId}{${base.join(';')}}`;
  const narrow = [];
  // как в таблице стилей Tilda: на ≤480px крупные отступы 120/135 ужимаются до 90, плюс явные res-480 значения
  if (pt && pt[1] === '120') narrow.push('padding-top:90px');
  if (pb && pb[1] === '135') narrow.push('padding-bottom:90px');
  if (pt480) narrow.push(`padding-top:${pt480[1]}px`);
  if (pb480) narrow.push(`padding-bottom:${pb480[1]}px`);
  if (narrow.length) c += `@media(max-width:480px){#r${recId}{${narrow.join(';')}}}`;
  return c;
}

// ---------------------------------------------------------------- CSS
function mapSelector(sel, recId, ctx) {
  let s = sel.trim();
  s = s.replace(/#rec([0-9]+) \.tn-elem\[data-elem-id="([0-9]+)"\]/g, (m, r, id) => ctx.sel(r, id));
  s = s.replace(new RegExp(`#rec${recId}`, 'g'), `#r${recId}`);
  s = s.replace(/\.tn-elem\[data-elem-id="(\d+)"\]/g, '.e$1');
  for (const [re, to] of SEL_MAP) s = s.replace(re, to);
  return s;
}

function rewriteCss(raw, recId, ctx, elems, widthById) {
  const imgs = [];
  const ast = csstree.parse(raw);
  const textIds = new Set(elems.filter((e) => e.type === 'text').map((e) => e.id));
  const sbsIds = new Set(elems.filter((e) => e.attrs['data-animate-sbs-opts']).map((e) => e.id));
  const toDelete = [];
  csstree.walk(ast, {
    visit: 'Atrule',
    enter(node, item, list) {
      if (node.name === 'media' && node.prelude) {
        const p = csstree.generate(node.prelude);
        if (/min-width:0\\0/.test(p)) node.prelude = csstree.parse('(hover)', { context: 'mediaQueryList' });
      }
    },
  });
  csstree.walk(ast, {
    visit: 'Rule',
    enter(node, item, list) {
      const pre = csstree.generate(node.prelude);
      if (/anim-hidden/.test(pre)) { toDelete.push([list, item]); return; }
      const idMatch = pre.match(/\.tn-elem\[data-elem-id="(\d+)"\]/);
      const isElemRoot = /^#rec\d+ \.tn-elem\[data-elem-id="\d+"\]$/.test(pre.trim());
      const isAb = /^#rec\d+ \.t396__(artboard|carrier|filter)$/.test(pre.trim());
      const isAtom = /^#rec\d+ \.tn-elem\[data-elem-id="\d+"\] \.tn-atom$/.test(pre.trim());
      // удаляем layout-свойства (они генерируются из данных) и значения по умолчанию (вынесены в base.css)
      const top = !this.atrule;
      node.block.children = node.block.children.filter((d) => {
        if (d.type !== 'Declaration') return true;
        if (top && (isAtom || isElemRoot) && isDefault(d)) return false;
        // как в zero-1.2: у текстов line-height округляется до целых px (t396__fixElementsLineHeights)
        if (isAtom && d.property === 'line-height' && idMatch && textIds.has(idMatch[1]) && /^[0-9.]+$/.test(csstree.generate(d.value))) d.value = csstree.parse(`round(${csstree.generate(d.value)}em,1px)`, { context: 'value' });
        if (isElemRoot && DROP_ELEM_PROPS.has(d.property)) { if (d.property !== 'display' || /^(table|block)$/.test(csstree.generate(d.value))) return false; }
        if (isAb && DROP_AB_PROPS.has(d.property)) return false;
        return true;
      });
      // sbs: border-radius/filter с атома — на обёртку
      if (isAtom && idMatch && sbsIds.has(idMatch[1])) {
        const move = [];
        node.block.children = node.block.children.filter((d) => {
          if (d.type === 'Declaration' && (d.property === 'border-radius' || d.property === 'filter' || d.property === 'backdrop-filter' || d.property === '-webkit-backdrop-filter')) {
            move.push(csstree.generate(d));
            return d.property === 'border-radius';
          }
          return true;
        });
        if (move.length) node.__extra = `${ctx.sel(recId, idMatch[1])} .sw{${move.join(';')}}`;
      }
      if (node.block.children.isEmpty) toDelete.push([list, item]);
    },
  });
  for (const [list, item] of toDelete) list.remove(item);
  // url()
  csstree.walk(ast, {
    visit: 'Url',
    enter(node) {
      const u = typeof node.value === 'string' ? node.value : node.value.value;
      const idm = this.rule ? csstree.generate(this.rule.prelude).match(/data-elem-id="([0-9]+)"/) : null;
      const w = idm && widthById[idm[1]] ? widthById[idm[1]] * 1.6 : 0;
      imgs.push(ctx.cssImage(u, w));
      node.value = '__IMG' + (imgs.length - 1) + '__';
    },
  });
  let out = '';
  const printRule = (n) => {
    const sel = csstree.generate(n.prelude).split(',').map((s) => mapSelector(s, recId, ctx)).join(',');
    let body = csstree.generate(n.block).slice(1, -1).replace(/--t396-/g, '--z-');
    let r = `${sel}{${body}}`;
    if (n.__extra) r += n.__extra.replace(/--t396-/g, '--z-');
    return r;
  };
  csstree.walk(ast, {
    enter() {},
  });
  const gen = (nodes) => {
    let s = '';
    nodes.forEach((n) => {
      if (n.type === 'Rule') s += printRule(n);
      else if (n.type === 'Atrule' && n.block) {
        const inner = gen(n.block.children);
        if (inner) s += `@${n.name} ${csstree.generate(n.prelude)}{${inner}}`;
      }
    });
    return s;
  };
  out = gen(ast.children);
  out = out.replace(/url\(__IMG([0-9]+)__\)/g, (m, i) => imgs[+i]);
  return out;
}

// ---------------------------------------------------------------- элементы
function emitElement($, e, recId, ctx, css, A, screens) {
  const { el, attrs, id, type } = e;
  const classes = (attrs.class || '').split(/\s+/).filter((c) => c && !/^(t396__elem|tn-elem|tn-elem__\d+|t396__elem--anim-hidden)$/.test(c));
  const data = [`data-t="${type}"`];
  const rm = (k) => attrs[k];
  const sbsOpts = rm('data-animate-sbs-opts');
  const sbsEvent = rm('data-animate-sbs-event');
  const hasSbs = !!(sbsOpts && sbsEvent);
  let wrapStyle = '';
  if (hasSbs) {
    const loop = rm('data-animate-sbs-loop') || '';
    if (sbsEvent === 'scroll') {
      const maxR = screens[screens.length - 1];
      const at = (name, R) => attrs[R === maxR ? 'data-animate-sbs-' + name : `data-animate-sbs-${name}-res-${R}`];
      const cascade = (name, R) => { let v = at(name, R); for (const c of screens) { if (v !== undefined && v !== '') break; if (c > R) v = at(c === maxR && false ? name : name, c); } return v; };
      const per = screens.map((R) => ({ s: scrollSteps(cascade('opts', R)), o: parseInt(cascade('trgofst', R) || '0', 10) || 0 }));
      data.push(`data-sc='${JSON.stringify({ r: per, t: parseFloat(rm('data-animate-sbs-trg') ?? '1'), m: rm('data-animate-mobile') === 'y' ? 1 : 0 })}'`);
    } else {
      const uid = `k${recId}_${id}`;
      const sel = `${ctx.sel(recId, id)}.on>.sw`;
      const kf = buildKeyframes(sel, uid, sbsOpts, loop);
      if (kf) {
        css.push(kf.css);
        if (kf.hidden) data.push('data-h0="1"');
        const trg = rm('data-animate-sbs-trgels');
        const trgOfst = rm('data-animate-sbs-trgofst');
        data.push(`data-an="${sbsEvent}"`);
        if (trg) data.push(`data-tr="${trg}"`);
        if (rm('data-animate-sbs-trg') !== undefined) data.push(`data-tg="${rm('data-animate-sbs-trg')}"`);
        if (trgOfst !== undefined) data.push(`data-to="${trgOfst}"`);
        if (loop) data.push(`data-lp="${loop}"`);
        if (kf.total) data.push(`data-tt="${kf.total}"`);
      }
    }
  }
  // appear-анимации (fadein)
  if (rm('data-animate-style')) {
    data.push(`data-fi="${esc(rm('data-animate-style'))}"`);
    const sv = [];
    if (rm('data-animate-duration')) sv.push(`--fd:${rm('data-animate-duration')}s`);
    if (rm('data-animate-delay')) sv.push(`--fl:${rm('data-animate-delay')}s`);
    if (sv.length) data.push(`style="${sv.join(';')}"`);
  }
  // фиксация на время прокрутки
  if (rm('data-animate-fix') !== undefined) {
    const maxR = screens[screens.length - 1];
    const at = (R) => attrs[R === maxR ? 'data-animate-fix-trgofst' : `data-animate-fix-trgofst-res-${R}`];
    const tro = screens.map((R) => { let v = at(R); for (const c of screens) { if (v !== undefined) break; if (c > R) v = at(c); } return parseInt(v ?? '0', 10) || 0; });
    data.push(`data-fx="${rm('data-animate-fix-dist') || 0}" data-fo="${tro.join(',')}"`);
  }
  if (rm('data-animate-mobile') === 'y') data.push('data-mb="1"');
  if (classes.includes('dot-scale-2') && !classes.includes('dot-scale')) classes.push('dot-scale');
  if (ctx.anx && ctx.anx.has(`${recId}:${id}`)) classes.push('anx');
  e.dot = classes.includes('dot-scale');
  const inner = emitAtom($, e, ctx, A, screens, hasSbs && sbsEvent !== 'scroll' ? wrapStyle : '', hasSbs);
  return `<div class="e e${id}${classes.length ? ' ' + classes.join(' ') : ''}" ${data.join(' ')}>${inner}</div>`;
}

function imgSizes(e, A, screens) {
  const parts = [];
  for (const R of [...screens].reverse()) {
    const l = elemLayout(e.attrs, screens, R, A[R]);
    const w = parseFloat(l.width);
    if (!(w > 0) || /%|auto/.test(l.width)) return '100vw';
    const q = A[R].upscale && l.__zoom ? `${+((w / R) * 100).toFixed(2)}vw` : `${w}px`;
    parts.push(R === screens[0] ? q : `(min-width:${R}px) ${q}`);
  }
  return parts.join(',');
}

function emitAtom($, e, ctx, A, screens, wrapStyle, hasSbs) {
  const { el, attrs, type, id } = e;
  const atom = el.children().first();
  const tag = atom[0].tagName;
  const href = atom.attr('href');
  const linkAttrs = [];
  if (href !== undefined) linkAttrs.push(`href="${esc(ctx.href(href))}"`);
  for (const k of ['target', 'rel', 'aria-label', 'data-tooltip']) if (atom.attr(k) !== undefined && atom.attr(k) !== '') linkAttrs.push(`${k}="${esc(atom.attr(k))}"`);
  const ariaFor = (h) => (/^#menu/.test(h) ? 'Открыть меню' : /^#search/.test(h) ? 'Поиск по сайту' : /^tel:/.test(h) ? 'Позвонить: 8 800 200 23 02' : /^#form/.test(h) ? 'Обсудить проект' : /^#close/.test(h) ? 'Закрыть' : '');
  let body = '';
  let atomClass = 'a';
  let atomTag = tag === 'a' ? 'a' : (/^h[1-6]$/.test(tag) ? tag : 'div');
  const getF = makeGetter(attrs, screens, 'data-field-', '-value');
  let style = '';
  switch (type) {
    case 'shape': {
      const bg = atom.attr('style');
      if (bg && /background-image/.test(bg)) style = ` style="${esc(bg.replace(/url\(['"]?([^'")]+)['"]?\)/g, (m, u) => ctx.cssImage(u, (parseFloat(elemLayout(attrs, screens, screens[screens.length - 1], A[screens[screens.length - 1]]).width) || 0) * 1.6)))}"`;
      if (atom.attr('data-original')) style = ` style="${esc('background-image:' + ctx.cssImage(atom.attr('data-original'), (parseFloat(elemLayout(attrs, screens, screens[screens.length - 1], A[screens[screens.length - 1]]).width) || 0) * 1.6))}"`;
      if (atom.hasClass('t-bgimg')) atomClass += ' bg';
      const al = atom.attr('aria-label');
      const has = linkAttrs.some((x) => x.startsWith('aria-label'));
      if (href !== undefined) { const lab = al || ariaFor(href); if (lab && !has) linkAttrs.push(`aria-label="${esc(lab)}"`); } else linkAttrs.push('aria-hidden="true"');
      break;
    }
    case 'image': {
      const img = atom.find('img').first();
      const src = img.attr('data-original') || img.attr('src');
      const fw = num(getF('filewidth', 1200)); const fh = num(getF('fileheight', 1200));
      body = ctx.picture(src, { alt: img.attr('alt') || '', cls: 'ai', w: fw, h: fh, eager: ctx.eager(id), sizes: imgSizes(e, A, screens), link: !!href });
      break;
    }
    case 'text': {
      body = atom.html();
      if (atom.attr('field')) atomClass += ' tf';
      body = body.replace(/ field="[^"]*"/g, '');
      body = ctx.textHtml(body);
      break;
    }
    case 'button': {
      body = atom.html();
      break;
    }
    case 'video': {
      const v = atom.find('.tn-atom__videoiframe');
      body = ctx.video(v.attr('data-mp4video'), id);
      style = ' style="height:100%"';
      break;
    }
    case 'vector': {
      body = atom.html().replace(/<!--[\s\S]*?-->/g, '').trim();
      atomClass += ' av';
      break;
    }
    case 'form': {
      body = ctx.form(e, $);
      atomClass += ' form';
      break;
    }
    default: body = atom.html();
  }
  if (type === 'button') {
    body = body.replace(/<!--[\s\S]*?-->/g, '');
    const txt = atom.find('.tn-atom__button-text').html();
    body = e.dot ? `<div class="bc"><div>${txt}</div></div><span class="bb"></span>` : `<span class="bc"><span class="bt">${txt}</span></span><span class="bb"></span>`;
  }
  const inner = `<${atomTag} class="${atomClass}"${linkAttrs.length ? ' ' + linkAttrs.join(' ') : ''}${style}>${body}</${atomTag}>`;
  return hasSbs ? `<div class="sw"${wrapStyle}>${inner}</div>` : inner;
}
