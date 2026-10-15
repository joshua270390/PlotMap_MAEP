// Map availability follows customer booking statuses. Legacy plot status values are not counted
// until a booking is explicitly marked Reserved, Booked, or Sold in the admin dashboard.
import { supabase, SUPABASE_URL, SUPABASE_KEY, PROJECT_ID, PLOTS, BOOKINGS } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false }); }
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ ok: false });
  const plotQuery = new URLSearchParams({ select: 'id,plot_number', project_id: 'eq.' + PROJECT_ID, limit: '2000' });
  const bookingQuery = new URLSearchParams({ select: 'id,plot_id,status', project_id: 'eq.' + PROJECT_ID, order: 'id.desc', limit: '2000' });
  const [plotResult, bookingResult] = await Promise.all([
    supabase('GET', encodeURIComponent(PLOTS) + '?' + plotQuery.toString()),
    supabase('GET', encodeURIComponent(BOOKINGS) + '?' + bookingQuery.toString()),
  ]);
  if (!plotResult.ok || !bookingResult.ok) {
    console.error('[velavan-nagar] map status fetch failed:', plotResult.error, bookingResult.error);
    return res.status(502).json({ ok: false });
  }
  const plots = {};
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
    plots[plotNumberById.get(plotId)] = allowed.has(status) ? status : 'Available';
  }
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
  return res.status(200).json({ ok: true, plots });
}

export const config = { maxDuration: 15 };
