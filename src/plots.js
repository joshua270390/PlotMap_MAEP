import { P } from './data.js';
export const NAMES = { a: 'Available', b: 'Booked', s: 'Sold' };
export const AREAS = {}, PM = {}, POS = {};
P.forEach(([id, x, y, , ar, pm]) => { AREAS[id] = ar; PM[id] = pm; POS[id] = [x, y]; });
export const toStatus = v => (v === 'Available' ? 'a' : v === 'Sold' ? 's' : 'b');
export const inr = n => '\u20b9 ' + (+n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const cents = a => { const c = Math.floor(a / 435.6); return [c, Math.round(a - c * 435.6)]; };
