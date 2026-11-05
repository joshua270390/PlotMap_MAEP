// Shared plot-map edits (plot labels, colours, text styles, etc.) per project.
// Everyone can read; only the signed-in Admin or an active Employee can save.
import { verifyEmployeeToken } from "./employee-auth.mjs";
import { verifyAdmin } from "../lib/admin-session.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const cfg = () => ({
  url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
  table: process.env.MAP_EDITS_TABLE || "map_edits",
  employees: process.env.EMPLOYEES_TABLE || "employees",
});
async function db(c, table, method, query = "", body, prefer) {
  const headers = { apikey: c.key, Authorization: "Bearer " + c.key, Accept: "application/json" };
  if (body !== undefined) { headers["Content-Type"] = "application/json"; headers.Prefer = prefer || "return=representation"; }
  try {
    const r = await fetch(c.url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : ""), {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const raw = await r.text(); let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
    return r.ok ? { ok: true, data } : { ok: false, status: r.status, error: data?.message || "Database request failed" };
  } catch (e) { return { ok: false, status: 0, error: e?.message || "Network error" }; }
}
const validKey = k => /^[a-z0-9_-]{1,60}$/.test(k);

export default async function handler(request) {
  const c = cfg();
  if (!c.url || !c.key) return json({ ok: false, error: "Map edits storage is not configured." }, 500);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const project = String(url.searchParams.get("project") || "");
    if (!validKey(project)) return json({ ok: false, error: "Invalid project." }, 422);
    const r = await db(c, c.table, "GET", new URLSearchParams({ select: "data,updated_at,updated_by", project_key: "eq." + project, limit: "1" }).toString());
    if (!r.ok) { console.error("[map-edits] read failed:", r.status, r.error); return json({ ok: false, error: "Could not load map edits." }, 502); }
    const row = r.data?.[0];
    return json({ ok: true, data: row?.data || null, updated_at: row?.updated_at || null, updated_by: row?.updated_by || null });
  }

  if (request.method !== "PUT") return json({ ok: false, error: "Method not allowed" }, 405);

  let who = null;
  if (await verifyAdmin(request)) who = "admin";
  else {
    const claims = verifyEmployeeToken(request.headers.get("x-employee-token"), process.env.EMPLOYEE_SESSION_SECRET || "");
    if (claims) {
      const e = await db(c, c.employees, "GET", new URLSearchParams({ select: "id,active", id: "eq." + claims.sub, limit: "1" }).toString());
      if (e.ok && e.data?.length && e.data[0].active !== false) who = "employee:" + claims.username;
    }
  }
  if (!who) return json({ ok: false, code: "unauthorized", error: "Sign in as Admin or Employee to save map changes." }, 401);

  const raw = await request.text();
  if (raw.length > 2_000_000) return json({ ok: false, error: "Map edits are too large." }, 413);
  let body; try { body = JSON.parse(raw); } catch { body = null; }
  const project = String(body?.project || "");
  if (!validKey(project) || !body?.data || typeof body.data !== "object" || Array.isArray(body.data))
    return json({ ok: false, error: "Invalid map edits." }, 422);

  const updated_at = new Date().toISOString();
  const row = { project_key: project, data: body.data, updated_at, updated_by: who };
  const conflict = () => json({ ok: false, code: "conflict", error: "Someone else saved changes first. Merging and retrying." }, 409);
  const failed = w => { console.error("[map-edits] write failed:", w.status, w.error); return json({ ok: false, error: "Could not save map edits. Run supabase/admin-session-and-map-edits.sql if not done yet." }, 502); };

  if (!("base" in body)) {
    // Old clients: plain overwrite.
    const w = await db(c, c.table, "POST", "on_conflict=project_key", row, "resolution=merge-duplicates,return=minimal");
    return w.ok ? json({ ok: true, updated_at }) : failed(w);
  }
  if (body.base == null) {
    // First save for this project: insert only if nobody created it meanwhile.
    const w = await db(c, c.table, "POST", "", row, "return=minimal");
    if (w.ok) return json({ ok: true, updated_at });
    return w.status === 409 ? conflict() : failed(w);
  }
  const baseTime = Date.parse(String(body.base));
  if (!Number.isFinite(baseTime)) return json({ ok: false, error: "Invalid base version." }, 422);
  // Save only if the row is still the version this browser started from (atomic check in the database).
  const q = new URLSearchParams({ project_key: "eq." + project, updated_at: "eq." + String(body.base) }).toString();
  const w = await db(c, c.table, "PATCH", q, { data: body.data, updated_at, updated_by: who }, "return=representation");
  if (!w.ok) return failed(w);
  if (!w.data?.length) return conflict();
  return json({ ok: true, updated_at: w.data[0].updated_at || updated_at });
}
