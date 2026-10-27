const allowedStatuses = new Set(["Available", "Reserved", "Booked", "Sold"]);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
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

async function db(cfg, method, table, query = "", body) {
  const headers = { apikey: cfg.key, Authorization: "Bearer " + cfg.key, Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Prefer = "return=representation";
  }
  try {
    const response = await fetch(cfg.url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : ""), {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const raw = await response.text();
    let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
    return response.ok ? { ok: true, status: response.status, data } : { ok: false, status: response.status, error: data?.message || data?.details || "Database request failed" };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || "Network error" };
  }
}

export default async function handler(request) {
  const cfg = config();
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!cfg.pin || request.headers.get("x-admin-pin") !== cfg.pin) return json({ ok: false, error: "Admin authentication failed. Please sign in again." }, 401);
  if (!cfg.url || !cfg.key) return json({ ok: false, error: "Plot status updates are not configured on the server." }, 500);

  let body; try { body = await request.json(); } catch { body = null; }
  const requestedProjectId = String(body?.project_id ?? cfg.projectId).trim();
  if (!/^\d+$/.test(requestedProjectId)) return json({ ok: false, error: "A valid project ID is required." }, 422);
  cfg.projectId = requestedProjectId;
  const plotNumber = String(body?.plot_number ?? "").trim();
  const status = String(body?.status ?? "");
  const bookingId = String(body?.booking_id ?? "").trim();
  if (!/^[A-Za-z0-9-]{1,20}$/.test(plotNumber) || !allowedStatuses.has(status))
    return json({ ok: false, error: "Valid unit number and status are required." }, 422);

  if (["Booked", "Sold"].includes(status) && !/^\d+$/.test(bookingId))
    return json({ ok: false, error: "Select a customer from this unit's Reserved customer list before marking it Booked or Sold." }, 422);

  const plotQuery = new URLSearchParams({ select: "id,plot_number,status", project_id: "eq." + cfg.projectId, plot_number: "eq." + plotNumber });
  const plotLookup = await db(cfg, "GET", cfg.plotsTable, plotQuery.toString());
  if (!plotLookup.ok) return json({ ok: false, error: "Could not look up the unit in Supabase." }, 502);
  if (!Array.isArray(plotLookup.data) || !plotLookup.data.length) return json({ ok: false, error: "No unit matched this number and project." }, 404);
  const plotId = plotLookup.data[0].id;
  const currentInventoryStatus = String(plotLookup.data[0].status || "Available");
  if (["Booked", "Sold"].includes(currentInventoryStatus) && ["Available", "Reserved"].includes(status))
    return json({ ok: false, error: "This unit is already Booked or Sold. Reopen it from the selected customer's booking in the Bookings page." }, 409);

  if (["Booked", "Sold"].includes(status)) {
    const bookingQuery = new URLSearchParams({
      select: "id,plot_id,status", id: "eq." + bookingId,
      project_id: "eq." + cfg.projectId, plot_id: "eq." + plotId, status: "eq.Reserved",
    });
    const selected = await db(cfg, "GET", cfg.bookingsTable, bookingQuery.toString());
    if (!selected.ok) return json({ ok: false, error: "Could not verify the selected Reserved customer." }, 502);
    if (!Array.isArray(selected.data) || !selected.data.length)
      return json({ ok: false, error: "The selected customer is not Reserved for this unit. Refresh the customer list and try again." }, 422);
    const bookingUpdate = await db(cfg, "PATCH", cfg.bookingsTable,
      new URLSearchParams({ project_id: "eq." + cfg.projectId, plot_id: "eq." + plotId, id: "eq." + bookingId }).toString(), { status });
    if (!bookingUpdate.ok || !Array.isArray(bookingUpdate.data) || !bookingUpdate.data.length)
      return json({ ok: false, error: "Could not update the selected customer's booking status." }, 502);
  }

  const plotUpdate = await db(cfg, "PATCH", cfg.plotsTable,
    new URLSearchParams({ project_id: "eq." + cfg.projectId, id: "eq." + plotId }).toString(), { status });
  if (!plotUpdate.ok) return json({ ok: false, error: "Could not save unit status to the plot table." }, 502);

  return json({ ok: true, plot_number: plotNumber, plot_id: plotId, booking_id: bookingId || null, status });
}
