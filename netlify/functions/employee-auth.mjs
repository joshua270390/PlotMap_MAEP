import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const cfg = () => ({
  pin: process.env.ADMIN_PIN || "",
  url: (process.env.SUPABASE_URL || "").replace(/[/]+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
  table: process.env.EMPLOYEES_TABLE || "employees",
  secret: process.env.EMPLOYEE_SESSION_SECRET || "",
});
async function db(c, method, query = "", body) {
  const h = { apikey: c.key, Authorization: "Bearer " + c.key, Accept: "application/json" };
  if (body !== undefined) { h["Content-Type"] = "application/json"; h.Prefer = "return=representation"; }
  const r = await fetch(c.url + "/rest/v1/" + encodeURIComponent(c.table) + (query ? "?" + query : ""), {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  const raw = await r.text(); let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
  return r.ok ? { ok: true, data } : { ok: false, status: r.status, error: data?.message || "Database request failed" };
}
const hashPassword = (password, salt = randomBytes(16).toString("hex")) =>
  ({ salt, hash: scryptSync(password, salt, 64).toString("hex") });
const verifyPassword = (password, salt, hash) => {
  const actual = scryptSync(password, salt, 64), expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
};
const b64 = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const issueToken = (claims, secret) => {
  const payload = b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 });
  return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
};
export function verifyEmployeeToken(token, secret) {
  if (!token || !secret) return null;
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual; try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims.role === "employee" && claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch { return null; }
}
export default async function handler(request) {
  const c = cfg();
  const missing = [!c.url && "SUPABASE_URL", !c.key && "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)", !c.secret && "EMPLOYEE_SESSION_SECRET"].filter(Boolean);
  if (missing.length) return json({ ok: false, error: "Employee login is not configured. Missing Netlify Function environment variable(s): " + missing.join(", ") + ". Check the Deploy Preview context and Functions scope." }, 500);
  if (!["POST", "GET", "PATCH", "DELETE"].includes(request.method)) return json({ ok: false, error: "Method not allowed" }, 405);
  const url = new URL(request.url), action = url.searchParams.get("action") || (request.method === "POST" ? "login" : "list");
  if (action === "login" && request.method === "POST") {
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    if (!username || !password) return json({ ok: false, error: "Enter username and password." }, 400);
    const q = new URLSearchParams({ select: "id,username,email,password_salt,password_hash,active", username: "ilike." + username, limit: "1" });
    const found = await db(c, "GET", q.toString());
    if (!found.ok) return json({ ok: false, error: "Could not verify employee login." }, 502);
    const employee = found.data?.[0];
    if (!employee || employee.active === false || !verifyPassword(password, employee.password_salt, employee.password_hash))
      return json({ ok: false, error: "Invalid username or password." }, 401);
    const token = issueToken({ sub: String(employee.id), username: employee.username, role: "employee" }, c.secret);
    return json({ ok: true, token, username: employee.username, role: "employee" });
  }
  if (!c.pin || request.headers.get("x-admin-pin") !== c.pin)
    return json({ ok: false, error: "Admin authentication failed." }, 401);
  if (action === "list" && request.method === "GET") {
    const result = await db(c, "GET", new URLSearchParams({ select: "id,username,email,created_at", order: "created_at.desc" }).toString());
    return result.ok ? json({ ok: true, employees: result.data || [] }) : json({ ok: false, error: "Could not load employees." }, 502);
  }
  if (action === "create" && request.method === "POST") {
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
    const username = String(body?.username || "").trim(), email = String(body?.email || "").trim().toLowerCase(), password = String(body?.password || "");
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8)
      return json({ ok: false, error: "Use a 3–40 character username, valid email and password with at least 8 characters." }, 422);
    const credentials = hashPassword(password);
    const result = await db(c, "POST", "", { username, email, password_salt: credentials.salt, password_hash: credentials.hash, active: true });
    return result.ok ? json({ ok: true, employee: (result.data || [])[0] ? { id: result.data[0].id, username: result.data[0].username, email: result.data[0].email } : null }) : json({ ok: false, error: /duplicate|unique/i.test(result.error) ? "Username or email already exists." : "Could not create employee." }, result.status === 409 ? 409 : 502);
  }
  if (action === "update" && request.method === "PATCH") {
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
    const id = String(body?.id || ""), username = String(body?.username || "").trim(), email = String(body?.email || "").trim().toLowerCase();
    if (!/^\d+$/.test(id) || !/^[a-zA-Z0-9._-]{3,40}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Enter valid username and email." }, 422);
    const patch = { username, email };
    if (body.password) { if (String(body.password).length < 8) return json({ ok: false, error: "Password must be at least 8 characters." }, 422); Object.assign(patch, hashPassword(String(body.password))); patch.password_hash = patch.hash; delete patch.hash; }
    const result = await db(c, "PATCH", new URLSearchParams({ id: "eq." + id }).toString(), patch);
    return result.ok ? json({ ok: true }) : json({ ok: false, error: "Could not update employee." }, 502);
  }
  if (action === "delete" && request.method === "DELETE") {
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
    const id = String(body?.id || "");
    if (!/^\d+$/.test(id)) return json({ ok: false, error: "Invalid employee." }, 422);
    const result = await db(c, "DELETE", new URLSearchParams({ id: "eq." + id }).toString());
    return result.ok ? json({ ok: true }) : json({ ok: false, error: "Could not delete employee." }, 502);
  }
  return json({ ok: false, error: "Unsupported employee action." }, 405);
}
