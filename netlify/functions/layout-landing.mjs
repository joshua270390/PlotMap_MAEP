import { verifyAdmin } from "../lib/admin-session.mjs";
import { verifyEmployeeToken } from "./employee-auth.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const slugPattern = /^[a-z0-9_]{2,80}$/;
const config = () => ({
  url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
  table: process.env.LAYOUT_LANDING_TABLE || "layout_landing_pages",
  employeesTable: process.env.EMPLOYEES_TABLE || "employees",
  employeeSecret: process.env.EMPLOYEE_SESSION_SECRET || "",
});

async function databaseRequest(cfg, method, table, query = "", body, prefer) {
  const headers = {
    apikey: cfg.key,
    Authorization: "Bearer " + cfg.key,
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Prefer = prefer || "return=representation";
  }
  try {
    const response = await fetch(
      cfg.url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : ""),
      {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    );
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (response.ok) return { ok: true, status: response.status, data };
    const error = [data?.code, data?.message, data?.details, data?.hint].filter(Boolean).join(" | ");
    console.error("[layout-landing] Supabase request failed:", response.status, error);
    return { ok: false, status: response.status, error: error || "Database request failed" };
  } catch (error) {
    console.error("[layout-landing] Supabase request error:", error);
    return { ok: false, status: 0, error: error?.message || "Network error" };
  }
}

async function canManage(request, cfg) {
  const adminAuthorized = Boolean(process.env.ADMIN_PIN)
    && request.headers.get("x-admin-pin") === process.env.ADMIN_PIN
    && await verifyAdmin(request);
  if (adminAuthorized) return true;

  const claims = verifyEmployeeToken(
    request.headers.get("x-employee-token"),
    cfg.employeeSecret,
  );
  if (!claims) return false;

  const employee = await databaseRequest(
    cfg,
    "GET",
    cfg.employeesTable,
    new URLSearchParams({
      select: "id,active",
      id: "eq." + String(claims.sub),
      limit: "1",
    }).toString(),
  );
  return Boolean(employee.ok && employee.data?.length && employee.data[0].active !== false);
}

export default async function handler(request) {
  const cfg = config();
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method))
    return json({ ok: false, error: "Method not allowed" }, 405);

  if (!cfg.url || !cfg.key)
    return json({ ok: false, error: "Landing page database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables." }, 500);

  const url = new URL(request.url);
  const slug = String(url.searchParams.get("slug") || "").trim();

  if (request.method === "GET") {
    const adminList = url.searchParams.get("all") === "1";
    if (adminList && !(await canManage(request, cfg)))
      return json({ ok: false, error: "Sign in with an authorized Admin or Employee account." }, 401);
    if (!adminList && !slugPattern.test(slug))
      return json({ ok: false, error: "A valid project slug is required." }, 400);

    const query = new URLSearchParams({ select: "slug,content,updated_at", order: "slug.asc" });
    if (!adminList) {
      query.set("slug", "eq." + slug);
      query.set("limit", "1");
    }
    const result = await databaseRequest(cfg, "GET", cfg.table, query.toString());
    if (!result.ok) {
      const missingTable = result.status === 404 || /relation .* does not exist|table .* not found/i.test(result.error);
      return json({
        ok: false,
        error: missingTable
          ? "The layout_landing_pages table is missing. Run supabase/migrations/20261122_layout_landing_pages.sql in the Supabase SQL Editor."
          : "Could not load landing page content from Supabase. Check the table and Netlify environment variables.",
      }, 502);
    }
    return json(adminList
      ? { ok: true, pages: result.data || [] }
      : { ok: true, page: (result.data || [])[0] || null });
  }

  if (!(await canManage(request, cfg)))
    return json({ ok: false, error: "Please sign in again." }, 401);

  let body = {};
  if (request.method !== "DELETE" || request.headers.get("content-type")?.includes("application/json")) {
    try { body = await request.json(); } catch {
      if (request.method !== "DELETE") return json({ ok: false, error: "Invalid request body." }, 400);
    }
  }
  const targetSlug = String(body?.slug || slug || "").trim();
  if (!slugPattern.test(targetSlug))
    return json({ ok: false, error: "Select a valid project." }, 422);

  if (request.method === "DELETE") {
    const removed = await databaseRequest(
      cfg,
      "DELETE",
      cfg.table,
      new URLSearchParams({ slug: "eq." + targetSlug }).toString(),
    );
    if (!removed.ok) return json({ ok: false, error: "Could not delete landing page content from Supabase." }, 502);
    return json({ ok: true, slug: targetSlug });
  }

  if (!body?.content || typeof body.content !== "object" || Array.isArray(body.content))
    return json({ ok: false, error: "Landing page content is required." }, 422);

  const saved = await databaseRequest(
    cfg,
    "POST",
    cfg.table,
    "on_conflict=slug",
    { slug: targetSlug, content: body.content, updated_at: new Date().toISOString() },
    "resolution=merge-duplicates,return=representation",
  );
  if (!saved.ok) return json({ ok: false, error: "Could not save landing page content. Check the table and permissions in Supabase." }, 502);
  return json({ ok: true, page: Array.isArray(saved.data) ? saved.data[0] : saved.data });
}
