// Plot-table status is the source of truth for map availability. Booking rows supply customer details only.
import { SUPABASE_URL, SUPABASE_KEY, PROJECT_ID, PLOTS, BOOKINGS } from './_supabase.js';

async function readTable(table, query) {
  const url = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + encodeURIComponent(table) + '?' + query;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY).trim();
  const headers = { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' };
  let response;
  try { response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) }); }
  catch (error) { return { ok: false, status: 0, error: error.message || 'Network error' }; }
  const raw = await response.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
  return response.ok ? { ok: true, data } : { ok: false, status: response.status, error: data?.message || 'Database request failed' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false }); }
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ ok: false });
  const plotQuery = new URLSearchParams({ select: '*', project_id: 'eq.' + PROJECT_ID, limit: '2000' });
  const bookingQuery = new URLSearchParams({ select: '*', project_id: 'eq.' + PROJECT_ID, order: 'id.desc', limit: '2000' });
  const [plotResult, bookingResult] = await Promise.all([
    readTable(PLOTS, plotQuery.toString()),
    readTable(BOOKINGS, bookingQuery.toString()),
  ]);
  if (!plotResult.ok || !bookingResult.ok) {
    console.error('[velavan-nagar] map status fetch failed:', plotResult.error, bookingResult.error);
    return res.status(502).json({ ok: false });
  }
  const plots = {};
  const details = {};
  const plotNumberById = new Map();
  const plotNumberByAnyKey = new Map();
  const statusName = value => {
    const normalized = String(value || '').trim().toLowerCase();
    return ({ available: 'Available', reserved: 'Reserved', booked: 'Booked', sold: 'Sold' })[normalized] || 'Available';
  };
  const makeDetail = row => {
    const rawName = row.customer_name ?? row.customer_full_name ?? row.full_name ?? row.customer ?? row.name ?? '';
    const rawPhone = row.phone ?? row.customer_phone ?? row.customer_mobile ?? row.phone_number ?? row.mobile ?? row.mobile_number ?? row.mobile_no ?? row.contact_number ?? row.contact ?? '';
    const digits = String(rawPhone || '').replace(/\D/g, '');
    const mobileDigits = digits.length >= 10 ? digits.slice(-10) : digits;
    const mobile = mobileDigits.length >= 4 ? mobileDigits.slice(0, 2) + 'xxxxxx' + mobileDigits.slice(-2) : '';
    return { name: String(rawName || '').trim(), mobile };
  };
  for (const row of plotResult.data || []) {
    const id = String(row.id);
    const plotNumber = String(row.plot_number ?? row.unit_number ?? row.id);
    const status = statusName(row.status);
    plotNumberById.set(id, plotNumber);
    plotNumberByAnyKey.set(id, plotNumber);
    plotNumberByAnyKey.set(plotNumber, plotNumber);
    plots[id] = status;
    plots[plotNumber] = status;
    const detail = makeDetail(row);
    if (detail.name || detail.mobile) {
      details[id] = { ...detail, status };
      details[plotNumber] = { ...detail, status };
    }
  }

  // Bookings never override map status. Match by either the database plot ID or map plot number.
  // Prefer the newest booking with actual customer data, so a blank newer row doesn't hide details.
  const detailsAssigned = new Set();
  for (const booking of bookingResult.data || []) {
    const plotKey = String(booking.plot_id ?? booking.plot_number ?? booking.unit_number ?? '');
    // Prefer the foreign-key ID when present; fall back to a displayed plot/unit number.
    const plotNumber = plotNumberById.get(plotKey) || plotNumberByAnyKey.get(plotKey);
    if (!plotNumber || detailsAssigned.has(plotNumber)) continue;
    const detail = makeDetail(booking);
    if (!detail.name && !detail.mobile) continue;
    const status = plots[plotNumber] || 'Available';
    const merged = { ...detail, status };
    details[plotNumber] = merged;
    for (const [id, mappedNumber] of plotNumberById) {
      if (mappedNumber === plotNumber) details[id] = merged;
    }
    detailsAssigned.add(plotNumber);
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, plots, details });
}

export const config = { maxDuration: 15 };
