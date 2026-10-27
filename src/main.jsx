import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import './style.css';

const dashboardPaths = ['/dashboard', '/bookings', '/plot_lists'];
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isDashboard = dashboardPaths.includes(currentPath);
function ProjectSetupNotice() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f5f6f8', color: '#172033', fontFamily: 'Inter, Arial, sans-serif' }}>
      <section style={{ width: 'min(100%, 520px)', padding: '32px', borderRadius: '18px', background: '#fff', boxShadow: '0 12px 40px rgba(20, 32, 55, .08)', textAlign: 'center' }}>
        <img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties" style={{ width: 'min(100%, 220px)', height: 'auto', marginBottom: '20px' }} />
        <h1 style={{ margin: '0 0 10px', fontSize: '24px' }}>Saraswathi Garden</h1>
        <p style={{ margin: '0 0 24px', color: '#667085', lineHeight: 1.6 }}>This project’s plot layout is being prepared. Please open it again once the map is ready.</p>
        <a href="/plot_lists" style={{ display: 'inline-block', padding: '11px 18px', borderRadius: '10px', background: '#173d2b', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Back to Plot Lists</a>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>{isDashboard ? <Dashboard /> : currentPath === '/saraswathi_garden' ? <ProjectSetupNotice /> : <App />}</StrictMode>
);
