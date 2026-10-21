import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const cfg = () => ({
  adminPin: process.env.ADMIN_PIN || "",
  url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  secret: process.env.USER_SESSION_SECRET || "",
  table: process.env.USER_ACCESS_TABLE || "user_access",
});
const hashPin = pin => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(pin, salt, 64).toString("hex");
};
const verifyPin = (pin, saved) => {
  const [salt, hex] = String(saved || "").split(":");
  if (!salt || !hex) return false;
  const actual = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
const makeToken = (email, secret) => {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
};
const readToken = (token, secret) => {
  try {
    const [payload, sig] = String(token || "").split(".");
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
};
async function db(c, method, query = "", body, prefer = "return=representation") {
  const response = await fetch(c.url + "/rest/v1/" + c.table + (query ? "?" + query : ""), {
    method,
    headers: {
      apikey: c.key, Authorization: "Bearer " + c.key,
      Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json", Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const raw = await response.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
  return response.ok ? { ok: true, data } : { ok: false, status: response.status, error: data?.message || "Database request failed" };
}
export default async function handler(request) {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const c = cfg();
  if (!c.url || !c.key || !c.secret) return json({ ok: false, error: "User access is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and USER_SESSION_SECRET in Netlify." }, 500);
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const action = String(body?.action || "");
  try {
    if (action === "register") {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const pin = String(body.pin || "");
      if (name.length < 2 || name.length > 120) return json({ ok: false, error: "Enter your full name." }, 422);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ ok: false, error: "Enter a valid email address." }, 422);
      if (!/^[\x21-\x7E]{6,32}$/.test(pin)) return json({ ok: false, error: "PIN must be 6–32 characters and may include letters, numbers, or symbols." }, 422);
      const existing = await db(c, "GET", new URLSearchParams({ select: "id", email: "eq." + email, limit: "1" }).toString());
      if (!existing.ok) return json({ ok: false, error: "Could not verify registration. Please try again." }, 502);
      if (existing.data?.length) return json({ ok: false, error: "An account with this email already exists." }, 409);
      const inserted = await db(c, "POST", "", { name, email, pin_hash: hashPin(pin), status: "pending" });
      if (!inserted.ok) return json({ ok: false, error: "Could not create account. Check the user_access table setup." }, 502);
      return json({ ok: true, status: "pending", message: "Account created. Wait for Admin approval before signing in." }, 201);
    }
    if (action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const pin = String(body.pin || "");
      const found = await db(c, "GET", new URLSearchParams({ select: "email,pin_hash,status,name", email: "eq." + email, limit: "1" }).toString());
      const user = found.ok ? found.data?.[0] : null;
      if (!user || !verifyPin(pin, user.pin_hash)) return json({ ok: false, error: "Incorrect email or PIN." }, 401);
      if (user.status !== "approved") return json({ ok: false, error: user.status === "revoked" ? "Your access has been disabled. Contact Admin." : "Your account is waiting for Admin approval." }, 403);
      return json({ ok: true, role: "user", name: user.name, token: makeToken(email, c.secret) });
    }
    if (action === "verify") {
      const token = readToken(request.headers.get("x-user-session"), c.secret);
      if (!token) return json({ ok: false, error: "User session expired. Please sign in again." }, 401);
      const found = await db(c, "GET", new URLSearchParams({ select: "name,status", email: "eq." + token.email, limit: "1" }).toString());
      const user = found.ok ? found.data?.[0] : null;
      if (!user || user.status !== "approved") return json({ ok: false, error: "User access is not approved." }, 403);
      return json({ ok: true, role: "user", name: user.name });
    }
    if (action === "list" || action === "approve" || action === "revoke" || action === "pending") {
      if (!c.adminPin || request.headers.get("x-admin-pin") !== c.adminPin) return json({ ok: false, error: "Admin authentication failed." }, 401);
      if (action === "list" || action === "pending") {
        const result = await db(c, "GET", new URLSearchParams({ select: "id,name,email,status,created_at,updated_at", order: "created_at.desc", limit: "1000" }).toString());
        return result.ok ? json({ ok: true, users: result.data || [] }) : json({ ok: false, error: "Could not load user accounts." }, 502);
      }
      const id = String(body.id || "");
      if (!/^\d+$/.test(id)) return json({ ok: false, error: "Invalid user id." }, 422);
      const status = action === "approve" ? "approved" : "revoked";
      const result = await db(c, "PATCH", new URLSearchParams({ id: "eq." + id }).toString(), { status, updated_at: new Date().toISOString() });
      return result.ok ? json({ ok: true, status }) : json({ ok: false, error: "Could not update user access." }, 502);
    }
    return json({ ok: false, error: "Unknown action." }, 400);
  } catch (error) {
    console.error("[user-access] Request failed:", error?.message || error);
    return json({ ok: false, error: "User access service failed. Please try again." }, 500);
  }
}
