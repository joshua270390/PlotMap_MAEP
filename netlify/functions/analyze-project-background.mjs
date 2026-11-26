import { createHmac, timingSafeEqual } from "node:crypto";
import { analyse } from "./create-project.mjs";

const cfg = () => ({
  url: (process.env.SUPABASE_URL || "").replace(/\\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
  jobs: process.env.PROJECT_ANALYSIS_JOBS_TABLE || "project_analysis_jobs",
  bucket: process.env.PROJECT_FILES_BUCKET || "plot-project-files",
});
const headers = c => ({ apikey: c.key, Authorization: "Bearer " + c.key, Accept: "application/json" });
async function db(c, table, method, query = "", body) {
  const h = headers(c);
  if (body !== undefined) { h["Content-Type"] = "application/json"; h.Prefer = "return=representation"; }
  try {
    const response = await fetch(c.url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : ""), {
      method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await response.text(); let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    return response.ok ? { ok: true, data } : { ok: false, status: response.status, error: data?.message || data?.details || "Database request failed" };
  } catch (e) { return { ok: false, status: 0, error: e?.message || "Network error" }; }
}
async function removeObject(c, path) {
  if (!path) return true;
  try {
    const response = await fetch(c.url + "/storage/v1/object/" + c.bucket, {
      method: "DELETE", headers: { ...headers(c), "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }), signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch { return false; }
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export default async function handler(request) {
  const c = cfg();
  if (!c.url || !c.key) return json({ ok: false, error: "Supabase is not configured." }, 500);
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid background job payload." }, 400); }
  const payload = {
    job_id: String(body?.job_id || ""),
    source_file_path: String(body?.source_file_path || ""),
    file_name: String(body?.file_name || ""),
    file_type: String(body?.file_type || ""),
  };
  const signature = String(body?.signature || "");
  if (!/^[0-9a-f-]{36}$/i.test(payload.job_id) ||
      payload.source_file_path !== "analysis/" + payload.job_id + "/" + payload.source_file_path.split("/").pop() ||
      !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(payload.file_type)) {
    return json({ ok: false, error: "Invalid background job details." }, 422);
  }
  const expected = createHmac("sha256", c.key).update(JSON.stringify(payload)).digest();
  let actual;
  try { actual = Buffer.from(signature, "hex"); } catch { actual = Buffer.alloc(0); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return json({ ok: false, error: "Invalid background job signature." }, 401);
  }

  const query = new URLSearchParams({ select: "job_id,source_file_path,file_name,file_type,status", job_id: "eq." + payload.job_id, limit: "1" }).toString();
  const found = await db(c, c.jobs, "GET", query);
  if (!found.ok || !found.data?.[0]) return json({ ok: false, error: "Analysis job was not found." }, 404);
  const job = found.data[0];
  if (job.status !== "pending" || job.source_file_path !== payload.source_file_path) return json({ ok: true, skipped: true });

  const claimed = await db(c, c.jobs, "PATCH",
    new URLSearchParams({ job_id: "eq." + payload.job_id, status: "eq.pending" }).toString(),
    { status: "processing", updated_at: new Date().toISOString() });
  if (!claimed.ok) return json({ ok: false, error: "Could not claim the analysis job." }, 503);
  if (!claimed.data?.length) return json({ ok: true, skipped: true });

  try {
    const objectPath = job.source_file_path.split("/").map(encodeURIComponent).join("/");
    const downloaded = await fetch(c.url + "/storage/v1/object/" + c.bucket + "/" + objectPath, {
      headers: headers(c), signal: AbortSignal.timeout(30000),
    });
    if (!downloaded.ok) throw new Error("Could not read the uploaded source plan from private storage.");
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw new Error("The uploaded source plan is empty or exceeds the 4 MB limit.");
    const file = {
      name: job.file_name || "layout",
      type: job.file_type,
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
    const result = await analyse(c, file);
    const saved = await db(c, c.jobs, "PATCH",
      new URLSearchParams({ job_id: "eq." + payload.job_id, status: "eq.processing" }).toString(),
      { status: "completed", result, error: null, updated_at: new Date().toISOString() });
    if (!saved.ok || !saved.data?.length) throw new Error("Could not save the completed AI analysis result.");
    if (!(await removeObject(c, job.source_file_path))) console.error("[plot-analysis] Temporary source cleanup failed:", job.source_file_path);
  } catch (error) {
    const message = String(error?.message || "AI analysis failed. Please try another source file.").slice(0, 500);
    await db(c, c.jobs, "PATCH",
      new URLSearchParams({ job_id: "eq." + payload.job_id }).toString(),
      { status: "failed", error: message, updated_at: new Date().toISOString() });
    if (!(await removeObject(c, job.source_file_path))) console.error("[plot-analysis] Failed-job source cleanup failed:", job.source_file_path);
    console.error("[plot-analysis] Background analysis failed:", message);
  }
  return json({ ok: true });
}

export const config = { background: true };
