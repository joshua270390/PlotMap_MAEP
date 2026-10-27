const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => t > now - WINDOW_MS);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length >= MAX_HITS;
}
async function db(url, key, method, table, query = "", body) {
  const headers = { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Prefer = "return=representation";
  }
  try {
    const response = await fetch(url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : ""), {
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
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim();
  const defaultProjectId = String(parseInt(process.env.PROJECT_ID || "1", 10));
  const plotsTable = process.env.PLOTS_TABLE || "plots";
  const bookingsTable = process.env.BOOKINGS_TABLE || "bookings";
  if (!url || !key) {
    console.error("[enquiry] Supabase URL/key are not configured.");
    return json({ ok: false, error: "Enquiry submission is temporarily unavailable. Please contact our team." }, 500);
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return json({ ok: false, error: "Request not allowed." }, 403);
    } catch { return json({ ok: false, error: "Request not allowed." }, 403); }
  }
  let input; try { input = await request.json(); } catch { input = null; }
  if (!input || typeof input !== "object") return json({ ok: false, error: "Invalid request." }, 400);
  if (input.website) return json({ ok: true });
  const requestedProjectId = String(input.project_id ?? defaultProjectId).trim();
  if (!/^\d+$/.test(requestedProjectId)) return json({ ok: false, error: "Invalid project." }, 422);
  const projectId = requestedProjectId;
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ ok: false, error: "Too many enquiries. Please try again in a few minutes." }, 429);

  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const plotNumber = String(input.plot_number ?? "").trim();
  let message = String(input.message ?? "").trim();
  const digits = phone.replace(/\D/g, "");
  if (!name || name.length > 80) return json({ ok: false, error: "Please enter your name." }, 422);
  if (!/^[+()\d\s-]{10,20}$/.test(phone) || digits.length < 10 || digits.length > 13)
    return json({ ok: false, error: "Please enter a valid mobile number." }, 422);
  if (email && (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))
    return json({ ok: false, error: "Please enter a valid email." }, 422);
  if (!/^[A-Za-z0-9-]{1,20}$/.test(plotNumber)) return json({ ok: false, error: "Invalid unit number." }, 422);
  if (message.length > 500) message = message.slice(0, 500);

  const lookupQuery = new URLSearchParams({ select: "id,status", project_id: "eq." + projectId, plot_number: "eq." + plotNumber, limit: "1" });
  const plot = await db(url, key, "GET", plotsTable, lookupQuery.toString());
  if (!plot.ok) {
    console.error("[enquiry] Plot lookup failed:", plot.error);
    return json({ ok: false, error: "Could not verify this unit. Please try again." }, 502);
  }
  if (!Array.isArray(plot.data) || !plot.data.length) return json({ ok: false, error: "This unit was not found for the selected project." }, 404);
  const inventoryStatus = String(plot.data[0].status || "Available").trim().toLowerCase();
  // Reserved units still accept additional enquiries. Only Booked and Sold are closed.
  if (!["available", "reserved"].includes(inventoryStatus))
    return json({ ok: false, error: "Sorry, this unit is no longer available." }, 409);

  const inserted = await db(url, key, "POST", bookingsTable, "", {
    project_id: Number(projectId), status: "New", source: "Website",
    customer_name: name, email: email || null, phone, notes: message || null, plot_id: Number(plot.data[0].id),
  });
  if (!inserted.ok) {
    console.error("[enquiry] Booking insert failed:", inserted.status, inserted.error);
    return json({ ok: false, error: "Could not save your enquiry. Please try again or call our team." }, 502);
  }
  hits.set(ip, [...(hits.get(ip) || []), Date.now()]);
  return json({ ok: true });
}
