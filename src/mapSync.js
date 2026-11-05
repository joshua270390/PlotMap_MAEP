// Merge helpers for shared plot-map edits.
// Each browser remembers the last server copy it saw ("base"). Its own changes are
// the difference between base and its current copy; those changes are replayed on
// top of the newest server copy, so Admin and Employee edits never wipe each other.

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Field-level difference: object sections (colors, textStyles, ...) per entry,
// everything else (rate, dmDel, dmAdd) as a whole value.
export function diffAd(base, next) {
  const b = base || {}, n = next || {}, out = {};
  new Set([...Object.keys(b), ...Object.keys(n)]).forEach(sec => {
    const bv = b[sec], nv = n[sec];
    if (same(bv, nv)) return;
    if (isObj(bv) && isObj(nv)) {
      const set = {}, del = [];
      new Set([...Object.keys(bv), ...Object.keys(nv)]).forEach(k => {
        if (!(k in nv)) del.push(k);
        else if (!same(bv[k], nv[k])) set[k] = nv[k];
      });
      if (Object.keys(set).length || del.length) out[sec] = { set, del };
    } else out[sec] = { value: nv };
  });
  return out;
}

export const isEmptyDiff = d => !d || Object.keys(d).length === 0;

export function applyDiff(doc, diff) {
  const out = { ...(doc || {}) };
  Object.entries(diff || {}).forEach(([sec, ch]) => {
    if ('value' in ch) { if (ch.value === undefined) delete out[sec]; else out[sec] = ch.value; return; }
    const cur = isObj(out[sec]) ? { ...out[sec] } : {};
    ch.del.forEach(k => { delete cur[k]; });
    Object.assign(cur, ch.set);
    out[sec] = cur;
  });
  return out;
}

// True when the copy holds any real edit (not just the empty template).
export const hasEdits = ad => Object.entries(ad || {}).some(([k, v]) =>
  k === 'rate' ? Number(v) > 0 : Array.isArray(v) ? v.length > 0 : isObj(v) ? Object.keys(v).length > 0 : false);

export const sameDoc = same;
export const sameStamp = (a, b) => (a == null && b == null) || (a != null && b != null && Date.parse(a) === Date.parse(b));
