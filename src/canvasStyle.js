// Canva-style editor helpers shared by every project map.
// Text styles live in ad.textStyles[key]; shape background colours in ad.shapeFills[key]
// (plots keep using ad.colors[id], the same store as the Unit plot color option).

export const FONTS = [
  ['', 'Default'],
  ['"Instrument Sans", system-ui, sans-serif', 'Instrument Sans'],
  ['Poppins, sans-serif', 'Poppins'],
  ['Montserrat, sans-serif', 'Montserrat'],
  ['Roboto, sans-serif', 'Roboto'],
  ['Oswald, sans-serif', 'Oswald'],
  ['"Playfair Display", serif', 'Playfair Display'],
  ['Merriweather, serif', 'Merriweather'],
  ['"Noto Sans Tamil", sans-serif', 'Noto Sans Tamil'],
];

export const BG_PRESETS = ['#c7dfc7', '#8ab800', '#a5d18a', '#9fd7c2', '#a9c9f2', '#0877c9', '#363e4c', '#cf9560', '#f6d58b', '#f4b6b6', '#d6c2f0', '#ffffff'];

const clean = o => { const n = {}; Object.keys(o).forEach(k => { if (o[k] !== undefined && o[k] !== null && o[k] !== '') n[k] = o[k]; }); return n; };

// Inline style for an edited text (inline style beats the stylesheet defaults).
export function tStyle(s) {
  if (!s) return undefined;
  const st = clean({
    fill: s.fill,
    fontSize: s.fontSize ? s.fontSize + 'px' : undefined,
    fontFamily: s.fontFamily,
    fontWeight: s.bold === undefined ? undefined : (s.bold ? 700 : 400),
    fontStyle: s.italic ? 'italic' : undefined,
    textDecoration: s.underline ? 'underline' : undefined,
    ...(s.stColor ? { stroke: s.stColor, strokeWidth: (+s.stW || 0) + 'px', strokeOpacity: s.stOp == null ? 1 : Math.max(0, Math.min(100, +s.stOp)) / 100, paintOrder: 'stroke', strokeLinejoin: 'round' } : {}),
  });
  return Object.keys(st).length ? st : undefined;
}

// Move + rotate wrapper transform, rotating around the text's own anchor point.
export function tWrap(s, cx, cy) {
  if (!s) return undefined;
  const dx = +s.dx || 0, dy = +s.dy || 0, r = +s.rot || 0;
  if (!dx && !dy && !r) return undefined;
  return `translate(${dx} ${dy}) rotate(${r} ${cx} ${cy})`;
}

export function patchText(ad, key, patch) {
  const all = { ...(ad.textStyles || {}) };
  const next = clean({ ...(all[key] || {}), ...patch });
  if (Object.keys(next).length) all[key] = next; else delete all[key];
  return { ...ad, textStyles: all };
}
export function resetText(ad, key) { const all = { ...(ad.textStyles || {}) }; delete all[key]; return { ...ad, textStyles: all }; }

export function setShapeFill(ad, key, color) {
  const all = { ...(ad.shapeFills || {}) };
  if (color) all[key] = color; else delete all[key];
  return { ...ad, shapeFills: all };
}
export function setPlotFill(ad, id, color) {
  const colors = { ...(ad.colors || {}) };
  if (color) colors[id] = color; else delete colors[id];
  return { ...ad, colors };
}

// Snap rotation to 45° steps when within 5°.
export function snapAngle(a) {
  const r = Math.round(a / 45) * 45;
  const v = Math.abs(a - r) <= 5 ? r : Math.round(a * 10) / 10;
  return Math.round((((v % 360) + 540) % 360 - 180) * 10) / 10;
}

export function toHex(c) {
  if (!c) return '#000000';
  if (c[0] === '#') return c.length === 4 ? '#' + [...c.slice(1)].map(x => x + x).join('') : c.slice(0, 7);
  const m = c.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3).map(v => Math.round(+v).toString(16).padStart(2, '0')).join('');
}

// ---- Text effects (shadow + background) ----
export const hasShadow = s => !!(s && s.shColor);
export const fxId = k => 'tf-' + String(k).replace(/[^\w-]/g, '_');

// ---- Keep plot texts inside their plot ----
const insetCorners = (b, f = 0.18) => {
  const ix = b.width * f, iy = b.height * f;
  return [[b.x + ix, b.y + iy], [b.x + b.width - ix, b.y + iy], [b.x + ix, b.y + b.height - iy], [b.x + b.width - ix, b.y + b.height - iy]];
};
const toPath = (text, path, pts) => {
  const m = path.getScreenCTM().inverse().multiply(text.getScreenCTM());
  return pts.map(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(m); return new DOMPoint(p.x, p.y); });
};
// The plot (path[data-id]) a text currently sits in, or null (road names etc.).
export function plotOfText(text) {
  const svg = text.ownerSVGElement; if (!svg) return null;
  const b = text.getBBox();
  for (const p of svg.querySelectorAll('path[data-id]')) {
    const [c] = toPath(text, p, [[b.x + b.width / 2, b.y + b.height / 2]]);
    if (p.isPointInFill(c)) return p;
  }
  return null;
}
// All (inset) corners inside the plot? Falls back to the centre if the text is bigger than the plot.
export function textFits(text, path, strict) {
  const b = text.getBBox();
  const pts = strict ? insetCorners(b) : [[b.x + b.width / 2, b.y + b.height / 2]];
  return toPath(text, path, pts).every(p => path.isPointInFill(p));
}
// Try moving a text wrapper to (dx,dy); stays inside its plot. Returns the accepted [dx,dy].
export function constrainMove(wrap, text, path, s, dx, dy, last) {
  const set = (x, y) => { const t = tWrap({ ...s, dx: x, dy: y }, wrap.dataset.cx, wrap.dataset.cy); if (t) wrap.setAttribute('transform', t); else wrap.removeAttribute('transform'); };
  if (!path) { set(dx, dy); return [dx, dy]; }
  set(last[0], last[1]);
  const strict = textFits(text, path, true);
  for (const [x, y] of [[dx, dy], [dx, last[1]], [last[0], dy]]) { set(x, y); if (textFits(text, path, strict)) return [x, y]; }
  set(last[0], last[1]);
  return last;
}
