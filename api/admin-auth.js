// Server-side Admin PIN validation. The PIN is never shipped in the frontend bundle.
const out = (res, code, body) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(body);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return out(res, 405, { ok: false, error: 'Method not allowed' });
  }
  const expected = process.env.ADMIN_PIN || '';
  if (!expected) {
    console.error('[admin-auth] ADMIN_PIN is not configured.');
    return out(res, 500, { ok: false, error: 'Admin login is not configured on the server.' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = null; } }
  const pin = String(body?.pin ?? '');
  if (!pin || pin !== expected) return out(res, 401, { ok: false, error: 'Incorrect Admin PIN.' });
  return out(res, 200, { ok: true });
}
