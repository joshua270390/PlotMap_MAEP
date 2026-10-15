// Admin-only plot status updates. Keep the service-role key and admin PIN on the server.
import { PROJECT_ID, PLOTS, BOOKINGS } from './_supabase.js';

const allowed = new Set(['Available', 'Reserved', 'Booked', 'Sold']);
const out = (res, code, body) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(body);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return out(res, 405, { ok: false, error: 'Method not allowed' }); }
  const adminPin = process.env.ADMIN_PIN || '';
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!adminPin || !url || !key) {
    console.error('[plot-status] Missing ADMIN_PIN, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY.');
    return out(res, 500, { ok: false, error: 'Admin status updates are not configured on the server.' });
  }
  if (String(req.headers['x-admin-pin'] || '') !== adminPin)
    return out(res, 401, { ok: false, error: 'Admin authentication failed. Check the Admin PIN.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = null; } }
  const plotNumber = String(body?.plot_number ?? '').trim();
  const status = String(body?.status ?? '');
  if (!/^[A-Za-z0-9-]{1,20}$/.test(plotNumber) || !allowed.has(status))
    return out(res, 422, { ok: false, error: 'Valid plot number and status are required.' });

  const params = new URLSearchParams({ project_id: 'eq.' + PROJECT_ID, plot_number: 'eq.' + plotNumber });
  let response;
  try {
    response = await fetch(url + '/rest/v1/' + encodeURIComponent(PLOTS) + '?' + params.toString(), {
      method: 'PATCH',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error('[plot-status] Supabase request failed:', e.message || e);
    return out(res, 502, { ok: false, error: 'Could not reach the database.' });
  }
  const raw = await response.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok) {
    console.error('[plot-status] Supabase update failed:', response.status, raw);
    return out(res, 502, { ok: false, error: 'Database rejected the status update. Check the server configuration.' });
  }
  if (!Array.isArray(data) || data.length === 0)
    return out(res, 404, { ok: false, error: 'No plot matched this plot number and project.' });

  // The dashboard booking status is the source of truth for public availability counts.
  const plotId = data[0].id;
  const bookingsTable = process.env.BOOKINGS_TABLE || BOOKINGS;
  const bookingFilter = new URLSearchParams({ project_id: 'eq.' + PROJECT_ID, plot_id: 'eq.' + plotId });
  const bookingResponse = await fetch(url + '/rest/v1/' + encodeURIComponent(bookingsTable) + '?' + bookingFilter.toString(), {
    method: 'PATCH',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
    signal: AbortSignal.timeout(10000),
  });
  if (!bookingResponse.ok) {
    const bookingError = await bookingResponse.text();
    console.error('[plot-status] Booking status sync failed:', bookingResponse.status, bookingError);
    return out(res, 502, { ok: false, error: 'Plot status saved, but booking status sync failed.' });
  }
  return out(res, 200, { ok: true, plot_number: plotNumber, status });
}

export const config = { maxDuration: 15 };
