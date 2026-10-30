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
