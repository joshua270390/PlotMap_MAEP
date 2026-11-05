import { claimAdminSession, verifyAdmin, releaseAdminSession } from "../lib/admin-session.mjs";

export default async function handler(request) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  const send = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

  if (request.method !== "POST") {
    headers.Allow = "POST";
    return send({ ok: false, error: "Method not allowed" }, 405);
  }

  const expected = process.env.ADMIN_PIN || "";
  if (!expected) {
    console.error("[admin-auth] ADMIN_PIN is not configured.");
    return send({ ok: false, error: "Admin login is not configured on the server. Set ADMIN_PIN in Netlify environment variables." }, 500);
  }

  const action = new URL(request.url).searchParams.get("action") || "login";

  // Heartbeat: keeps this admin's session (and the one-admin lock) alive.
  if (action === "ping") {
    return (await verifyAdmin(request))
      ? send({ ok: true })
      : send({ ok: false, code: "session_ended", error: "Your Admin session has ended. Please sign in again." }, 401);
  }
  if (action === "logout") {
    await releaseAdminSession(request);
    return send({ ok: true });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }

  const pin = String(body?.pin ?? "");
  if (!pin || pin !== expected) return send({ ok: false, error: "Incorrect Admin PIN." }, 401);

  const claim = await claimAdminSession(request.headers.get("x-admin-session") || "");
  if (!claim.ok) return send({ ok: false, code: claim.status === 409 ? "admin_in_use" : "setup", error: claim.error }, claim.status);
  return send({ ok: true, session: claim.session });
}
