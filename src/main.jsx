import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import './style.css';

const dashboardPaths = ['/', '/dashboard', '/bookings', '/plot_lists', '/users'];
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const isDashboard = dashboardPaths.includes(currentPath);
createRoot(document.getElementById('root')).render(
  <StrictMode>{isDashboard ? <Dashboard /> : <App />}</StrictMode>
);
