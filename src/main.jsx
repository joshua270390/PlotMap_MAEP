import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import './style.css';

const dashboardPaths = ['/dashboard', '/bookings', '/plot_lists'];
const mapRoutes = new Set(['velavan_nagar', 'saraswathi_garden']);
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isDashboard = dashboardPaths.includes(currentPath);
const routeId = currentPath.slice(1);
const isMapRoute = currentPath === '/' || mapRoutes.has(routeId);

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
