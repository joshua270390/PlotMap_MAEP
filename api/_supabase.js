// Shared Supabase REST helper (underscore prefix = not a public route on Vercel).
export const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_KEY = (process.env.SUPABASE_KEY || '').trim();
export const PROJECT_ID   = parseInt(process.env.PROJECT_ID || '1', 10);
export const BOOKINGS     = process.env.BOOKINGS_TABLE || 'bookings';
export const PLOTS        = process.env.PLOTS_TABLE || 'plots';
export const DEBUG        = process.env.DEBUG === 'true';

export async function supabase(method, path, body) {
  const headers = { apikey: SUPABASE_KEY, Accept: 'application/json' };
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + SUPABASE_KEY; // classic JWT keys
  if (body) { headers['Content-Type'] = 'application/json'; headers.Prefer = 'return=minimal'; }
  let res;
  try {
    res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    return { ok: false, status: 0, error: 'Network: ' + (e.message || e) };
  }
  const text = await res.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch (_) {}
  if (res.ok) return { ok: true, status: res.status, data: j };
  const msg = j && typeof j === 'object'
    ? [j.code, j.message, j.details, j.hint].filter(Boolean).join(' | ') : '';
  return { ok: false, status: res.status, error: msg || 'HTTP ' + res.status };
}

