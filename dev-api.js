// Dev only: serves /api/*.js under `npm run dev`, so the form works without `vercel dev`.
// Reads SUPABASE_URL / SUPABASE_KEY / PROJECT_ID from .env.local. Not used in the Vercel build.
export default function devApi(env) {
  return {
    name: 'local-api',
    configureServer(server) {
      Object.assign(process.env, env);
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/([\w-]+)(\?.*)?$/.exec(req.url || '');
        if (!m || m[1].startsWith('_')) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
          let raw = ''; for await (const c of req) raw += c;
          try { req.body = raw ? JSON.parse(raw) : undefined; } catch (_) { req.body = raw; }
          res.status = c => { res.statusCode = c; return res; };
          res.json = d => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(d)); };
          await mod.default(req, res);
        } catch (e) {
          console.error('[local-api]', e);
          res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
        }
      });
    },
  };
}
