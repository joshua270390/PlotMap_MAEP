const allowedStatuses = new Set(["Available", "Reserved", "Booked", "Sold"]);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

function customerDetails(row = {}) {
  const fields = {};
  for (const [key, value] of Object.entries(row)) {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (value != null && String(value).trim() && fields[normalized] == null) fields[normalized] = String(value).trim();
  }
  const pick = (...keys) => {
    for (const key of keys) if (fields[key] != null && fields[key] !== "") return fields[key];
    return "";
  };
  const name = pick("customername", "customerfullname", "fullname", "name", "customer");
  const rawPhone = pick("mobilenumber", "mobileno", "customermobile", "customerphone", "phonenumber", "phone", "mobile", "contactnumber", "contact", "telephone");
  let mobile = "";
  if (/[x*]/i.test(rawPhone)) mobile = rawPhone;
  else {
    const digits = rawPhone.replace(/\\D/g, "");
    if (digits.length >= 12) mobile = digits.slice(0, 3) + "xxxxxx" + digits.slice(-3);
    else if (digits.length >= 10) mobile = digits.slice(0, 2) + "xxxxxx" + digits.slice(-2);
    else if (digits.length >= 4) mobile = digits.slice(0, 1) + "xxxx" + digits.slice(-2);
  }
  return { name, mobile };
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  const url = (process.env.SUPABASE_URL || "").replace(/\\/+$/, "");
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
      return response.ok ? { ok: true, data } : { ok: false, status: response.status, error: data?.message || "Database request failed" };
    } catch (error) { return { ok: false, status: 0, error: error.message || "Network error" }; }
  };

  const pq = new URLSearchParams({ select: "*", project_id: "eq." + projectId, limit: "2000" });
  const bq = new URLSearchParams({ select: "*", project_id: "eq." + projectId, order: "id.desc", limit: "2000" });
  const [plotResult, bookingResult] = await Promise.all([get(plotsTable, pq.toString()), get(bookingsTable, bq.toString())]);
  if (!plotResult.ok || !bookingResult.ok) {
    console.error("[plots] Supabase read failed:", plotResult.status, plotResult.error, bookingResult.status, bookingResult.error);
    return json({ ok: false, error: "Could not load plot status or customer details." }, 502);
  }

  const plots = {};
  const details = {};
  const plotNumberById = new Map();
  const plotNumberByAnyKey = new Map();
  for (const plot of plotResult.data || []) {
    const id = String(plot.id);
    const plotNumber = String(plot.plot_number ?? plot.unit_number ?? plot.plot_no ?? plot.unit_no ?? plot.id);
    const statusValue = String(plot.status || "").trim();
    const status = allowedStatuses.has(statusValue) ? statusValue : "Available";
    plotNumberById.set(id, plotNumber);
    plotNumberByAnyKey.set(id, plotNumber);
    plotNumberByAnyKey.set(plotNumber, plotNumber);
    plots[id] = status;
    plots[plotNumber] = status;
    const detail = customerDetails(plot);
    if (detail.name || detail.mobile) {
      details[id] = { ...detail, status };
      details[plotNumber] = { ...detail, status };
    }
  }

  // Use the newest booking with customer information for each plot. Booking status
  // never overrides the plot table's current status.
  const assigned = new Set();
  for (const booking of bookingResult.data || []) {
    const rawPlotKey = String(booking.plot_id ?? booking.plot_number ?? booking.unit_number ?? booking.plot_no ?? "");
    const plotNumber = plotNumberById.get(rawPlotKey) || plotNumberByAnyKey.get(rawPlotKey);
    if (!plotNumber || assigned.has(plotNumber)) continue;
    const detail = customerDetails(booking);
    if (!detail.name && !detail.mobile) continue;
    const status = plots[plotNumber] || "Available";
    const merged = { ...detail, status };
    details[plotNumber] = merged;
    for (const [id, mappedNumber] of plotNumberById) if (mappedNumber === plotNumber) details[id] = merged;
    assigned.add(plotNumber);
  }

  return json({ ok: true, plots, details });
}
