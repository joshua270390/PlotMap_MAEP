const allowedStatuses = new Set(["Available", "Reserved", "Booked", "Sold"]);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export default async function handler(request) {
  if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim();
  const projectId = String(parseInt(process.env.PROJECT_ID || "1", 10));
  const plotsTable = process.env.PLOTS_TABLE || "plots";
  const bookingsTable = process.env.BOOKINGS_TABLE || "bookings";
  if (!url || !key) return json({ ok: false, error: "Plot map database access is not configured." }, 500);

  const headers = { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" };
  const get = async (table, query) => {
    try {
      const response = await fetch(url + "/rest/v1/" + encodeURIComponent(table) + "?" + query, {
        headers, signal: AbortSignal.timeout(10000),
      });
      const raw = await response.text();
      let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
      return response.ok ? { ok: true, data } : { ok: false, status: response.status };
    } catch { return { ok: false, status: 0 }; }
  };
  const pq = new URLSearchParams({ select: "id,plot_number,status", project_id: "eq." + projectId, limit: "2000" });
  const bq = new URLSearchParams({ select: "id,plot_id,status", project_id: "eq." + projectId, order: "id.desc", limit: "2000" });
  const [plotResult, bookingResult] = await Promise.all([get(plotsTable, pq.toString()), get(bookingsTable, bq.toString())]);
  if (!plotResult.ok || !bookingResult.ok) {
    console.error("[plots] Supabase read failed:", plotResult.status, bookingResult.status);
    return json({ ok: false, error: "Could not load plot status." }, 502);
  }
  const statusByPlot = new Map();
  for (const booking of bookingResult.data || []) {
    const id = String(booking.plot_id);
    if (!statusByPlot.has(id) && allowedStatuses.has(String(booking.status))) statusByPlot.set(id, String(booking.status));
  }
  const plots = {};
  for (const plot of plotResult.data || []) {
    const status = allowedStatuses.has(String(plot.status)) ? String(plot.status) : statusByPlot.get(String(plot.id)) || "Available";
    plots[String(plot.plot_number)] = status;
  }
  return json({ ok: true, plots });
}
