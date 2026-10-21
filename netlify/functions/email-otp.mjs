import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const config = () => ({
  url: (process.env.SUPABASE_URL || "").replace(/\\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
  secret: process.env.USER_SESSION_SECRET || "",
  resendKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "",
  usersTable: process.env.USER_ACCESS_TABLE || "user_access",
  otpTable: process.env.USER_EMAIL_OTP_TABLE || "user_email_otps",
});
const validEmail = email => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) && email.length <= 254;
const hashOtp = (email, otp, secret) => createHmac("sha256", secret).update(email + ":" + otp).digest();
const makeToken = (email, secret) => {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
};
async function db(c, table, method, query = "", body, prefer = "return=representation") {
  const response = await fetch(c.url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : ""), {
    method,
    headers: {
      apikey: c.key,
      Authorization: "Bearer " + c.key,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json", Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  return response.ok ? { ok: true, data } : { ok: false, status: response.status, error: data?.message || "Database request failed" };
}
async function sendEmail(c, email, otp) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + c.resendKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: c.emailFrom,
      to: [email],
      subject: "Your Mary Ann Elite Properties sign-in code",
      text: "Your sign-in code is " + otp + ". It expires in 5 minutes. If you did not request this code, you can ignore this email.",
      html: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#20374e"><h2 style="margin:0 0 12px">Mary Ann Elite Properties</h2><p>Use this one-time code to sign in to your account:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px 0">' + otp + '</div><p>This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p><p style="color:#718198;font-size:12px">If you did not request this code, you can safely ignore this email.</p></div>',
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.error("[email-otp] Email provider rejected send:", response.status, data?.message || "");
    throw new Error("Could not send the email OTP. Please check the email service configuration.");
  }
}
export default async function handler(request) {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const c = config();
  if (!c.url || !c.key || !c.secret || !c.resendKey || !c.emailFrom) {
    return json({ ok: false, error: "Email OTP is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY), USER_SESSION_SECRET, RESEND_API_KEY, and EMAIL_FROM in Netlify." }, 500);
  }
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const action = String(body?.action || "");
  const email = String(body?.email || "").trim().toLowerCase();
  if (!validEmail(email)) return json({ ok: false, error: "Enter a valid email address." }, 422);
  try {
    if (action === "send") {
      const userResult = await db(c, c.usersTable, "GET", new URLSearchParams({ select: "email,status", email: "eq." + email, limit: "1" }).toString());
      if (!userResult.ok) return json({ ok: false, error: "Could not check account access. Please try again." }, 502);
      const user = userResult.data?.[0];
      // Keep account existence and approval state private; only approved accounts receive a code.
      if (!user || user.status !== "approved") {
        return json({ ok: true, message: "If this email belongs to an approved account, an OTP has been sent." });
      }
      const previous = await db(c, c.otpTable, "GET", new URLSearchParams({ select: "sent_at", email: "eq." + email, limit: "1" }).toString());
      if (!previous.ok) return json({ ok: false, error: "Email OTP storage is not ready. Please contact Admin." }, 503);
      const lastSent = previous.data?.[0]?.sent_at ? Date.parse(previous.data[0].sent_at) : 0;
      if (lastSent && Date.now() - lastSent < 60_000) {
        return json({ ok: false, error: "Please wait 60 seconds before requesting another OTP." }, 429);
      }
      const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const now = new Date();
      const saved = await db(c, c.otpTable, "POST", "on_conflict=email", {
        email,
        otp_hash: hashOtp(email, otp, c.secret).toString("hex"),
        expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
        attempts: 0,
        sent_at: now.toISOString(),
      }, "resolution=merge-duplicates,return=minimal");
      if (!saved.ok) return json({ ok: false, error: "Email OTP storage is not ready. Please contact Admin." }, 503);
      try {
        await sendEmail(c, email, otp);
      } catch {
        await db(c, c.otpTable, "DELETE", new URLSearchParams({ email: "eq." + email }).toString());
        return json({ ok: false, error: "Could not send the email OTP. Please try again later." }, 502);
      }
      return json({ ok: true, message: "If this email belongs to an approved account, an OTP has been sent." });
    }
    if (action === "verify") {
      const otp = String(body?.otp || "");
      if (!/^[0-9]{6}$/.test(otp)) return json({ ok: false, error: "Enter the 6-digit OTP." }, 422);
      const stored = await db(c, c.otpTable, "GET", new URLSearchParams({ select: "otp_hash,expires_at,attempts", email: "eq." + email, limit: "1" }).toString());
      const record = stored.ok ? stored.data?.[0] : null;
      if (!stored.ok) return json({ ok: false, error: "Email OTP storage is not ready. Please contact Admin." }, 503);
      if (!record || Date.parse(record.expires_at) <= Date.now()) {
        if (record) await db(c, c.otpTable, "DELETE", new URLSearchParams({ email: "eq." + email }).toString());
        return json({ ok: false, error: "Your OTP has expired. Please request a new one." }, 401);
      }
      if (Number(record.attempts) >= 5) {
        await db(c, c.otpTable, "DELETE", new URLSearchParams({ email: "eq." + email }).toString());
        return json({ ok: false, error: "Too many incorrect attempts. Please request a new OTP." }, 429);
      }
      const actual = hashOtp(email, otp, c.secret);
      const expected = Buffer.from(String(record.otp_hash || ""), "hex");
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        await db(c, c.otpTable, "PATCH", new URLSearchParams({ email: "eq." + email }).toString(), { attempts: Number(record.attempts || 0) + 1 });
        return json({ ok: false, error: "Incorrect OTP. Please check the code and try again." }, 401);
      }
      const userResult = await db(c, c.usersTable, "GET", new URLSearchParams({ select: "email,name,status", email: "eq." + email, limit: "1" }).toString());
      const user = userResult.ok ? userResult.data?.[0] : null;
      if (!user || user.status !== "approved") {
        await db(c, c.otpTable, "DELETE", new URLSearchParams({ email: "eq." + email }).toString());
        return json({ ok: false, error: "Your account is not approved. Please contact Admin." }, 403);
      }
      await db(c, c.otpTable, "DELETE", new URLSearchParams({ email: "eq." + email }).toString());
      return json({ ok: true, role: "user", name: user.name || "User", token: makeToken(email, c.secret) });
    }
    return json({ ok: false, error: "Unknown action." }, 400);
  } catch (error) {
    console.error("[email-otp] Request failed:", error?.message || error);
    return json({ ok: false, error: "Email OTP service failed. Please try again." }, 500);
  }
}
