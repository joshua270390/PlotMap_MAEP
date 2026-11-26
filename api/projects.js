// Public project catalogue for the Plot Lists page.
// Keep project slugs stable: they are also the public map routes.
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
    mapReady: false,
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

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, projects: PROJECTS });
}
