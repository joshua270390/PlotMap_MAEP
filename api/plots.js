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
    // Handle both snake_case columns and legacy columns such as "Name" / "Mobile Number".
    const normalized = {};
    for (const [key, value] of Object.entries(row || {})) {
      const k = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (value != null && String(value).trim() !== '' && normalized[k] == null) normalized[k] = value;
    }
    const firstValue = keys => {
      for (const key of keys) {
        const value = normalized[key];
        if (value != null && String(value).trim() !== '') return String(value).trim();
      }
      return '';
    };
    const name = firstValue(['customername', 'customerfullname', 'fullname', 'name', 'customer']);
    const rawPhone = firstValue(['mobilenumber', 'mobileno', 'customermobile', 'customerphone', 'phonenumber', 'phone', 'mobile', 'contactnumber', 'contact', 'telephone']);
    let mobile = '';
    // Keep an already-masked number (for example 893xxxxxx098) as entered.
    if (/[x*]/i.test(rawPhone)) {
      mobile = rawPhone;
    } else {
      const digits = rawPhone.replace(/\D/g, '');
      if (digits.length >= 12) mobile = digits.slice(0, 3) + 'xxxxxx' + digits.slice(-3);
      else if (digits.length >= 10) mobile = digits.slice(0, 2) + 'xxxxxx' + digits.slice(-2);
      else if (digits.length >= 4) mobile = digits.slice(0, 1) + 'xxxx' + digits.slice(-2);
    }
    return { name, mobile };
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
