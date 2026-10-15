// Vercel serverless function: replaces api/enquiry.php.
// Flow: validate -> look up plots.id from the plot number -> insert into bookings.
// Settings come from Vercel Environment Variables (see README.md). Nothing secret is in the repo.

import { supabase, SUPABASE_URL, SUPABASE_KEY, PROJECT_ID, BOOKINGS, PLOTS, DEBUG } from './_supabase.js';

// Best-effort rate limit (per warm function instance, so not airtight; see README).
const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000, MAX_HITS = 5;
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => t > now - WINDOW_MS);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length >= MAX_HITS;
}

// Map plot number (what visitors see) -> plots.id of this project
async function findPlot(plotNumber) {
  const q = new URLSearchParams({
    select: 'id,status', project_id: 'eq.' + PROJECT_ID, plot_number: 'eq.' + plotNumber, limit: '1',
  });
  const r = await supabase('GET', encodeURIComponent(PLOTS) + '?' + q.toString());
  if (!r.ok) return r;
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (!row) return { ok: false, status: 404, error: `Plot ${plotNumber} was not found in the database for this project.` };
  return { ok: true, id: Number(row.id), status: String(row.status) };
}

const out = (res, status, data) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(data);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return out(res, 405, { ok: false, error: 'Method not allowed' }); }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[velavan-nagar] SUPABASE_URL / SUPABASE_KEY env vars are missing');
    return out(res, 500, { ok: false, error: DEBUG ? 'Server is missing SUPABASE_URL / SUPABASE_KEY.' : 'Could not save your enquiry.' });
  }

  // Same-site check: browsers always send Origin on a cross-site POST
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (_) {}
    if (host !== req.headers.host) return out(res, 403, { ok: false, error: 'Request not allowed.' });
  }

  let inp = req.body;
  if (typeof inp === 'string') { try { inp = JSON.parse(inp); } catch (_) { inp = null; } }
  if (!inp || typeof inp !== 'object') return out(res, 400, { ok: false, error: 'Invalid request' });

  // Honeypot: real visitors never fill this hidden field
  if (inp.website) return out(res, 200, { ok: true });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return out(res, 429, { ok: false, error: 'Too many enquiries. Please try again in a few minutes.' });

  const name    = String(inp.name ?? '').trim();
  const email   = String(inp.email ?? '').trim();
  const phone   = String(inp.phone ?? '').trim();
  let   message = String(inp.message ?? '').trim();
  const plotNo  = String(inp.plot_number ?? '').trim();
  const digits  = phone.replace(/\D/g, '');

  if (!name || name.length > 80) return out(res, 422, { ok: false, error: 'Please enter your name.' });
  if (!/^[+()\d\s-]{10,20}$/.test(phone) || digits.length < 10 || digits.length > 13)
    return out(res, 422, { ok: false, error: 'Please enter a valid mobile number.' });
  if (email && (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))
    return out(res, 422, { ok: false, error: 'Please enter a valid email.' });
  if (!/^[A-Za-z0-9-]{1,20}$/.test(plotNo)) return out(res, 422, { ok: false, error: 'Invalid plot.' });
  if (message.length > 500) message = message.slice(0, 500);

  const plot = await findPlot(plotNo);
  if (!plot.ok) {
    console.error(`[velavan-nagar] Plot lookup failed (${plot.status}): ${plot.error}`);
    return plot.status === 404
      ? out(res, 404, { ok: false, error: plot.error })
      : out(res, 502, { ok: false, error: DEBUG ? plot.error : 'Could not save your enquiry.' });
  }
  if (plot.status !== 'Available') return out(res, 409, { ok: false, error: 'Sorry, this plot is no longer available.' });

  const r = await supabase('POST', encodeURIComponent(BOOKINGS), {
    project_id: PROJECT_ID, status: 'New', source: 'Website',
    customer_name: name, email: email || null, phone, notes: message || null, plot_id: plot.id,
  });
  if (!r.ok) {
    console.error(`[velavan-nagar] Insert failed (${r.status}): ${r.error}`);
    return out(res, 502, { ok: false, error: DEBUG ? r.error : 'Could not save your enquiry.' });
  }

  hits.set(ip, [...(hits.get(ip) || []), Date.now()]);
  return out(res, 200, { ok: true });
}

export const config = { maxDuration: 15 };
