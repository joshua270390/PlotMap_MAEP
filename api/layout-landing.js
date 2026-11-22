// Independent project landing-page content. Public reads are slug-scoped; writes require Admin PIN.
const out = (res, code, body) => { res.setHeader('Cache-Control', 'no-store'); return res.status(code).json(body); };
const parseBody = req => { if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } } return req.body && typeof req.body === 'object' ? req.body : null; };
const slugPattern = /^[a-z0-9_]{2,80}$/;
function getConfig() { return { pin: process.env.ADMIN_PIN || '', url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim(), table: process.env.LAYOUT_LANDING_TABLE || 'layout_landing_pages' }; }
async function db(cfg, method, query, body) {
  const headers = { apikey: cfg.key, Accept: 'application/json' };
  if (cfg.key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + cfg.key;
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers.Prefer = method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation'; }
  try {
    const response = await fetch(cfg.url + '/rest/v1/' + encodeURIComponent(cfg.table) + (query ? '?' + query : ''), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const raw = await response.text(); let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
    return response.ok ? { ok: true, status: response.status, data } : { ok: false, status: response.status, error: data?.message || data?.details || 'Database request failed' };
  } catch (error) { return { ok: false, status: 0, error: error.message || 'Network error' }; }
}
const isAdmin = (req, cfg) => !!cfg.pin && String(req.headers['x-admin-pin'] || '') === cfg.pin;
export default async function handler(req, res) {
  const cfg = getConfig();
  if (!['GET','POST','PATCH','DELETE'].includes(req.method)) { res.setHeader('Allow','GET, POST, PATCH, DELETE'); return out(res,405,{ok:false,error:'Method not allowed'}); }
  if (!cfg.url || !cfg.key) return out(res,500,{ok:false,error:'Landing page database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'});
  const slug = String(req.query?.slug || '').trim();
  if (req.method === 'GET') {
    const adminList = req.query?.all === '1';
    if (adminList && !isAdmin(req,cfg)) return out(res,401,{ok:false,error:'Admin authentication failed.'});
    if (!adminList && !slugPattern.test(slug)) return out(res,400,{ok:false,error:'A valid project slug is required.'});
    const query = new URLSearchParams({ select: 'slug,content,updated_at', order: 'slug.asc' });
    if (!adminList) { query.set('slug','eq.' + slug); query.set('limit','1'); }
    const result = await db(cfg,'GET',query.toString());
    if (!result.ok) return out(res,502,{ok:false,error:'Could not load landing page content. Check that the layout_landing_pages table exists.'});
    return out(res,200,adminList ? {ok:true,pages:result.data || []} : {ok:true,page:(result.data || [])[0] || null});
  }
  if (!isAdmin(req,cfg)) return out(res,401,{ok:false,error:'Admin authentication failed. Please sign in again.'});
  const body = parseBody(req);
  if (!body) return out(res,400,{ok:false,error:'Invalid request body.'});
  const targetSlug = String(body.slug || slug || '').trim();
  if (!slugPattern.test(targetSlug)) return out(res,422,{ok:false,error:'Select a valid project.'});
  if (req.method === 'DELETE') {
    const removed = await db(cfg,'DELETE',new URLSearchParams({slug:'eq.' + targetSlug}).toString());
    if (!removed.ok) return out(res,502,{ok:false,error:'Could not delete landing page content.'});
    return out(res,200,{ok:true,slug:targetSlug});
  }
  if (!body.content || typeof body.content !== 'object' || Array.isArray(body.content)) return out(res,422,{ok:false,error:'Landing page content is required.'});
  const saved = await db(cfg,'POST','on_conflict=slug',{slug:targetSlug,content:body.content,updated_at:new Date().toISOString()});
  if (!saved.ok) return out(res,502,{ok:false,error:'Could not save landing page content. Check the landing page table and permissions.'});
  return out(res,200,{ok:true,page:Array.isArray(saved.data) ? saved.data[0] : saved.data});
}
export const config = { maxDuration: 15 };
