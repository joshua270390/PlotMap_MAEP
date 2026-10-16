const allowedStatuses = new Set(["Available", "Reserved", "Booked", "Sold"]);
const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });

function config() {
  return {
    pin: process.env.ADMIN_PIN || "",
    url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
    key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
    projectId: String(parseInt(process.env.PROJECT_ID || "1", 10)),
    bookingsTable: process.env.BOOKINGS_TABLE || "bookings",
    plotsTable: process.env.PLOTS_TABLE || "plots",
  };
}

function keyDiagnostics(cfg) {
  try {
    const parts = cfg.key.split(".");
    const claims = parts.length === 3
      ? JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
      : {};
    return {
      supabaseHost: new URL(cfg.url).host,
      jwtRole: claims.role || "missing",
      jwtAudience: claims.aud || "missing",
      jwtIssuer: claims.iss || "missing",
      keyPrefix: cfg.key.slice(0, 3),
      keyLength: cfg.key.length,
    };
  } catch {
    return { supabaseHost: "unavailable", jwtRole: "unreadable", keyPrefix: cfg.key.slice(0, 3), keyLength: cfg.key.length };
  }
}

async function db(cfg, method, table, query = "", body) {
  const url = cfg.url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : "");
  const headers = { apikey: cfg.key, Authorization: "Bearer " + cfg.key, Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Prefer = method === "PATCH" || method === "POST" ? "return=representation" : "return=minimal";
  }
  try {
    const response = await fetch(url, {
      method, headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    return response.ok
      ? { ok: true, status: response.status, data }
      : { ok: false, status: response.status, error: data?.message || data?.details || "Database request failed" };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || "Network error" };
  }
}

export default async function handler(request) {
  const cfg = config();
  const url = new URL(request.url);
  const method = request.method;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method))
    return json({ ok: false, error: "Method not allowed" }, 405, { Allow: "GET, POST, PATCH, DELETE" });

  if (!cfg.pin || request.headers.get("x-admin-pin") !== cfg.pin)
    return json({ ok: false, error: "Admin authentication failed. Please log in again." }, 401);
  if (!cfg.url || !cfg.key) {
    console.error("[admin-data] Missing Supabase URL/key environment variables.");
    return json({ ok: false, error: "Dashboard database access is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended), or SUPABASE_KEY with suitable RLS permissions." }, 500);
  }

  if (method === "GET") {
    const view = url.searchParams.get("view") || "bookings";
    if (view === "plots") {
      const q = new URLSearchParams({ select: "*", project_id: "eq." + cfg.projectId, limit: "2000" });
      const bq = new URLSearchParams({ select: "id,plot_id,status", project_id: "eq." + cfg.projectId, order: "id.desc", limit: "2000" });
      const [result, bookings] = await Promise.all([
        db(cfg, "GET", cfg.plotsTable, q.toString()),
        db(cfg, "GET", cfg.bookingsTable, bq.toString()),
      ]);
      if (!result.ok || !bookings.ok) {
        console.error("[admin-data] Plot list fetch failed:", result.status, result.error, bookings.status, bookings.error, JSON.stringify(keyDiagnostics(cfg)));
        return json({ ok: false, error: "Could not fetch plot list from Supabase." }, 502);
      }
      const statusByPlot = new Map();
      for (const booking of bookings.data || []) {
        const id = String(booking.plot_id);
        if (!statusByPlot.has(id)) statusByPlot.set(id, allowedStatuses.has(String(booking.status)) ? String(booking.status) : "Available");
      }
      return json({ ok: true, plots: (result.data || []).map(plot => ({ ...plot, status: statusByPlot.get(String(plot.id)) || "Available" })) });
    }
    if (view !== "bookings") return json({ ok: false, error: "Unknown dashboard view." }, 400);

    const q = new URLSearchParams({ select: "*", project_id: "eq." + cfg.projectId, limit: "2000", order: "id.desc" });
    const bookings = await db(cfg, "GET", cfg.bookingsTable, q.toString());
    if (!bookings.ok) {
      console.error("[admin-data] Booking fetch failed:", bookings.status, bookings.error, JSON.stringify(keyDiagnostics(cfg)));
      return json({ ok: false, error: "Supabase bookings query failed (" + bookings.status + "): " + bookings.error }, 502);
    }
    const plotsQuery = new URLSearchParams({ select: "id,plot_number", project_id: "eq." + cfg.projectId, limit: "2000" });
    const plots = await db(cfg, "GET", cfg.plotsTable, plotsQuery.toString());
    if (!plots.ok) {
      console.error("[admin-data] Plot lookup failed:", plots.status, plots.error);
      return json({ ok: true, bookings: bookings.data || [], plots: [], warning: "Bookings loaded, but plot unit numbers could not be loaded (" + plots.status + "): " + plots.error });
    }
    const statusByPlot = new Map();
    for (const booking of bookings.data || []) {
      const plotKey = String(booking.plot_id);
      if (!statusByPlot.has(plotKey)) statusByPlot.set(plotKey, allowedStatuses.has(String(booking.status)) ? String(booking.status) : "Available");
    }
    return json({ ok: true, bookings: bookings.data || [], plots: (plots.data || []).map(plot => ({ ...plot, status: statusByPlot.get(String(plot.id)) || "Available" })) });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  if (!body || typeof body !== "object") return json({ ok: false, error: "Invalid request body." }, 400);
  if (method === "POST") {
    const customerName = String(body.customer_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const plotId = String(body.plot_id ?? "").trim();
    const status = String(body.status ?? "");
    if (!customerName || customerName.length > 120) return json({ ok: false, error: "Enter a valid customer name." }, 422);
    if (!phone || phone.length > 25) return json({ ok: false, error: "Enter a valid phone number." }, 422);
    if (!/^\d+$/.test(plotId)) return json({ ok: false, error: "Select a valid plot." }, 422);
    if (!allowedStatuses.has(status)) return json({ ok: false, error: "Select a valid status." }, 422);

    const lookup = await db(cfg, "GET", cfg.plotsTable,
      new URLSearchParams({ select: "id,project_id", id: "eq." + plotId, project_id: "eq." + cfg.projectId, limit: "1" }).toString());
    if (!lookup.ok || !Array.isArray(lookup.data) || !lookup.data.length)
      return json({ ok: false, error: "The selected unit does not belong to this project." }, 422);

    const inserted = await db(cfg, "POST", cfg.bookingsTable, "", {
      project_id: Number(cfg.projectId), customer_name: customerName, phone, plot_id: Number(plotId), status,
    });
    if (!inserted.ok || !Array.isArray(inserted.data) || !inserted.data.length) {
      console.error("[admin-data] Manual customer insert failed:", inserted.status, inserted.error, JSON.stringify(keyDiagnostics(cfg)));
      return json({ ok: false, error: "Could not add customer. Check bookings table columns and database permissions." }, 502);
    }

    const plotUpdate = await db(cfg, "PATCH", cfg.plotsTable,
      new URLSearchParams({ id: "eq." + plotId, project_id: "eq." + cfg.projectId }).toString(), { status });
    if (!plotUpdate.ok) console.error("[admin-data] Plot status sync failed after manual customer insert:", plotUpdate.status, plotUpdate.error);
    return json({
      ok: true, booking: inserted.data[0], plotStatusSynced: plotUpdate.ok,
      warning: plotUpdate.ok ? undefined : "Customer added, but plot status could not be synced. Check plot permissions/columns.",
    }, 201);
  }

  const id = String(body.id ?? "").trim();
  if (!/^\d+$/.test(id)) return json({ ok: false, error: "A valid booking ID is required." }, 422);
  const filter = new URLSearchParams({ id: "eq." + id, project_id: "eq." + cfg.projectId });

  if (method === "DELETE") {
    const removed = await db(cfg, "DELETE", cfg.bookingsTable, filter.toString());
    if (!removed.ok) {
      console.error("[admin-data] Booking delete failed:", removed.status, removed.error);
      return json({ ok: false, error: "Could not delete booking from Supabase." }, 502);
    }
    return json({ ok: true });
  }

  const customerName = String(body.customer_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const plotId = String(body.plot_id ?? "").trim();
  const status = String(body.status ?? "");
  if (!customerName || customerName.length > 120) return json({ ok: false, error: "Enter a valid customer name." }, 422);
  if (!phone || phone.length > 25) return json({ ok: false, error: "Enter a valid phone number." }, 422);
  if (!/^\d+$/.test(plotId)) return json({ ok: false, error: "Select a valid plot." }, 422);
  if (!allowedStatuses.has(status)) return json({ ok: false, error: "Select a valid status." }, 422);

  const lookup = await db(cfg, "GET", cfg.plotsTable,
    new URLSearchParams({ select: "id,project_id", id: "eq." + plotId, project_id: "eq." + cfg.projectId, limit: "1" }).toString());
  if (!lookup.ok || !Array.isArray(lookup.data) || !lookup.data.length)
    return json({ ok: false, error: "The selected unit does not belong to this project." }, 422);

  const updated = await db(cfg, "PATCH", cfg.bookingsTable, filter.toString(), {
    customer_name: customerName, phone, plot_id: Number(plotId), status,
  });
  if (!updated.ok) {
    console.error("[admin-data] Booking update failed:", updated.status, updated.error);
    return json({ ok: false, error: "Could not update booking. Check the bookings table columns." }, 502);
  }
  if (!Array.isArray(updated.data) || !updated.data.length)
    return json({ ok: false, error: "Booking was not found." }, 404);

  const plotUpdate = await db(cfg, "PATCH", cfg.plotsTable,
    new URLSearchParams({ id: "eq." + plotId, project_id: "eq." + cfg.projectId }).toString(), { status });
  if (!plotUpdate.ok) {
    console.error("[admin-data] Plot status sync failed:", plotUpdate.status, plotUpdate.error, "plotId:", plotId, "status:", status);
  }
  return json({
    ok: true, booking: updated.data[0], plotStatusSynced: plotUpdate.ok,
    warning: plotUpdate.ok ? undefined : "Booking saved, but plot status could not be synced. Check plot permissions/columns.",
  });
}
