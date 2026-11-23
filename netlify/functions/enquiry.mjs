// Landing page enquiries are intentionally not persisted.
// The public form now prepares the enquiry in WhatsApp on the client.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
export default async function handler(request) {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  return json({
    ok: false,
    error: "Landing page enquiries are not stored. Please submit your enquiry through WhatsApp.",
  }, 410);
}
