import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import './style.css';

const isDashboard = window.location.pathname.replace(/\/+$/, '') === '/dashboard';
createRoot(document.getElementById('root')).render(
  <StrictMode>{isDashboard ? <Dashboard /> : <App />}</StrictMode>
);
