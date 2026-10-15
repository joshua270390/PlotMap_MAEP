// Returns { plots: { "51": "Available", ... } } so the map shows live Booked/Sold status.
import { supabase, SUPABASE_URL, SUPABASE_KEY, PROJECT_ID, PLOTS } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false }); }
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ ok: false });
  const q = new URLSearchParams({ select: 'plot_number,status', project_id: 'eq.' + PROJECT_ID, limit: '2000' });
  const r = await supabase('GET', encodeURIComponent(PLOTS) + '?' + q.toString());
  if (!r.ok) { console.error('[velavan-nagar] plots fetch failed:', r.status, r.error); return res.status(502).json({ ok: false }); }
  const plots = {};
  for (const row of r.data || []) plots[String(row.plot_number)] = String(row.status);
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  return res.status(200).json({ ok: true, plots });
}

export const config = { maxDuration: 15 };
