// Admin-only dashboard data access. Uses the service-role key only on the server.
const allowedStatuses = new Set(['Available', 'Reserved', 'Booked', 'Sold']);
const out = (res, code, body) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(body);
};

function parseBody(req) {
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) { return null; } }
  return req.body && typeof req.body === 'object' ? req.body : null;
}

function config() {
  return {
    pin: process.env.ADMIN_PIN || '',
    url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    // Prefer the server-only service-role key; fall back to the same key used by the public map APIs.
    // When the fallback is an anon/publishable key, Supabase RLS still applies.
    key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim(),
    projectId: String(parseInt(process.env.PROJECT_ID || '1', 10)),
    bookingsTable: process.env.BOOKINGS_TABLE || 'bookings',
    plotsTable: process.env.PLOTS_TABLE || 'plots',
  };
}

async function db(cfg, method, table, query, body) {
  const url = cfg.url + '/rest/v1/' + encodeURIComponent(table) + (query ? '?' + query : '');
  const headers = { apikey: cfg.key, Accept: 'application/json' };
  // JWT keys (legacy anon/service_role) belong in Authorization. New sb_publishable keys do not.
  if (cfg.key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + cfg.key;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers.Prefer = 'return=representation';
  }
  let response;
  try {
    response = await fetch(url, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    return { ok: false, status: 0, error: error.message || 'Network error' };
  }
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
  return response.ok
    ? { ok: true, status: response.status, data }
    : { ok: false, status: response.status, error: data?.message || data?.details || 'Database request failed' };
}

function authorized(req, cfg) {
  return !!cfg.pin && String(req.headers['x-admin-pin'] || '') === cfg.pin;
}

export default async function handler(req, res) {
  const cfg = config();
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return out(res, 405, { ok: false, error: 'Method not allowed' });
  }
  if (!authorized(req, cfg)) return out(res, 401, { ok: false, error: 'Admin authentication failed. Please log in again.' });
  if (!cfg.url || !cfg.key) {
    console.error('[admin-data] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY.');
    return out(res, 500, { ok: false, error: 'Dashboard database access is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended), or SUPABASE_KEY with suitable RLS permissions.' });
  }

  if (req.method === 'GET') {
    const view = String(req.query?.view || 'bookings');
    if (view === 'plots') {
      const q = new URLSearchParams({ select: '*', project_id: 'eq.' + cfg.projectId, limit: '2000' });
      const bq = new URLSearchParams({ select: 'id,plot_id,status', project_id: 'eq.' + cfg.projectId, order: 'id.desc', limit: '2000' });
      const [result, bookings] = await Promise.all([
        db(cfg, 'GET', cfg.plotsTable, q.toString()),
        db(cfg, 'GET', cfg.bookingsTable, bq.toString()),
      ]);
      if (!result.ok || !bookings.ok) {
        console.error('[admin-data] Plot list fetch failed:', result.error, bookings.error);
        return out(res, 502, { ok: false, error: 'Could not fetch plot list from Supabase.' });
      }
      const statusByPlot = new Map();
      for (const booking of bookings.data || []) {
        const plotId = String(booking.plot_id);
        if (statusByPlot.has(plotId)) continue;
        statusByPlot.set(plotId, allowedStatuses.has(String(booking.status)) ? String(booking.status) : 'Available');
      }
      const plots = (result.data || []).map(plot => ({
        ...plot,
        status: statusByPlot.get(String(plot.id)) || (allowedStatuses.has(String(plot.status)) ? String(plot.status) : 'Available'),
      }));
      return out(res, 200, { ok: true, plots });
    }
    if (view !== 'bookings') return out(res, 400, { ok: false, error: 'Unknown dashboard view.' });
    const q = new URLSearchParams({ select: '*', project_id: 'eq.' + cfg.projectId, limit: '2000', order: 'id.desc' });
    const bookings = await db(cfg, 'GET', cfg.bookingsTable, q.toString());
    if (!bookings.ok) {
      console.error('[admin-data] Booking fetch failed:', bookings.status, bookings.error);
      return out(res, 502, {
        ok: false,
        error: 'Supabase bookings query failed (' + bookings.status + '): ' + bookings.error,
      });
    }

    // Bookings are the primary dashboard data. A plot-table schema/permission issue
    // must not prevent existing customer bookings from appearing.
    const plotsQuery = new URLSearchParams({ select: 'id,plot_number', project_id: 'eq.' + cfg.projectId, limit: '2000' });
    const plots = await db(cfg, 'GET', cfg.plotsTable, plotsQuery.toString());
    if (!plots.ok) {
      console.error('[admin-data] Plot lookup failed while loading bookings:', plots.status, plots.error);
      return out(res, 200, {
        ok: true,
        bookings: bookings.data || [],
        plots: [],
        warning: 'Bookings loaded. Plot unit numbers could not be loaded (' + plots.status + '): ' + plots.error,
      });
    }
    // Match the public plot map: the newest booking per plot determines its displayed status.
    const statusByPlot = new Map();
    for (const booking of bookings.data || []) {
      const plotId = String(booking.plot_id);
      if (statusByPlot.has(plotId)) continue;
      statusByPlot.set(plotId, allowedStatuses.has(String(booking.status)) ? String(booking.status) : 'Available');
    }
    const mapPlots = (plots.data || []).map(plot => ({
      ...plot,
      status: statusByPlot.get(String(plot.id)) || (allowedStatuses.has(String(plot.status)) ? String(plot.status) : 'Available'),
    }));
    return out(res, 200, { ok: true, bookings: bookings.data || [], plots: mapPlots });
  }

  const body = parseBody(req);
  if (!body) return out(res, 400, { ok: false, error: 'Invalid request body.' });

  if (req.method === 'POST') {
    const customerName = String(body.customer_name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const plotId = String(body.plot_id ?? '').trim();
    const status = String(body.status ?? '');
    if (!customerName || customerName.length > 120) return out(res, 422, { ok: false, error: 'Enter a valid customer name.' });
    if (!phone || phone.length > 25) return out(res, 422, { ok: false, error: 'Enter a valid phone number.' });
    if (!/^\d+$/.test(plotId)) return out(res, 422, { ok: false, error: 'Select a valid plot.' });
    if (!allowedStatuses.has(status)) return out(res, 422, { ok: false, error: 'Select a valid status.' });

    const plotLookup = await db(cfg, 'GET', cfg.plotsTable,
      new URLSearchParams({ select: 'id,project_id', id: 'eq.' + plotId, project_id: 'eq.' + cfg.projectId, limit: '1' }).toString());
    if (!plotLookup.ok || !Array.isArray(plotLookup.data) || !plotLookup.data.length)
      return out(res, 422, { ok: false, error: 'The selected unit does not belong to this project.' });

    const inserted = await db(cfg, 'POST', cfg.bookingsTable, '', {
      project_id: Number(cfg.projectId), customer_name: customerName, phone, plot_id: Number(plotId), status,
    });
    if (!inserted.ok || !Array.isArray(inserted.data) || !inserted.data.length) {
      console.error('[admin-data] Manual customer insert failed:', inserted.status, inserted.error);
      return out(res, 502, { ok: false, error: 'Could not add customer. Check bookings table columns and database permissions.' });
    }
    const plotUpdate = await db(cfg, 'PATCH', cfg.plotsTable,
      new URLSearchParams({ id: 'eq.' + plotId, project_id: 'eq.' + cfg.projectId }).toString(), { status });
    return out(res, 201, {
      ok: true, booking: inserted.data[0], plotStatusSynced: plotUpdate.ok,
      warning: plotUpdate.ok ? undefined : 'Customer added, but plot status could not be synced. Check plot permissions/columns.',
    });
  }

  const id = String(body.id ?? '').trim();
  if (!/^\d+$/.test(id)) return out(res, 422, { ok: false, error: 'A valid booking ID is required.' });
  const bookingFilter = new URLSearchParams({ id: 'eq.' + id, project_id: 'eq.' + cfg.projectId });

  if (req.method === 'DELETE') {
    const existing = await db(cfg, 'GET', cfg.bookingsTable,
      new URLSearchParams({ select: 'id,plot_id', id: 'eq.' + id, project_id: 'eq.' + cfg.projectId, limit: '1' }).toString());
    if (!existing.ok) {
      console.error('[admin-data] Booking lookup before delete failed:', existing.status, existing.error);
      return out(res, 502, { ok: false, error: 'Could not verify the booking before deleting it.' });
    }
    if (!Array.isArray(existing.data) || !existing.data.length)
      return out(res, 404, { ok: false, error: 'Booking was not found.' });

    const plotId = String(existing.data[0].plot_id);
    const removed = await db(cfg, 'DELETE', cfg.bookingsTable, bookingFilter.toString(), undefined);
    if (!removed.ok) {
      console.error('[admin-data] Booking delete failed:', removed.status, removed.error);
      return out(res, 502, { ok: false, error: 'Could not delete booking from Supabase.' });
    }

    // Keep the plot table in sync with the remaining newest booking; if none remain,
    // make the plot available again. The public map also derives its state from bookings.
    const remaining = await db(cfg, 'GET', cfg.bookingsTable,
      new URLSearchParams({ select: 'id,status', plot_id: 'eq.' + plotId, project_id: 'eq.' + cfg.projectId, order: 'id.desc', limit: '1' }).toString());
    let plotStatus = 'Available';
    if (remaining.ok && Array.isArray(remaining.data) && remaining.data.length) {
      const remainingStatus = String(remaining.data[0].status || '');
      plotStatus = allowedStatuses.has(remainingStatus) ? remainingStatus : 'Available';
    }
    const plotSync = await db(cfg, 'PATCH', cfg.plotsTable,
      new URLSearchParams({ id: 'eq.' + plotId, project_id: 'eq.' + cfg.projectId }).toString(), { status: plotStatus });
    return out(res, 200, { ok: true, plotStatus, plotStatusSynced: plotSync.ok });
  }

  const customerName = String(body.customer_name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const plotId = String(body.plot_id ?? '').trim();
  const status = String(body.status ?? '');
  if (!customerName || customerName.length > 120) return out(res, 422, { ok: false, error: 'Enter a valid customer name.' });
  if (!phone || phone.length > 25) return out(res, 422, { ok: false, error: 'Enter a valid phone number.' });
  if (!/^\d+$/.test(plotId)) return out(res, 422, { ok: false, error: 'Select a valid plot.' });
  if (!allowedStatuses.has(status)) return out(res, 422, { ok: false, error: 'Select a valid status.' });

  const plotLookup = await db(cfg, 'GET', cfg.plotsTable,
    new URLSearchParams({ select: 'id,project_id', id: 'eq.' + plotId, project_id: 'eq.' + cfg.projectId, limit: '1' }).toString());
  if (!plotLookup.ok || !Array.isArray(plotLookup.data) || !plotLookup.data.length)
    return out(res, 422, { ok: false, error: 'The selected unit does not belong to this project.' });

  const updated = await db(cfg, 'PATCH', cfg.bookingsTable, bookingFilter.toString(), {
    customer_name: customerName, phone, plot_id: Number(plotId), status,
  });
  if (!updated.ok) {
    console.error('[admin-data] Booking update failed:', updated.status, updated.error);
    return out(res, 502, { ok: false, error: 'Could not update booking. Check the bookings table columns.' });
  }
  if (!Array.isArray(updated.data) || !updated.data.length)
    return out(res, 404, { ok: false, error: 'Booking was not found.' });

  // Keep the plot map's availability in sync with the booking status.
  const plotUpdate = await db(cfg, 'PATCH', cfg.plotsTable,
    new URLSearchParams({ id: 'eq.' + plotId, project_id: 'eq.' + cfg.projectId }).toString(), { status });
  return out(res, 200, {
    ok: true,
    booking: updated.data[0],
    plotStatusSynced: plotUpdate.ok,
    warning: plotUpdate.ok ? undefined : 'Booking saved, but plot status could not be synced. Check plot permissions/columns.',
  });
}

export const config = { maxDuration: 15 };
