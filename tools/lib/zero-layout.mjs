// Раскладка Zero-блоков: из data-атрибутов (по брейкпоинтам) в статический CSS.
// Модель повторяет поведение Tilda (zero-1.2 + zero-scale): сетка R пикселей по центру окна,
// при upscale=window весь контент «зумится» коэффициентом window/R (CSS zoom + @property --s).

export const num = (v) => (v === undefined || v === null || v === '' ? null : parseFloat(v));
const px = (n) => `${+n.toFixed(3)}px`;

/** значение поля с каскадом: брейкпоинт R -> следующие более широкие -> базовое */
export function makeGetter(attrs, screens, prefix, suffix) {
  const max = screens[screens.length - 1];
  const name = (f, r) => (r === max ? `${prefix}${f}${suffix}` : `${prefix}${f}-res-${r}${suffix}`);
  return (f, R) => {
    let v = attrs[name(f, R)];
    if (v !== undefined && v !== '') return v;
    for (const c of screens) {
      if (c <= R) continue;
      v = attrs[name(f, c)];
      if (v !== undefined && v !== '') return v;
    }
    return null;
  };
}

/** артборд на брейкпоинте R */
export function artboardAt(ab, screens, R) {
  const get = makeGetter(ab, screens, 'data-artboard-', '');
  const h = num(get('height', R)) ?? 0;
  // height_vh: пустая строка на брейкпоинте — осознанное «выкл.» (не каскадируется с более широкого экрана), каскад только при отсутствии атрибута
  let vhRaw = null;
  for (const c of [R, ...screens.filter((x) => x > R)]) {
    const v = ab[c === screens[screens.length - 1] ? 'data-artboard-height_vh' : `data-artboard-height_vh-res-${c}`];
    if (v !== undefined) { vhRaw = v; break; }
  }
  const vh = vhRaw === null || vhRaw === '' ? 0 : parseFloat(vhRaw) || 0;
  return {
    R,
    h,
    vh,
    valign: get('valign', R) || 'top',
    upscale: (get('upscale', R) || 'grid') === 'window',
  };
}

/** CSS-свойства раскладки элемента на брейкпоинте R (значения в «дизайнерских» px, зум применяется браузером) */
export function elemLayout(el, screens, R, A) {
  const get = makeGetter(el, screens, 'data-field-', '-value');
  const type = el['data-elem-type'];
  const out = {};
  const container = get('container', R) || 'grid';
  const win = container === 'window';
  const axisx = get('axisx', R) || 'left';
  const axisy = get('axisy', R) || 'top';
  const widthmode = get('widthmode', R) || 'fixed';
  const heightmode = get('heightmode', R) || 'fixed';
  let textfit = get('textfit', R);
  if (!textfit) textfit = type === 'button' ? 'fixedsize' : type === 'text' ? 'autoheight' : '';
  const W = num(get('width', R)) ?? 0;
  const H = num(get('height', R)) ?? 0;
  const wu = get('widthunits', R) || 'px';
  const hu = get('heightunits', R) || 'px';
  const L = num(get('left', R)) ?? 0;
  const T = num(get('top', R)) ?? 0;
  const lu = get('leftunits', R) || 'px';
  const tu = get('topunits', R) || 'px';

  // ---- ширина
  if ((type === 'text' || type === 'button') && textfit === 'autowidth') out.width = 'auto';
  else if (widthmode === 'hug' || widthmode === 'fill') out.width = 'auto';
  else if (wu === '%') out.width = win ? `${W}%` : px((A.R * W) / 100);
  else out.width = px(W);
  if (type === 'button') out['min-width'] = textfit === 'singleline' ? '0px' : '';

  // ---- высота
  const autoH = (type === 'text' || type === 'button') && ['autowidth', 'autoheight', 'singleline'].includes(textfit);
  if (autoH || type === 'tooltip') out.height = 'auto';
  else if (heightmode === 'hug' || heightmode === 'fill') out.height = 'auto';
  else if (type === 'image' && (get('imagefit', R) || 'auto') === 'auto') out.height = 'auto';
  else if (hu === '%') out.height = win || A.valign === 'stretch' ? `${H}%` : px((A.h * H) / 100);
  else out.height = px(H);

  // ---- left
  const Lx = lu === '%' ? (win ? null : (A.R * L) / 100) : L; // null => процент окна
  const Lpx = (v) => (Lx === null ? `${L}%` : px(v));
  const tr = { x: 0, y: 0 };
  if (win) {
    if (axisx === 'left') out.left = Lx === null ? `${L}%` : px(L);
    else if (axisx === 'center') { out.left = `calc(50% + ${Lx === null ? L + '%' : px(L)})`; tr.x = -50; }
    else { out.left = `calc(100% + ${Lx === null ? L + '%' : px(L)})`; tr.x = -100; }
  } else if (A.upscale) {
    // всё в единицах сетки R; браузер умножает на zoom
    if (axisx === 'left') out.left = px(Lx);
    else if (axisx === 'center') { out.left = px(A.R / 2 + Lx); tr.x = -50; }
    else { out.left = px(A.R + Lx); tr.x = -100; }
  } else {
    // сетка R по центру окна, без масштаба
    if (axisx === 'left') out.left = `calc(50% - ${px(A.R / 2)} + ${px(Lx)})`;
    else if (axisx === 'center') { out.left = `calc(50% + ${px(Lx)})`; tr.x = -50; }
    else { out.left = `calc(50% + ${px(A.R / 2 - 0)} + ${px(Lx)})`; tr.x = -100; }
  }
  void Lpx;

  // ---- top
  const stretch = A.valign === 'stretch';
  const Hd = A.h; // дизайн-высота артборда на брейкпоинте
  // якоря сетки по вертикали: верх / низ / центр «дизайн-области» артборда
  let topAnchor, bottomAnchor, centerAnchor;
  if (win || stretch) { topAnchor = '0px'; bottomAnchor = '100%'; centerAnchor = '50%'; }
  else if (A.valign === 'center') { topAnchor = `calc(50% - ${px(Hd / 2)})`; bottomAnchor = `calc(50% + ${px(Hd / 2)})`; centerAnchor = '50%'; }
  else if (A.valign === 'bottom') { topAnchor = `calc(100% - ${px(Hd)})`; bottomAnchor = '100%'; centerAnchor = `calc(100% - ${px(Hd / 2)})`; }
  else { topAnchor = '0px'; bottomAnchor = px(Hd); centerAnchor = px(Hd / 2); }
  const areaH = win || stretch ? '100%' : null; // для top в %
  let Ty;
  if (tu === '%') Ty = areaH ? `${T}%` : px((Hd * T) / 100);
  else Ty = px(T);
  const base = axisy === 'top' ? topAnchor : axisy === 'center' ? centerAnchor : bottomAnchor;
  out.top = base === '0px' ? Ty : `calc(${base} + ${Ty})`;
  if (axisy === 'center') tr.y = -50;
  if (axisy === 'bottom') tr.y = -100;
  out.translate = tr.x || tr.y ? `${tr.x}% ${tr.y}%` : '';

  out.__zoom = A.upscale && !win; // применять ли zoom к элементу
  out.__type = type;
  return out;
}
