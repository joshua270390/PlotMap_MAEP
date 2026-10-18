// Map availability follows customer booking statuses. Legacy plot status values are not counted
// until a booking is explicitly marked Reserved, Booked, or Sold in the admin dashboard.
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
  const plotQuery = new URLSearchParams({ select: 'id,plot_number', project_id: 'eq.' + PROJECT_ID, limit: '2000' });
  const bookingQuery = new URLSearchParams({ select: 'id,plot_id,status,customer_name,phone', project_id: 'eq.' + PROJECT_ID, order: 'id.desc', limit: '2000' });
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
  for (const row of plotResult.data || []) {
    const id = String(row.id);
    plotNumberById.set(id, String(row.plot_number));
    plots[String(row.plot_number)] = 'Available';
  }
  const seen = new Set();
  const allowed = new Set(['Available', 'Reserved', 'Booked', 'Sold']);
  for (const booking of bookingResult.data || []) {
    const plotId = String(booking.plot_id);
    if (seen.has(plotId) || !plotNumberById.has(plotId)) continue;
    seen.add(plotId);
    const status = String(booking.status || '');
    const plotNumber = plotNumberById.get(plotId);
    plots[plotNumber] = allowed.has(status) ? status : 'Available';
    const digits = String(booking.phone || '').replace(/\D/g, '');
    const mobileDigits = digits.length >= 10 ? digits.slice(-10) : digits;
    const maskedMobile = mobileDigits.length >= 4
      ? mobileDigits.slice(0, 2) + 'xxxxxx' + mobileDigits.slice(-2)
      : '';
    details[plotNumber] = {
      name: String(booking.customer_name || '').trim(),
      mobile: maskedMobile,
      status: plots[plotNumber],
    };
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, plots, details });
}

export const config = { maxDuration: 15 };
