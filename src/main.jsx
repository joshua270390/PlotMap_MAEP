import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import './style.css';
import { reclaimAdmin } from './adminData.js';

// ---- Admin session (only one Admin signed in at a time) ----
// Every /api call carries this tab's admin session id. The login reply hands
// out the id; a heartbeat keeps it alive while the tab is open.
const SKEY = 'maep_admin_session';
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (!url.startsWith('/api/')) return nativeFetch(input, init);
  const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
  const sid = window.sessionStorage.getItem(SKEY);
  if (sid && !headers.has('x-admin-session')) headers.set('x-admin-session', sid);
  const response = await nativeFetch(input, { ...init, headers });
  if (url.startsWith('/api/admin-auth') && !url.includes('action=') && response.ok) {
    response.clone().json().then(d => { if (d?.session) window.sessionStorage.setItem(SKEY, d.session); }).catch(() => {});
  }
  return response;
};
let ended = false;
const endAdminSession = () => {
  if (ended) return; ended = true;
  window.sessionStorage.removeItem('maep_admin_pin'); window.sessionStorage.removeItem(SKEY);
  window.alert('Your Admin session has ended (signed out or signed in elsewhere). Please sign in again.');
  window.location.assign('/dashboard');
};
window.setInterval(async () => {
  if (!window.sessionStorage.getItem('maep_admin_pin') || !window.sessionStorage.getItem(SKEY)) return;
  try {
    const r = await window.fetch('/api/admin-auth?action=ping', { method: 'POST', headers: { 'x-admin-pin': window.sessionStorage.getItem('maep_admin_pin') }, cache: 'no-store' });
    if (r.status === 401) {
      // Session lapsed (laptop sleep, slow network): take it back if no other device is the Admin now.
      const re = await reclaimAdmin(window.sessionStorage.getItem('maep_admin_pin'));
      if (!re.ok && re.status !== 0) endAdminSession();
    }
  } catch { /* offline: try again next beat */ }
}, 30000);

const dashboardPaths = ['/', '/dashboard', '/bookings', '/plot_lists'];
const mapRoutes = new Set(['velavan_nagar', 'saraswathi_garden', 'shanmuga_avenue']);
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isDashboard = dashboardPaths.includes(currentPath);
const routeId = currentPath.slice(1);
const isMapRoute = mapRoutes.has(routeId);

// Keep dashboard routes separate; project slugs use the shared PlotMap page.
// Unknown one-segment paths return to Plot Lists instead of silently showing
// the Velavan Nagar map for an invalid project ID.
if (!isDashboard && currentPath !== '/' && !isMapRoute) {
  window.location.replace('/plot_lists');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDashboard ? <Dashboard /> : isMapRoute ? <App projectSlug={routeId || 'velavan_nagar'} /> : <Dashboard />}
  </StrictMode>
);
