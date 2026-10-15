export default async function handler(request) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

  if (request.method !== "POST") {
    headers.Allow = "POST";
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers });
  }

  const expected = process.env.ADMIN_PIN || "";
  if (!expected) {
    console.error("[admin-auth] ADMIN_PIN is not configured.");
    return new Response(JSON.stringify({ ok: false, error: "Admin login is not configured on the server. Set ADMIN_PIN in Netlify environment variables." }), { status: 500, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const pin = String(body?.pin ?? "");
  if (!pin || pin !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "Incorrect Admin PIN." }), { status: 401, headers });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
