const PROJECTS = [
  {
    id: "velavan-nagar",
    slug: "velavan_nagar",
    name: "Velavan Nagar",
    layout: "Kurayur layout",
    location: "Madurai, Tamil Nadu",
    description: "Open the Velavan Nagar interactive plot layout and view plot details.",
    mapKey: "velavan_nagar",
    mapReady: true,
  },
  {
    id: "saraswathi-garden",
    slug: "saraswathi_garden",
    name: "Saraswathi Garden",
    layout: "Saraswathi Garden layout",
    location: "Madurai, Tamil Nadu",
    description: "Open the Saraswathi Garden interactive plot layout and view plot details.",
    mapKey: "saraswathi_garden",
    mapReady: true,
  },
  {
    id: "shanmuga-avenue",
    slug: "shanmuga_avenue",
    name: "Shanmuga Avenue",
    layout: "Arasanur layout",
    location: "Sivagangai, Tamil Nadu",
    description: "Open the Shanmuga Avenue interactive plot layout and view plot details.",
    mapKey: "shanmuga_avenue",
    mapReady: true,
  },
  {
    id: "meenakshi-garden-phase1",
    slug: "meenakshi_garden_phase1",
    name: "Sri Meenakshi Garden - Phase 1",
    layout: "Poonchuthi layout",
    location: "Poonchuthi, Melur, Madurai",
    description: "Open the Sri Meenakshi Garden Phase 1 interactive plot layout and view plot details.",
    mapKey: "meenakshi_garden_phase1",
    mapReady: true,
  },
  {
    id: "meenakshi-garden-phase2",
    slug: "meenakshi_garden_phase2",
    name: "Sri Meenakshi Garden - Phase 2",
    layout: "Poonchuthi layout",
    location: "Poonchuthi, Melur, Madurai",
    description: "Open the Sri Meenakshi Garden Phase 2 interactive plot layout and view plot details.",
    mapKey: "meenakshi_garden_phase2",
    mapReady: true,
  },
];

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const config = () => ({
  url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
  table: process.env.CUSTOM_PROJECTS_TABLE || "custom_projects",
});
export default async function handler(request) {
  if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  const c = config();
  if (!c.url || !c.key) return json({ ok: true, projects: PROJECTS });
  try {
    const query = new URLSearchParams({ select: "id,project_id,slug,name,description,location,route,source_file_name,geometry,created_at,updated_at", order: "created_at.desc" });
    const response = await fetch(c.url + "/rest/v1/" + encodeURIComponent(c.table) + "?" + query, {
      headers: { apikey: c.key, Authorization: "Bearer " + c.key, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) {
      console.error("[projects] Custom project lookup failed:", response.status);
      return json({ ok: false, error: "Could not load custom projects. Run the Create Plots SQL setup." }, 502);
    }
    const custom = (Array.isArray(rows) ? rows : []).map(row => ({
      ...row, id: "custom-" + row.id, customProjectId: row.id,
      slug: row.slug, mapKey: row.geometry?.key || row.slug, mapReady: true,
      layout: row.name + " layout", geometry: row.geometry, route: row.route,
    }));
    return json({ ok: true, projects: [...custom, ...PROJECTS] });
  } catch (error) {
    console.error("[projects] Lookup failed:", error?.message || error);
    return json({ ok: false, error: "Could not load projects." }, 502);
  }
}
