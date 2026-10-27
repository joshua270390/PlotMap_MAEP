// Admin edits (plot number, area, position, dimension labels). Same storage key and shape as the old PHP version.
import { P as V_P, DM as V_DM } from './data.js';
import { RATE } from './config.js';

export const AKEY = 'velavan-plot-admin-v1';
const projectKey = geometry => geometry?.key === 'saraswathi_garden' ? 'saraswathi-gardens-plot-admin-v1' : AKEY;
const modelFor = geometry => {
  const P = geometry?.P || V_P;
  const AREAS = {}, POS = {};
  P.forEach(([id, x, y, , area]) => { AREAS[id] = area; POS[id] = [x, y]; });
  return { P, DM: geometry?.DM || V_DM, AREAS, POS };
};
export const AD0 = () => ({ lbl: {}, area: {}, pos: {}, dm: {}, dmDel: [], dmAdd: [], colors: {}, mapColors: {}, plotDetails: {}, rate: 0 });
export const loadAd = geometry => { try { return Object.assign(AD0(), JSON.parse(localStorage.getItem(projectKey(geometry)) || '{}')); } catch (_) { return AD0(); } };
export const saveAd = (ad, geometry) => { try { localStorage.setItem(projectKey(geometry), JSON.stringify(ad)); } catch (_) {} };

export function makeApi(ad, geometry) {
  const { P, DM, AREAS, POS } = modelFor(geometry);
  const lbl = id => { const v = ad.lbl[id]; return v != null && v !== '' ? String(v) : String(id); };
  const areaOf = id => { const v = ad.area[id]; return v != null ? +v : AREAS[id]; };
  const posOf = id => ad.pos[id] || POS[id];
  const findId = v => { v = String(v).trim(); if (!v) return null; const p = P.find(a => lbl(a[0]) === v); return p ? p[0] : null; };
  const dmList = () => {
    const L = [];
    DM.forEach((d, i) => {
      if (ad.dmDel.includes(i)) return;
      const o = ad.dm[i];
      L.push(o ? { k: 'b' + i, ...o } : { k: 'b' + i, t: d[0], x: d[1], y: d[2], r: d[3] });
    });
    ad.dmAdd.forEach((d, i) => { if (d) L.push({ k: 'a' + i, t: d[0], x: d[1], y: d[2], r: d[3] }); });
    return L;
  };
  return { ad, geometry, lbl, areaOf, posOf, findId, dmList, rate: +ad.rate || RATE };
}

const clone = ad => JSON.parse(JSON.stringify(ad));
export function setPlot(ad, id, { nv, av, xv, yv }, geometry) {
  const { AREAS, POS } = modelFor(geometry);
  const n = clone(ad), b = POS[id];
  if (nv === String(id)) delete n.lbl[id]; else n.lbl[id] = nv;
  if (av === AREAS[id]) delete n.area[id]; else n.area[id] = av;
  if (xv === b[0] && yv === b[1]) delete n.pos[id]; else n.pos[id] = [xv, yv];
  return n;
}
export function revertPlot(ad, id, geometry) { const n = clone(ad); const { P } = modelFor(geometry); const p = P.find(row => row[0] === id); delete n.lbl[id]; delete n.area[id]; delete n.pos[id]; return n; }
export function setDm(ad, k, o) {
  const n = clone(ad), i = +k.slice(1);
  if (k[0] === 'b') n.dm[i] = o; else n.dmAdd[i] = [o.t, o.x, o.y, o.r];
  return n;
}
export function delDm(ad, k) {
  const n = clone(ad), i = +k.slice(1);
  if (k[0] === 'b') { delete n.dm[i]; if (!n.dmDel.includes(i)) n.dmDel.push(i); } else n.dmAdd[i] = null;
  return n;
}
export function addDm(ad, x, y) {
  const n = clone(ad);
  n.dmAdd.push(['36', Math.round(x * 10) / 10, Math.round(y * 10) / 10, -90.8]);
  return [n, 'a' + (n.dmAdd.length - 1)];
}
