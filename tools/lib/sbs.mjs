// Пошаговые анимации (hover / click / blockintoview / intoview): генерация @keyframes на этапе сборки.
// Повторяет логику tilda-animation-sbs (generateKeyframes), но без рантайма: в браузере остаётся только
// переключение классов .on / .rv.

export function parseOpts(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw.replace(/'/g, '"')); } catch { return null; }
}

/** вставка «шагов-пауз» из dd/dt (задержек) — как t_animationSBS__addDelayToSteps */
export function addDelays(steps) {
  const out = steps.map((s) => ({ ...s }));
  for (let i = 0; i < out.length; i++) {
    const n = out[i];
    if (i !== 0 && (parseInt(n.dd, 10) || parseInt(n.dt, 10))) {
      const copy = { ...out[i - 1] };
      if (n.dt !== undefined) copy.ti = n.dt; else copy.di = n.dd;
      out.splice(i, 0, copy);
      i++;
    }
  }
  return out;
}

const styleOf = (t) => ({
  moveX: parseInt(t.mx, 10) || 0,
  moveY: parseInt(t.my, 10) || 0,
  scaleX: Number.isNaN(parseFloat(t.sx)) ? 1 : parseFloat(t.sx),
  scaleY: Number.isNaN(parseFloat(t.sy)) ? 1 : parseFloat(t.sy),
  opacity: Number.isNaN(parseFloat(t.op)) ? 1 : parseFloat(t.op),
  rotate: parseInt(t.ro, 10) || 0,
  blur: parseInt(t.bl, 10) || 0,
  fix: t.fi === 'fixed',
});

const easing = (e) => {
  switch (e) {
    case 'easeIn': return 'ease-in';
    case 'easeOut': return 'ease-out';
    case 'easeInOut': return 'ease-in-out';
    case 'bounceFin': return 'cubic-bezier(0.34,1.61,0.7,1)';
    default: return !e || e.trim() === '' || /^\d+$/.test(e.trim()) ? 'linear' : e;
  }
};

/** @returns {{css:string, hidden:boolean, total:number}|null} */
export function buildKeyframes(selector, uid, optsRaw, loop) {
  const opts = parseOpts(optsRaw);
  if (!opts || !opts.length) return null;
  const raw = addDelays(opts);
  const steps = raw.map((t) => ({ styles: styleOf(t), time: t.ti, ease: t.ea }));
  // абсолютные -> дельты -> снова накопление (как в оригинале): итог — абсолютные значения шагов
  const every = (k, v) => steps.every((s) => s.styles[k] === v);
  const skip = {
    moveX: every('moveX', 0), moveY: every('moveY', 0), scaleX: every('scaleX', 1), scaleY: every('scaleY', 1),
    rotate: every('rotate', 0), blur: every('blur', 0), opacity: every('opacity', 1), fix: steps.every((s) => s.styles.fix === false),
  };
  const frames = [];
  let total = 0;
  steps.forEach((s, i) => {
    const st = {};
    for (const k of Object.keys(s.styles)) if (!skip[k]) st[k] = s.styles[k];
    if (JSON.stringify(st) === '{}') return;
    const f = { styles: st, time: 1 * s.time || 0 };
    if (i !== steps.length - 1) f.ease = steps[i + 1].ease;
    frames.push(f); total += f.time;
  });
  // correctFrames
  frames.forEach((f, i) => {
    const last = i === frames.length - 1; const first = i === 0;
    const next = last ? null : frames[i + 1]; const prev = first ? null : frames[i - 1];
    for (const k of Object.keys(f.styles)) {
      if (!first && !(k in prev.styles)) {
        if (['blur', 'rotate', 'moveX', 'moveY'].includes(k)) prev.styles[k] = 0;
        if (['opacity', 'scaleX', 'scaleY'].includes(k)) prev.styles[k] = 1;
      }
      if (!last) {
        if (k in next.styles) { /* дельты уже абсолютные в наших данных */ }
        else {
          if (['blur', 'rotate', 'moveX', 'moveY'].includes(k)) next.styles[k] = f.styles[k];
          if (['opacity', 'scaleX', 'scaleY'].includes(k)) next.styles[k] = f.styles[k];
        }
      }
    }
  });
  // countPercent
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (i === 0) f.percent = total === 0 ? 0 : parseFloat(((100 * f.time) / total).toFixed(2));
    else if (i === frames.length - 1) f.percent = 100;
    else {
      const prevP = frames[i - 1].percent;
      if (total === 0) f.percent = 0;
      else {
        const a = parseFloat(((100 * f.time) / total + prevP).toFixed(2));
        if (parseInt(a, 10) === 100 && i === frames.length - 2 && i !== 0) continue;
        f.percent = a;
      }
      if (f.percent === prevP) f.percent += 1;
      if (f.percent > 100) f.percent = 99;
    }
  }
  // initial hidden (correctOpacityOnFirstStep)
  const f1 = frames[1];
  let hidden = false;
  if (f1 && f1.time === 0 && f1.styles.opacity === 0) { hidden = true; frames[0].styles.opacity = 0; }
  // текст keyframes
  const body = frames.map((f) => {
    if (typeof f.percent !== 'number') return '';
    const s = f.styles; let css = ''; let tf = ''; let sx = 1; let sy = 1; let sc = false; let filter = '';
    for (const k of Object.keys(s)) {
      if (k === 'opacity') css += `opacity:${s.opacity};`;
      else if (k === 'scaleX') { sx = s.scaleX; sc = true; }
      else if (k === 'scaleY') { sy = s.scaleY; sc = true; }
      else if (k === 'moveX') tf += `translateX(${Math.round(s.moveX)}px)`;
      else if (k === 'moveY') tf += `translateY(${Math.round(s.moveY)}px)`;
      else if (k === 'rotate') tf += `rotate(${s.rotate}deg)`;
      else if (k === 'blur') filter = `filter:blur(${s.blur}px);`;
    }
    if (sc) tf += `scale(${sx},${sy})`;
    if (tf) css += `transform:${tf};`;
    css += filter;
    if (f.ease !== undefined) css += `animation-timing-function:${easing(f.ease)};`;
    return `${f.percent}%{${css}}`;
  }).join('');
  const dur = total / 1000;
  const infinite = loop && loop.includes('loop');
  const anim = `animation:${uid} ${dur === 0 ? '1e-5' : dur}s linear${infinite ? ' infinite' : ''}${infinite ? (loop === 'loopwithreverse' ? ' alternate' : '') : ' forwards'};backface-visibility:hidden;`;
  let css = `${selector}{${anim}}@keyframes ${uid}{${body}}`;
  if (!loop || loop === 'loopwithreverse') css += `${selector.replace(/\.on(?=[ >])/, '.on.rv')}{animation-direction:reverse}`;
  const fullTime = steps.reduce((a, s) => a + (parseInt(s.time, 10) || 0), 0);
  return { css, hidden, total: fullTime };
}

/** шаги для scroll-анимаций (рантайм): [{dist, mx,my,sx,sy,op,ro,bl,fix}] с учётом задержек dd */
export function scrollSteps(optsRaw) {
  const opts = parseOpts(optsRaw);
  if (!opts) return null;
  const steps = addDelays(opts).map((t) => {
    const s = styleOf(t);
    return { d: Number(t.di) || 0, x: s.moveX, y: s.moveY, sx: s.scaleX, sy: s.scaleY, o: s.opacity, r: s.rotate, b: s.blur, f: s.fix ? 1 : 0 };
  });
  // абсолютные положения -> дельты (как updateMoveAndRotateStepsStyles)
  let ex = steps[0].x; let ey = steps[0].y; let er = steps[0].r;
  steps.forEach((s) => { s.x -= ex; ex += s.x; s.y -= ey; ey += s.y; s.r -= er; er += s.r; });
  return steps;
}
