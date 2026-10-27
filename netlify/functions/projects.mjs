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
];

export default async function handler(request) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", Allow: "GET" },
    });
  }
  return new Response(JSON.stringify({ ok: true, projects: PROJECTS }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
