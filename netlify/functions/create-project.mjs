import { randomUUID, createHmac } from "node:crypto";
import { verifyAdmin } from "../lib/admin-session.mjs";
import { verifyEmployeeToken } from "./employee-auth.mjs";

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
  jobs: process.env.PROJECT_ANALYSIS_JOBS_TABLE || "project_analysis_jobs",
});
const headers = c => ({ apikey: c.key, Authorization: "Bearer " + c.key, Accept: "application/json" });
const schemaReady = c => c.projects === "custom_projects" && c.plots === "plots" &&
  c.bookings === "bookings" && c.edits === "map_edits" &&
  c.bucket === "plot-project-files" && c.jobs === "project_analysis_jobs";
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

async function rpc(c, name, body) {
  try {
    const response = await fetch(c.url + "/rest/v1/rpc/" + encodeURIComponent(name), {
      method: "POST",
      headers: { ...headers(c), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await response.text(); let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    return response.ok ? { ok: true, data } : { ok: false, status: response.status, error: data?.message || data?.details || "Database transaction failed" };
  } catch (e) { return { ok: false, status: 0, error: e?.message || "Network error" }; }
}

const cleanSlug = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 55);
const validFile = file => file && file.size > 0 && file.size <= 4 * 1024 * 1024 &&
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
  if (!path) return true;
  try {
    const response = await fetch(c.url + "/storage/v1/object/" + c.bucket, {
      method: "DELETE", headers: { ...headers(c), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [path] }),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch { return false; }
}
function normalizeGeometry(result) {
  const aspect = Math.max(0.5, Math.min(2.5, Number(result.aspect_ratio) || 1));
  const width = aspect >= 1 ? 2000 : Math.round(2000 * aspect);
  const height = aspect >= 1 ? Math.round(2000 / aspect) : 2000;
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
  const plotLabels = {};
  const P = plots.map((p, index) => {
    const label = String(p.plot_number).trim().slice(0, 20);
    if (!/^[A-Za-z0-9-]+$/.test(label) || ids.has(label)) throw new Error("AI returned duplicate or invalid plot numbers. Please upload a clearer plan.");
    ids.add(label);
    const id = index + 1;
    plotLabels[id] = label;
    const [x,y] = Array.isArray(p.label_position) && p.label_position.length === 2 ? center([p.label_position]) : center(p.polygon);
    return [id, x, y, pointString(p.polygon), Math.max(0, Number(p.area_sqft) || 0), false];
  });
  const paths = values => (values || []).filter(v => Array.isArray(v.polygon) && v.polygon.length >= 3 && v.polygon.length <= 100)
    .map(v => "M" + pointString(v.polygon).replace(/ /g, "L") + "Z");
  return {
    compact: true, canvasWidth: width, canvasHeight: height, plotLabels,
    bounds: { x: 0, y: 0, width, height },
    P, G: { base: paths(result.roads), park: paths(result.parks), misc: [], dash: [], trees: [] },
    LB: [], DM: [], plotAreaLabels: [], roadLabels: [], dimensionLabels: [],
  };
}

function buildPlotRows(geometry) {
  if (!geometry || !Array.isArray(geometry.P) || geometry.P.length < 1 || geometry.P.length > 1000) {
    throw new Error("The extracted layout must contain between 1 and 1000 plots.");
  }
  const seenLabels = new Set(), seenIds = new Set();
  return geometry.P.map(row => {
    const id = Number(row?.[0]);
    if (!Array.isArray(row) || row.length < 4 || !Number.isInteger(id) || id < 1 || id > 10000 ||
        seenIds.has(id) || !Number.isFinite(Number(row[1])) || !Number.isFinite(Number(row[2])) ||
        typeof row[3] !== "string" || row[3].trim().split(/\s+/).length < 3 ||
        !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?(?:\s+-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?){2,}$/.test(row[3].trim())) {
      throw new Error("The extracted plot geometry is invalid. Please analyse the source plan again.");
    }
    const label = String(geometry.plotLabels?.[id] ?? id).trim();
    if (!/^[A-Za-z0-9-]{1,20}$/.test(label) || seenLabels.has(label)) {
      throw new Error("Plot labels must be unique and use letters, numbers or hyphens only.");
    }
    seenIds.add(id); seenLabels.add(label);
    // The inventory table stores the stable geometry ID. plotLabels are display-only.
    return { plot_number: String(id) };
  });
}

async function canManageProjects(request, c) {
  if (process.env.ADMIN_PIN && request.headers.get("x-admin-pin") === process.env.ADMIN_PIN && await verifyAdmin(request)) return true;
  const claims = verifyEmployeeToken(request.headers.get("x-employee-token"), process.env.EMPLOYEE_SESSION_SECRET || "");
  if (!claims || !c.url || !c.key) return false;
  const employee = await db(c, process.env.EMPLOYEES_TABLE || "employees", "GET",
    new URLSearchParams({ select: "id,active", id: "eq." + claims.sub, limit: "1" }).toString());
  return Boolean(employee.ok && employee.data?.[0] && employee.data[0].active !== false);
}
async function analyse(c, file) {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is missing from Netlify Function environment variables.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      plots: { type: "array", items: { type: "object", additionalProperties: false, properties: {
        plot_number: { type: "string" }, area_sqft: { type: "number" },
        confidence: { type: "number" }, label_position: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
        polygon: { type: "array", items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, minItems: 3, maxItems: 40 },
      }, required: ["plot_number","area_sqft","confidence","label_position","polygon"] } },
      roads: { type: "array", items: { type: "object", additionalProperties: false, properties: { polygon: { type: "array", items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, minItems: 3, maxItems: 100 } }, required: ["polygon"] } },
      parks: { type: "array", items: { type: "object", additionalProperties: false, properties: { polygon: { type: "array", items: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, minItems: 3, maxItems: 100 } }, required: ["polygon"] } },
      aspect_ratio: { type: "number" },
      notes: { type: "string" },
    }, required: ["plots","roads","parks","aspect_ratio","notes"],
  };
  const prompt = "You are extracting a plotted land layout drawing for a real-estate map. Return ONLY clearly visible plots. Never invent a plot, number, area, or boundary. Each polygon is the visible plot outline in clockwise order. Use the first PDF page only. Return aspect_ratio as page width divided by page height. Coordinates are normalized independently to that page/canvas: x and y from 0 to 1000. If the plan spans multiple pages, explain that limitation in notes. label_position is the plot-number label center in the same coordinates. Read area_sqft only when legible; otherwise use 0. confidence is 0 to 1. Include road and park outlines only when their boundaries are clearly visible. If a plot boundary or number is ambiguous, omit that plot and explain in notes. Keep the geometry faithful to the source; this is a draft requiring human verification.";
  // Anthropic structured outputs support standard JSON Schema with limited array constraints.
  // Remove unsupported maxItems and minItems values greater than 1 while retaining the data shape.
  const claudeSchema = JSON.parse(JSON.stringify(schema));
  const cleanSchema = node => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(cleanSchema); return; }
    if (typeof node.minItems === "number" && node.minItems > 1) delete node.minItems;
    delete node.maxItems;
    Object.values(node).forEach(cleanSchema);
  };
  cleanSchema(claudeSchema);
  const fileContent = file.type === "application/pdf"
    ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }]
    : [{ type: "image", source: { type: "base64", media_type: file.type, data: base64 } }];
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_PLOT_MODEL || "claude-sonnet-5-5",
      max_tokens: 12000,
      messages: [{ role: "user", content: [...fileContent, { type: "text", text: prompt }] }],
      output_config: { format: { type: "json_schema", schema: claudeSchema } },
    }),
    signal: AbortSignal.timeout(120000),
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[create-project] Claude API error:", response.status, raw?.error?.message || "unknown");
    throw new Error("Claude AI analysis failed. Check Anthropic API billing, model access and uploaded file quality.");
  }
  const output = (raw.content || []).find(item => item.type === "text")?.text;
  if (!output) throw new Error("Claude did not return plot-layout data. Please try another file.");
  let parsed;
  try { parsed = JSON.parse(output); }
  catch { throw new Error("Claude returned invalid layout data. Please retry."); }
  return { geometry: normalizeGeometry(parsed), notes: parsed.notes || "", plots: parsed.plots || [] };
}

export default async function handler(request) {
  const c = cfg();
  if (!c.url || !c.key) return json({ ok: false, error: "Supabase is not configured." }, 500);
  if (!(await canManageProjects(request, c))) return json({ ok: false, error: "Sign in with an authorized Admin or Employee account to manage projects." }, 401);
  if (!schemaReady(c)) return json({ ok: false, error: "The atomic Create Plots SQL setup requires the default tables custom_projects, plots, bookings, map_edits, project_analysis_jobs and bucket plot-project-files. Remove custom table/bucket overrides or adapt the SQL functions before using this feature." }, 500);
  const action = new URL(request.url).searchParams.get("action") || "";
  if (request.method === "GET" && action === "analysis-status") {
    const jobId = String(new URL(request.url).searchParams.get("job_id") || "");
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ ok: false, error: "Invalid analysis job." }, 422);
    const found = await db(c, c.jobs, "GET", new URLSearchParams({
      select: "status,result,error,updated_at", job_id: "eq." + jobId, limit: "1",
    }).toString());
    if (!found.ok) return json({ ok: false, error: "Could not check AI analysis status." }, 502);
    const job = found.data?.[0];
    if (!job) return json({ ok: false, error: "Analysis job not found." }, 404);
    if (job.status === "processing" && Date.now() - new Date(job.updated_at).getTime() > 14 * 60 * 1000) {
      return json({ ok: true, status: "failed", error: "AI analysis exceeded the processing limit. Please upload the plan and try again." });
    }
    return json({ ok: true, status: job.status, result: job.result || null, error: job.error || "" });
  }
  if (request.method === "POST" && action === "analyze") {
    let form; try { form = await request.formData(); } catch { return json({ ok: false, error: "Upload a PDF or image file." }, 400); }
    const file = form.get("file");
    if (!validFile(file)) return json({ ok: false, error: "Upload a PDF, PNG, JPG or WEBP file up to 4 MB." }, 422);
    const jobId = randomUUID();
    const sourcePath = "analysis/" + jobId + "/" + String(file.name || "layout").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90);
    const payload = { job_id: jobId, source_file_path: sourcePath, file_name: file.name || "layout", file_type: file.type };
    try {
      await upload(c, sourcePath, file);
      const queued = await db(c, c.jobs, "POST", "", {
        job_id: jobId, source_file_path: sourcePath, file_name: payload.file_name,
        file_type: payload.file_type, status: "pending", updated_at: new Date().toISOString(),
      });
      if (!queued.ok) throw new Error("Could not queue the AI analysis job. Run the Create Plots SQL setup.");
      const signature = createHmac("sha256", c.key).update(JSON.stringify(payload)).digest("hex");
      const backgroundUrl = new URL("/.netlify/functions/analyze-project-background", request.url);
      const started = await fetch(backgroundUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, signature }), signal: AbortSignal.timeout(12000),
      });
      if (!started.ok) {
        await db(c, c.jobs, "PATCH", new URLSearchParams({ job_id: "eq." + jobId }).toString(), {
          status: "failed", error: "Netlify Background Functions could not start this analysis.", updated_at: new Date().toISOString(),
        });
        await removeObject(c, sourcePath);
        return json({ ok: false, error: "Could not start AI analysis. Check that Netlify Background Functions are enabled for this site." }, 502);
      }
      return json({ ok: true, job_id: jobId, status: "pending" }, 202);
    } catch (e) {
      await db(c, c.jobs, "PATCH", new URLSearchParams({ job_id: "eq." + jobId }).toString(), {
        status: "failed", error: e.message || "Could not start AI analysis.", updated_at: new Date().toISOString(),
      });
      await removeObject(c, sourcePath);
      return json({ ok: false, error: e.message || "Could not start AI analysis." }, 502);
    }
  }
  if (request.method === "POST" && action === "create") {
    let form; try { form = await request.formData(); } catch { return json({ ok: false, error: "Invalid project data." }, 400); }
    const name = String(form.get("name") || "").trim(), description = String(form.get("description") || "").trim(), location = String(form.get("location") || "").trim();
    const route = String(form.get("route") || "").trim(), slug = cleanSlug(route.replace(/^\/+/, "").split("/")[0]);
    let geometry; try { geometry = JSON.parse(String(form.get("geometry") || "{}")); } catch { geometry = null; }
    if (!name || name.length > 120 || !route || !/^\/[a-z0-9_-]{2,55}$/.test(route) || !slug ||
        ["velavan_nagar","saraswathi_garden","shanmuga_avenue","meenakshi_garden_phase1","meenakshi_garden_phase2","dashboard","bookings","plot_lists","create_plots","users","layout_landing"].includes(slug)) {
      return json({ ok: false, error: "Enter a project name and a valid, unused route such as /new_project." }, 422);
    }
    let plotRows;
    try { plotRows = buildPlotRows(geometry); }
    catch (e) { return json({ ok: false, error: e.message }, 422); }
    const exists = await db(c, c.projects, "GET", new URLSearchParams({ select: "id", or: "(slug.eq." + slug + ",route.eq." + route + ")", limit: "1" }).toString());
    if (!exists.ok) return json({ ok: false, error: "Could not check existing project routes. Run the Create Plots SQL setup." }, 502);
    if (exists.data?.length) return json({ ok: false, error: "That project route already exists. Choose another route." }, 409);
    geometry.key = "custom_project_" + randomUUID().replace(/-/g, "");
    const file = form.get("file");
    if (!validFile(file)) return json({ ok: false, error: "Please upload a PDF, PNG, JPG or WEBP file up to 4 MB." }, 422);
    const sourcePath = "projects/" + slug + "/" + randomUUID() + "-" + String(file.name || "layout").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90);
    try {
      await upload(c, sourcePath, file);
      const created = await rpc(c, "create_custom_project", {
        p_slug: slug, p_name: name, p_description: description, p_location: location,
        p_route: route, p_geometry: geometry, p_source_file_path: sourcePath,
        p_source_file_name: file.name || "layout", p_plot_rows: plotRows,
      });
      if (!created.ok) {
        const cleaned = await removeObject(c, sourcePath);
        if (!cleaned) console.error("[create-project] Uploaded file cleanup failed after create rollback:", sourcePath);
        const duplicate = created.status === 409 || /duplicate|unique/i.test(created.error || "");
        return json({ ok: false, error: duplicate ? "That project route or project ID is already in use. Refresh and try again." : "Could not create the project safely. No project or plot records were committed. " + (created.error || "") }, duplicate ? 409 : 502);
      }
      return json({ ok: true, project: created.data?.project || created.data, project_id: created.data?.project_id }, 201);
    } catch (e) {
      const cleaned = await removeObject(c, sourcePath);
      if (!cleaned) console.error("[create-project] Uploaded file cleanup failed:", sourcePath);
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
    const slug = cleanSlug(route.replace(/^\/+/, "").split("/")[0]);
    if (!slug || ['velavan_nagar','saraswathi_garden','shanmuga_avenue','meenakshi_garden_phase1','meenakshi_garden_phase2','dashboard','bookings','plot_lists','create_plots','users','layout_landing'].includes(slug))
      return json({ ok: false, error: "That route is reserved. Choose a different project route." }, 422);
    const duplicate = await db(c, c.projects, "GET", new URLSearchParams({ select: "id", or: "(slug.eq." + slug + ",route.eq." + route + ")", id: "neq." + id, limit: "1" }).toString());
    if (!duplicate.ok) return json({ ok: false, error: "Could not validate the project route." }, 502);
    if (duplicate.data?.length) return json({ ok: false, error: "That project route is already in use." }, 409);
    const patch = { name, description, location, route, slug, updated_at: new Date().toISOString() };
    let newPath = null;
    if (file && file.size) {
      if (!validFile(file)) return json({ ok: false, error: "Upload a PDF, PNG, JPG or WEBP file up to 4 MB." }, 422);
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
    const removed = await rpc(c, "delete_custom_project", { p_custom_project_id: Number(id) });
    if (!removed.ok) {
      const notFound = removed.status === 404 || /not found/i.test(removed.error || "");
      return json({ ok: false, error: notFound ? "Project not found." : "Project deletion was cancelled. Its bookings, plots and project details were left unchanged. " + (removed.error || "") }, notFound ? 404 : 502);
    }
    const sourcePath = removed.data?.source_file_path || "";
    const storageCleanupPending = sourcePath ? !(await removeObject(c, sourcePath)) : false;
    if (storageCleanupPending) console.error("[create-project] Project deleted but source file cleanup failed:", sourcePath);
    return json({ ok: true, storage_cleanup_pending: storageCleanupPending });
  }
  return json({ ok: false, error: "Unsupported project action." }, 405);
}

export { analyse, normalizeGeometry };
