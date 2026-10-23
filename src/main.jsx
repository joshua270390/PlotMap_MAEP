import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import ShanmugaAvenuePlotMap from '../ShanmugaAvenuePlotMap.jsx';
import './style.css';

const dashboardPaths = ['/dashboard', '/bookings', '/plot_lists'];
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isDashboard = dashboardPaths.includes(currentPath);
const isShanmugaAvenue = currentPath === '/shanmuga_avenue';
createRoot(document.getElementById('root')).render(
  <StrictMode>{isDashboard ? <Dashboard /> : isShanmugaAvenue ? <ShanmugaAvenuePlotMap /> : <App />}</StrictMode>
);
