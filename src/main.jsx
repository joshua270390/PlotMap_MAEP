import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import LandingPage from './LandingPage.jsx';
import ProjectLandingPage from './ProjectLandingPage.jsx';
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

const dashboardPaths = ['/dashboard', '/bookings', '/plot_lists', '/users', '/layout_landing', '/create_plots'];
const mapRoutes = new Set(['velavan_nagar', 'saraswathi_garden', 'shanmuga_avenue', 'meenakshi_garden_phase1', 'meenakshi_garden_phase2']);
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isDashboard = dashboardPaths.includes(currentPath);
const routeParts = currentPath.split('/').filter(Boolean);
const routeId = routeParts[0] || '';
const isProjectRoute = routeParts.length === 1 && mapRoutes.has(routeId);
const isMapRoute = routeParts.length === 2 && mapRoutes.has(routeId) && routeParts[1] === 'layout';
const isCustomProjectMapRoute = routeParts.length === 2 && !mapRoutes.has(routeId) && routeParts[1] === 'layout';
const isCustomProjectRoute = routeParts.length === 1 && !isDashboard && !isProjectRoute && currentPath !== '/';
const root = createRoot(document.getElementById('root'));

if (currentPath === '/') {
  root.render(<StrictMode><LandingPage /></StrictMode>);
} else if (isDashboard) {
  root.render(<StrictMode><Dashboard /></StrictMode>);
} else if (isProjectRoute) {
  root.render(<StrictMode><ProjectLandingPage projectSlug={routeId} /></StrictMode>);
} else if (isMapRoute || isCustomProjectMapRoute) {
  root.render(<StrictMode><App projectSlug={routeId} /></StrictMode>);
} else if (isCustomProjectRoute) {
  root.render(<StrictMode><main className="project-load-state"><div>Loading project…</div></main></StrictMode>);
  fetch('/api/projects', { cache: 'no-store' })
    .then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error('Project registry unavailable');
      const project = (data.projects || []).find(item => item.customProjectId != null &&
        (item.slug === routeId || item.route === currentPath));
      if (!project?.geometry?.P?.length) throw new Error('Project not found');
      root.render(<StrictMode><App projectSlug={project.slug} /></StrictMode>);
    })
    .catch(() => window.location.replace('/plot_lists'));
} else {
  window.location.replace('/plot_lists');
}
