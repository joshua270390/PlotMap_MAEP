// One-admin-at-a-time lock. The active admin session lives in the
// public.admin_session table (single row, id = 1). A session stays active while
// the admin's browser keeps sending requests/heartbeats; after LOCK_SECONDS of
// silence it expires and someone else may sign in.
import { randomBytes } from "node:crypto";

export const LOCK_SECONDS = 120;

const cfg = () => ({
  pin: process.env.ADMIN_PIN || "",
  url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
  table: process.env.ADMIN_SESSION_TABLE || "admin_session",
});

async function db(c, method, query = "", body, prefer) {
  const headers = { apikey: c.key, Authorization: "Bearer " + c.key, Accept: "application/json" };
  if (body !== undefined) { headers["Content-Type"] = "application/json"; headers.Prefer = prefer || "return=representation"; }
  try {
    const r = await fetch(c.url + "/rest/v1/" + encodeURIComponent(c.table) + (query ? "?" + query : ""), {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const raw = await r.text(); let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
    return r.ok ? { ok: true, data } : { ok: false, status: r.status, error: data?.message || "Database request failed" };
  } catch (e) { return { ok: false, status: 0, error: e?.message || "Network error" }; }
}

const isAlive = row => row?.session_id && row.last_seen && (Date.now() - new Date(row.last_seen).getTime()) < LOCK_SECONDS * 1000;

async function readRow(c) {
  const r = await db(c, "GET", "select=*&id=eq.1&limit=1");
  if (!r.ok) { console.error("[admin-session] read failed:", r.status, r.error); return { ok: false }; }
  return { ok: true, row: r.data?.[0] || null };
}
async function writeRow(c, session_id) {
  const r = await db(c, "POST", "on_conflict=id", { id: 1, session_id, last_seen: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
  if (!r.ok) console.error("[admin-session] write failed:", r.status, r.error);
  return r.ok;
}

const SETUP_ERROR = "Admin session lock is not set up. Run supabase/admin-session-and-map-edits.sql in the Supabase SQL Editor.";

// Called on PIN login. Returns { ok, session } or { ok:false, status, error }.
export async function claimAdminSession(clientSession) {
  const c = cfg();
  if (!c.url || !c.key) return { ok: false, status: 500, error: "Database is not configured." };
  const cur = await readRow(c);
  if (!cur.ok) return { ok: false, status: 500, error: SETUP_ERROR };
  const row = cur.row;
  if (isAlive(row) && row.session_id !== clientSession)
    return { ok: false, status: 409, error: "Admin is already signed in on another device. Only one Admin can be signed in at a time." };
  const session = row && row.session_id === clientSession && clientSession ? clientSession : randomBytes(24).toString("hex");
  if (!(await writeRow(c, session))) return { ok: false, status: 500, error: SETUP_ERROR };
  return { ok: true, session };
}

// True when the request carries the right PIN AND the currently active admin session.
// Every successful check also refreshes the heartbeat.
export async function verifyAdmin(request) {
  const c = cfg();
  if (!c.pin || request.headers.get("x-admin-pin") !== c.pin) return false;
  const session = request.headers.get("x-admin-session") || "";
  if (!session) return false;
  const cur = await readRow(c);
  if (!cur.ok || !cur.row || cur.row.session_id !== session) return false;
  if (!isAlive(cur.row)) return false;
  await writeRow(c, session);
  return true;
}

export async function releaseAdminSession(request) {
  const c = cfg();
  const session = request.headers.get("x-admin-session") || "";
  const cur = await readRow(c);
  if (cur.ok && cur.row && session && cur.row.session_id === session) await writeRow(c, null);
}
