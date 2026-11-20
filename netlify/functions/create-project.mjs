import { randomUUID } from "node:crypto";
import { verifyAdmin } from "../lib/admin-session.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const cfg = () => ({
  url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
  projects: process.env.CUSTOM_PROJECTS_TABLE || "custom_projects",
  plots: process.env.PLOTS_TABLE || "plots",
  bookings: process.env.BOOKINGS_TABLE || "bookings",
  edits: process.env.MAP_EDITS_TABLE || "map_edits",
  bucket: process.env.PROJECT_FILES_BUCKET || "plot-project-files",
});
const headers = c => ({ apikey: c.key, Authorization: "Bearer " + c.key, Accept: "application/json" });
async function db(c, table, method, query = "", body) {
  const h = headers(c);
  if (body !== undefined) { h["Content-Type"] = "application/json"; h.Prefer = "return=representation"; }
  try {
    const r = await fetch(c.url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : ""), {
      method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    const raw = await r.text(); let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
    return r.ok ? { ok: true, data } : { ok: false, status: r.status, error: data?.message || data?.details || "Database request failed" };
  } catch (e) { return { ok: false, status: 0, error: e?.message || "Network error" }; }
}
const cleanSlug = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 55);
const validFile = file => file && file.size > 0 && file.size <= 15 * 1024 * 1024 &&
  (file.type === "application/pdf" || ["image/png", "image/jpeg", "image/webp"].includes(file.type));
async function upload(c, path, file) {
  const r = await fetch(c.url + "/storage/v1/object/" + c.bucket + "/" + path.split("/").map(encodeURIComponent).join("/"), {
    method: "POST", headers: { ...headers(c), "Content-Type": file.type, "x-upsert": "true" },
    body: file, signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error("Could not upload source file to Supabase Storage.");
  return path;
}
async function removeObject(c, path) {
  if (!path) return;
  try { await fetch(c.url + "/storage/v1/object/" + c.bucket, {
    method: "DELETE", headers: { ...headers(c), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [path] }),
  }); } catch {}
}
function normalizeGeometry(result) {
  const width = 2000, height = 2000;
  const pointString = points => points.map(([x,y]) => {
    const px = Math.max(0, Math.min(width, Math.round(Number(x) / 1000 * width)));
    const py = Math.max(0, Math.min(height, Math.round(Number(y) / 1000 * height)));
    return px + "," + py;
  }).join(" ");
  const center = points => {
    const p = points.map(([x,y]) => [Number(x) / 1000 * width, Number(y) / 1000 * height]);
    return [Math.round(p.reduce((s,v)=>s+v[0],0)/p.length), Math.round(p.reduce((s,v)=>s+v[1],0)/p.length)];
  };
  const plots = (result.plots || []).filter(p => Array.isArray(p.polygon) && p.polygon.length >= 3 && p.polygon.length <= 40 && String(p.plot_number || "").trim());
  if (!plots.length) throw new Error("AI could not identify clear plot boundaries. Try a sharper PDF or image.");
  const ids = new Set();
  const P = plots.map(p => {
    const id = String(p.plot_number).trim().slice(0, 20);
    if (!/^[A-Za-z0-9-]+$/.test(id) || ids.has(id)) throw new Error("AI returned duplicate or invalid plot numbers. Please upload a clearer plan.");
    ids.add(id);
    const [x,y] = Array.isArray(p.label_position) && p.label_position.length === 2 ? center([p.label_position]) : center(p.polygon);
    return [id, x, y, pointString(p.polygon), Math.max(0, Number(p.area_sqft) || 0), false];
  });
  const paths = values => (values || []).filter(v => Array.isArray(v.polygon) && v.polygon.length >= 3 && v.polygon.length <= 100)
    .map(v => "M" + pointString(v.polygon).replace(/ /g, "L") + "Z");
  return {
    compact: true, canvasWidth: width, canvasHeight: height,
    bounds: { x: 0, y: 0, width, height },
    P, G: { base: paths(result.roads), park: paths(result.parks), misc: [], dash: [], trees: [] },
    LB: [], DM: [], plotAreaLabels: [], roadLabels: [], dimensionLabels: [],
  };
}
async function analyse(c, file) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is missing from Netlify Function environment variables.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = "data:" + file.type + ";base64," + bytes.toString("base64");
  const fileContent = file.type === "application/pdf"
    ? [{ type: "input_file", filename: file.name || "layout.pdf", file_data: dataUrl }]
    : [{ type: "input_image", image_url: dataUrl, detail: "high" }];
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      plots: { type: "array", items: { type: "object", additionalProperties: false, properties: {
        plot_number: { type: "string" }, area_sqft: { type: "number" },
        confidence: { type: "number" }, label_position: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
        polygon: { type: "array", items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, minItems: 3, maxItems: 40 },
      }, required: ["plot_number","area_sqft","confidence","label_position","polygon"] } },
      roads: { type: "array", items: { type: "object", additionalProperties: false, properties: { polygon: { type: "array", items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, minItems: 3, maxItems: 100 } }, required: ["polygon"] } },
      parks: { type: "array", items: { type: "object", additionalProperties: false, properties: { polygon: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 } }, required: ["polygon"] } },
      notes: { type: "string" },
    }, required: ["plots","roads","parks","notes"],
  };
  const prompt = "You are extracting a plotted land layout drawing for a real-estate map. Return ONLY clearly visible plots. Never invent a plot, number, area, or boundary. Each polygon is the visible plot outline in clockwise order. Coordinates are normalized to the entire page/canvas: x and y from 0 to 1000. label_position is the plot-number label center in the same coordinates. Read area_sqft only when legible; otherwise use 0. confidence is 0 to 1. Include road and park outlines only when their boundaries are clearly visible. If a plot boundary or number is ambiguous, omit that plot and explain in notes. Keep the geometry faithful to the source; this is a draft requiring human verification.";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_PLOT_MODEL || "gpt-4.1",
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...fileContent] }],
      text: { format: { type: "json_schema", name: "plot_layout_extraction", strict: true, schema } },
      max_output_tokens: 12000,
    }), signal: AbortSignal.timeout(120000),
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[create-project] OpenAI error:", response.status, raw?.error?.message || "unknown");
    throw new Error("AI analysis failed. Check API billing, model access and uploaded file quality.");
  }
  const output = (raw.output || []).flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
  if (!output) throw new Error("AI did not return plot-layout data. Please try another file.");
  let parsed; try { parsed = JSON.parse(output); } catch { throw new Error("AI returned invalid layout data. Please retry."); }
  return { geometry: normalizeGeometry(parsed), notes: parsed.notes || "", plots: parsed.plots || [] };
}
export default async function handler(request) {
  const c = cfg();
  if (!c.url || !c.key) return json({ ok: false, error: "Supabase is not configured." }, 500);
  if (!process.env.ADMIN_PIN || !(await verifyAdmin(request))) return json({ ok: false, error: "Only the signed-in Admin can manage projects." }, 401);
  const action = new URL(request.url).searchParams.get("action") || "";
  if (request.method === "POST" && action === "analyze") {
    let form; try { form = await request.formData(); } catch { return json({ ok: false, error: "Upload a PDF or image file." }, 400); }
    const file = form.get("file");
    if (!validFile(file)) return json({ ok: false, error: "Upload a PDF, PNG, JPG or WEBP file up to 15 MB." }, 422);
    try {
      const result = await analyse(c, file);
      return json({ ok: true, ...result });
    } catch (e) { return json({ ok: false, error: e.message || "Could not analyse the uploaded plan." }, 422); }
  }
  if (request.method === "POST" && action === "create") {
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid project data." }, 400); }
    const name = String(body?.name || "").trim(), description = String(body?.description || "").trim(), location = String(body?.location || "").trim();
    const route = String(body?.route || "").trim(), slug = cleanSlug(route.replace(/^\/+/, "").split("/")[0]);
    const geometry = body?.geometry;
    if (!name || name.length > 120 || !route || !/^\/[a-z0-9_-]{2,55}$/.test(route) || !slug || !geometry?.P?.length)
      return json({ ok: false, error: "Enter a project name, a valid route such as /new_project, and analyse a source file first." }, 422);
    const exists = await db(c, c.projects, "GET", new URLSearchParams({ select: "id", or: "(slug.eq." + slug + ",route.eq." + route + ")", limit: "1" }).toString());
    if (!exists.ok) return json({ ok: false, error: "Could not check existing project routes. Run the Create Plots SQL setup." }, 502);
    if (exists.data?.length) return json({ ok: false, error: "That project route already exists. Choose another route." }, 409);
    const latest = await db(c, c.plots, "GET", new URLSearchParams({ select: "project_id", order: "project_id.desc", limit: "1" }).toString());
    if (!latest.ok) return json({ ok: false, error: "Could not allocate a project ID from the plots table." }, 502);
    const projectId = Math.max(5, Number(latest.data?.[0]?.project_id || 5)) + 1;
    let sourcePath = null, insertedProject = null;
    try {
      const file = form.get("file");
      if (!validFile(file)) return json({ ok: false, error: "Please upload the source PDF or image again." }, 422);
      sourcePath = "projects/" + slug + "/" + randomUUID() + "-" + String(file.name || "layout").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90);
      await upload(c, sourcePath, file);
      const inserted = await db(c, c.projects, "POST", "", {
        project_id: projectId, slug, name, description, location, route, geometry,
        source_file_path: sourcePath, source_file_name: file.name || "layout",
      });
      if (!inserted.ok || !inserted.data?.[0]) throw new Error("Could not save project metadata. Run the Create Plots SQL setup.");
      insertedProject = inserted.data[0];
      const plotRows = geometry.P.map(row => ({ project_id: projectId, plot_number: String(row[0]), status: "Available" }));
      const plotInsert = await db(c, c.plots, "POST", "", plotRows);
      if (!plotInsert.ok) {
        await db(c, c.projects, "DELETE", new URLSearchParams({ id: "eq." + insertedProject.id }).toString());
        await removeObject(c, sourcePath);
        throw new Error("Project details saved, but plot inventory could not be initialized. Check the plots table columns.");
      }
      return json({ ok: true, project: insertedProject }, 201);
    } catch (e) {
      if (sourcePath && !insertedProject) await removeObject(c, sourcePath);
      return json({ ok: false, error: e.message || "Could not create project." }, 502);
    }
  }
  if (request.method === "PATCH" && action === "update") {
    let form; try { form = await request.formData(); } catch { return json({ ok: false, error: "Invalid project details." }, 400); }
    const id = String(form.get("id") || ""), name = String(form.get("name") || "").trim(), description = String(form.get("description") || "").trim();
    const location = String(form.get("location") || "").trim(), route = String(form.get("route") || "").trim(), file = form.get("file");
    if (!/^\d+$/.test(id) || !name || name.length > 120 || !/^\/[a-z0-9_-]{2,55}$/.test(route))
      return json({ ok: false, error: "Enter valid project details and route." }, 422);
    const existing = await db(c, c.projects, "GET", new URLSearchParams({ select: "id,slug,source_file_path", id: "eq." + id, limit: "1" }).toString());
    if (!existing.ok || !existing.data?.[0]) return json({ ok: false, error: "Project not found." }, 404);
    const slug = cleanSlug(route.replace(/^\\/+/, "").split("/")[0]);
    if (!slug) return json({ ok: false, error: "Enter a valid project route." }, 422);
    const patch = { name, description, location, route, slug, updated_at: new Date().toISOString() };
    let newPath = null;
    if (file && file.size) {
      if (!validFile(file)) return json({ ok: false, error: "Upload a PDF, PNG, JPG or WEBP file up to 15 MB." }, 422);
      newPath = "projects/" + existing.data[0].slug + "/" + randomUUID() + "-" + String(file.name || "layout").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90);
      try { await upload(c, newPath, file); } catch (e) { return json({ ok: false, error: e.message }, 502); }
      patch.source_file_path = newPath; patch.source_file_name = file.name || "layout";
    }
    const updated = await db(c, c.projects, "PATCH", new URLSearchParams({ id: "eq." + id }).toString(), patch);
    if (!updated.ok || !updated.data?.length) { if (newPath) await removeObject(c, newPath); return json({ ok: false, error: "Could not update project details." }, 502); }
    if (newPath) await removeObject(c, existing.data[0].source_file_path);
    return json({ ok: true, project: updated.data[0] });
  }
  if (request.method === "DELETE" && action === "delete") {
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
    const id = String(body?.id || "");
    if (!/^\d+$/.test(id)) return json({ ok: false, error: "Invalid project." }, 422);
    const found = await db(c, c.projects, "GET", new URLSearchParams({ select: "id,project_id,slug,source_file_path", id: "eq." + id, limit: "1" }).toString());
    const project = found.data?.[0];
    if (!found.ok || !project) return json({ ok: false, error: "Project not found." }, 404);
    const bookingDelete = await db(c, c.bookings, "DELETE", new URLSearchParams({ project_id: "eq." + project.project_id }).toString());
    if (!bookingDelete.ok) return json({ ok: false, error: "Could not remove project bookings. Nothing else was deleted." }, 502);
    const plotDelete = await db(c, c.plots, "DELETE", new URLSearchParams({ project_id: "eq." + project.project_id }).toString());
    if (!plotDelete.ok) return json({ ok: false, error: "Could not remove project plots." }, 502);
    await db(c, c.edits, "DELETE", new URLSearchParams({ project_key: "eq." + project.slug }).toString());
    const removed = await db(c, c.projects, "DELETE", new URLSearchParams({ id: "eq." + id }).toString());
    if (!removed.ok) return json({ ok: false, error: "Could not delete project metadata." }, 502);
    await removeObject(c, project.source_file_path);
    return json({ ok: true });
  }
  return json({ ok: false, error: "Unsupported project action." }, 405);
}
