import { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';
import { P, G } from './data.js';
import { P as SARASWATHI_P } from './saraswathiGeometry.js';
import { P as SHANMUGA_P } from './shanmugaGeometry.js';
import { P as MEENAKSHI_PHASE1_P } from './meenakshiPhase1Geometry.js';
import { P as MEENAKSHI_PHASE2_P } from './meenakshiPhase2Geometry.js';
import ProjectMapThumbnail from './ProjectMapThumbnail.jsx';
import LayoutLandingEditor from './LayoutLandingEditor.jsx';
import CreatePlotsPage from './CreatePlotsPage.jsx';
import { normalizeIndianMobile, INDIAN_MOBILE_ERROR } from './validation.js';

const PROJECT_IDS = { velavan_nagar: 1, saraswathi_garden: 3, shanmuga_avenue: 2, meenakshi_garden_phase1: 4, meenakshi_garden_phase2: 5 };
const PROJECT_NAMES = { 1: 'Velavan Nagar', 3: 'Saraswathi Garden', 2: 'Shanmuga Avenue', 4: 'Meenakshi Garden Phase 1', 5: 'Meenakshi Garden Phase 2' };
const DASHBOARD_GEOMETRY_PLOTS = {
  velavan_nagar: P,
  saraswathi_garden: SARASWATHI_P,
  shanmuga_avenue: SHANMUGA_P,
  meenakshi_garden_phase1: MEENAKSHI_PHASE1_P,
  meenakshi_garden_phase2: MEENAKSHI_PHASE2_P,
};
const STATUSES = [
  { value: 'Available', label: 'Availability' },
  { value: 'Reserved', label: 'Reserved' },
  { value: 'Booked', label: 'Booked' },
  { value: 'Sold', label: 'Sold' },
];
const normalizedStatus = value => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return STATUSES.find(item => item.value.toLowerCase() === normalized)?.value || 'Available';
};
const statusLabel = value => STATUSES.find(item => item.value === normalizedStatus(value))?.label || 'Availability';
const field = (row, ...keys) => {
  for (const key of keys) if (row?.[key] != null) return String(row[key]);
  return '';
};


function EmployeeUsersPage({ pin, employees, setEmployees, employeeForm, setEmployeeForm, employeeDelete, setEmployeeDelete, setError, setNotice }) {
  const [busy, setBusy] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const load = async () => {
    const response = await fetch('/api/employee-auth?action=list', { headers: { 'x-admin-pin': pin }, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load employees.');
    setEmployees(data.employees || []);
  };
  useEffect(() => { load().catch(error => setError(error.message)); }, [pin]);
  const save = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const editing = employeeForm.id != null;
      const response = await fetch('/api/employee-auth?action=' + (editing ? 'update' : 'create'), {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify(employeeForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save employee.');
      setEmployeeForm(null); setNotice(editing ? 'Employee updated.' : 'Employee created.'); await load();
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!employeeDelete || busy) return; setBusy(true); setError('');
    try {
      const response = await fetch('/api/employee-auth?action=delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify({ id: employeeDelete.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete employee.');
      setEmployeeDelete(null); setNotice('Employee deleted.'); await load();
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  return <>
    <div className="page-intro"><div><h2>Employee accounts</h2><p>Create and manage employee access to plot map editing.</p></div><button type="button" className="add-customer-btn" onClick={() => setEmployeeForm({ username: '', email: '', password: '' })}>Add Employee +</button></div>
    <section className="table-card"><div className="table-scroll"><table className="data-table">
      <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Action</th></tr></thead>
      <tbody>{employees.map(row => <tr key={row.id}><td><strong>{row.username}</strong></td><td>{row.username}</td><td>{row.email}</td><td><div className="row-actions"><button className="edit-btn" type="button" onClick={() => setEmployeeForm({ id: row.id, username: row.username, email: row.email, password: '' })}>Edit</button><button className="delete-btn" type="button" onClick={() => setEmployeeDelete(row)}>Delete</button></div></td></tr>)}
      {!employees.length && <tr><td colSpan="4" className="empty-cell">No employee accounts created yet.</td></tr>}</tbody>
    </table></div><div className="table-footer">Total employees: {employees.length}</div></section>
    {employeeForm && <div className="edit-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setEmployeeForm(null); }}><form className="edit-modal" onSubmit={save}>
      <button type="button" className="modal-close" onClick={() => setEmployeeForm(null)}>×</button><p className="eyebrow">EMPLOYEE ACCOUNT</p><h2>{employeeForm.id ? 'Edit employee' : 'Create employee'}</h2>
      <label>Username<input value={employeeForm.username} onChange={e => setEmployeeForm(s => ({ ...s, username: e.target.value }))} required minLength="3" maxLength="40" /></label>
      <label>Email<input type="email" value={employeeForm.email} onChange={e => setEmployeeForm(s => ({ ...s, email: e.target.value }))} required /></label>
      <label>Password<div className="password-field"><input type={showFormPassword ? 'text' : 'password'} value={employeeForm.password} onChange={e => setEmployeeForm(s => ({ ...s, password: e.target.value }))} required={!employeeForm.id} minLength="8" placeholder={employeeForm.id ? 'Leave blank to keep current password' : 'At least 8 characters'} /><button type="button" className="password-toggle" aria-label={showFormPassword ? 'Hide password' : 'Show password'} aria-pressed={showFormPassword} onClick={() => setShowFormPassword(value => !value)}>{showFormPassword ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 9 4.6 10 7-.4 1-1.4 2.4-3 3.7M6.2 6.2C3.9 7.6 2.5 9.6 2 12c1 2.4 4.8 7 10 7 1 0 2-.2 2.9-.5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></label>
      <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setEmployeeForm(null)}>Cancel</button><button className="primary-btn" disabled={busy}>{busy ? 'Saving…' : 'Save employee'}</button></div>
    </form></div>}
    {employeeDelete && <div className="edit-overlay confirm-overlay" role="presentation"><section className="confirm-modal" role="alertdialog" aria-modal="true"><div className="confirm-icon">!</div><p className="eyebrow">CONFIRM ACTION</p><h2>Delete employee?</h2><p>Are you sure you want to delete <strong>{employeeDelete.username}</strong>? This action cannot be undone.</p><div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setEmployeeDelete(null)} disabled={busy}>Cancel</button><button type="button" className="confirm-delete-btn" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Yes, delete'}</button></div></section></div>}
  </>;
}

export default function Dashboard() {
  useEffect(() => {
    document.body.classList.add('dashboard-mode');
    return () => document.body.classList.remove('dashboard-mode');
  }, []);
  const [pin, setPin] = useState('');
  const [employeeUsername, setEmployeeUsername] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [employeeToken, setEmployeeToken] = useState(() => window.sessionStorage.getItem('maep_employee_token') || '');
  const [employees, setEmployees] = useState([]);
  const [employeeForm, setEmployeeForm] = useState(null);
  const [employeeDelete, setEmployeeDelete] = useState(null);
  const [role, setRole] = useState('admin');
  const [userName, setUserName] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(() => Boolean(window.sessionStorage.getItem('maep_user_mode') || window.sessionStorage.getItem('maep_admin_pin') || window.sessionStorage.getItem('maep_employee_token')));
  const [page, setPage] = useState(() => { const path = window.location.pathname.replace(/\/+$/, ''); return path === '/plot_lists' || path === '/create_plots' ? 'plots' : path === '/bookings' ? 'bookings' : path === '/users' ? 'users' : path === '/layout_landing' ? 'layout-landing' : 'dashboard'; });
  const [showCreatePage, setShowCreatePage] = useState(() => window.location.pathname.replace(/\/+$/, '') === '/create_plots');
  const [editingProject, setEditingProject] = useState(null);
  const [projectDelete, setProjectDelete] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedBookingKeys, setSelectedBookingKeys] = useState([]);
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingPageSize, setBookingPageSize] = useState(10);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [plotSearch, setPlotSearch] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectTab, setProjectTab] = useState('all');
  const [dashboardProjectFilter, setDashboardProjectFilter] = useState('all');
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nativeApp] = useState(() => /MAEPApp/i.test(navigator.userAgent) || window.Capacitor?.isNativePlatform?.() === true);

  useEffect(() => {
    const title = showCreatePage ? (editingProject ? 'Edit project' : 'Create Plots') : page === 'dashboard' ? 'Dashboard' : page === 'bookings' ? 'Bookings' : page === 'users' ? 'Users' : page === 'layout-landing' ? 'Layout Landing' : 'Plot lists';
    document.title = (loggedIn ? title : 'Sign in') + ' | Mary Ann Elite Properties';
  }, [page, loggedIn, showCreatePage, editingProject]);

  // Keep the rendered dashboard page aligned with browser Back/Forward navigation.
  // Returning from a dashboard route to '/' must remount the PlotMap app, not leave stale dashboard UI.
  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (role === 'user') {
        if (path !== '/') window.location.replace('/');
        return;
      }
      if (role === 'employee' && !['/bookings', '/plot_lists', '/layout_landing', '/create_plots'].includes(path)) {
        window.history.replaceState({}, '', '/plot_lists'); setShowCreatePage(false); setEditingProject(null); setPage('plots'); return;
      }
      const routes = role === 'employee' ? ['/bookings', '/plot_lists', '/layout_landing', '/create_plots'] : ['/', '/dashboard', '/bookings', '/plot_lists', '/users', '/layout_landing', '/create_plots'];
      if (!routes.includes(path)) {
        window.location.reload();
        return;
      }
      setShowCreatePage(path === '/create_plots');
      setPage(path === '/plot_lists' || path === '/create_plots' ? 'plots' : path === '/bookings' ? 'bookings' : path === '/users' ? 'users' : path === '/layout_landing' ? 'layout-landing' : 'dashboard');
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [role]);

  // Restore and verify saved Admin or approved User sessions after a refresh.
  useEffect(() => {
    const savedUserMode = window.sessionStorage.getItem('maep_user_mode');
    if (savedUserMode === 'true') {
      window.location.replace('/');
      return;
    }
    const savedEmployeeToken = window.sessionStorage.getItem('maep_employee_token');
    if (savedEmployeeToken) { const savedPath = window.location.pathname; const employeePage = savedPath === '/bookings' ? 'bookings' : 'plots'; setRole('employee'); setEmployeeToken(savedEmployeeToken); setUserName(window.sessionStorage.getItem('maep_employee_username') || 'Employee'); setLoggedIn(true); setPage(employeePage); setShowCreatePage(savedPath === '/create_plots'); if (!['/bookings', '/plot_lists', '/layout_landing', '/create_plots'].includes(savedPath)) window.history.replaceState({}, '', '/plot_lists'); setAuthChecking(false); return; }
    const savedPin = window.sessionStorage.getItem('maep_admin_pin');
    if (!savedPin) { setAuthChecking(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: savedPin }),
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && data.ok) {
          setPin(savedPin);
          setLoggedIn(true);
        } else {
          window.sessionStorage.removeItem('maep_admin_pin');
        }
      } catch {
        if (!cancelled) setError('Could not verify the saved admin session. Please sign in again.');
      } finally { if (!cancelled) setAuthChecking(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const plotById = useMemo(() => new Map(plots.flatMap(plot => [[String(plot.id), plot], [String(plot.project_id) + ':' + String(plot.id), plot]])), [plots]);

  useEffect(() => {
    if (page !== 'plots') return;
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError('');
    fetch('/api/projects', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || !Array.isArray(data.projects)) throw new Error(data.error || 'Could not load projects.');
        if (!cancelled) { setProjects(data.projects); setProjectsError(data.warning || ''); }
      })
      .catch(error => { if (!cancelled) setProjectsError(error.message || 'Could not load projects.'); })
      .finally(() => { if (!cancelled) setProjectsLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  async function loadData(view = page, currentPin = pin) {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin-data?view=' + encodeURIComponent(view) + (view === 'bookings' ? '&project_id=all' : ''), {
        headers: employeeToken ? { 'x-employee-token': employeeToken } : { 'x-admin-pin': currentPin },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load dashboard data.');
      if (view === 'bookings') {
        // The admin endpoint returns every project's plot inventory and bookings;
        // plot-table status remains the source of truth for the dashboard KPIs.
        setBookings(data.bookings || []);
        setPlots(data.plots || []);
        if (data.warning) setNotice(data.warning);
      } else {
        setPlots(data.plots || []);
      }
    } catch (e) {
      setError(e.message || 'Could not load data.');
    } finally { setLoading(false); }
  }

  async function login() {
    setSaving(true); setError('');
    try {
      if (role === 'user') {
        // Public User mode intentionally requires no email, OTP, PIN, or approval.
        window.sessionStorage.setItem('maep_user_mode', 'true');
        
        window.sessionStorage.removeItem('maep_admin_pin');
        window.location.assign('/');
        return;
      }
      if (role === 'employee') {
        const response = await fetch('/api/employee-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: employeeUsername, password: employeePassword }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Employee login failed.');
        window.sessionStorage.setItem('maep_employee_token', data.token); window.sessionStorage.setItem('maep_employee_username', data.username);
        window.sessionStorage.removeItem('maep_admin_pin'); window.sessionStorage.removeItem('maep_user_mode');
        setEmployeeToken(data.token); setUserName(data.username); setLoggedIn(true); setAuthChecking(false); setPage('plots'); setShowCreatePage(false); setEditingProject(null); window.history.replaceState({}, '', '/plot_lists'); return;
      }
      const response = await fetch('/api/admin-auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Admin login failed.');
      window.sessionStorage.setItem('maep_admin_pin', pin);
      // Keep successful Admin sign-in on the dedicated dashboard route.
      window.history.replaceState({}, '', '/dashboard');
      setShowCreatePage(false); setEditingProject(null);
      setPage('dashboard');
      setLoggedIn(true); setAuthChecking(false); setNotice('Welcome to the admin dashboard.');
      await loadData('bookings', pin);
    } catch (e) { setError(e.message || 'Could not sign in.'); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    if (loggedIn && role === 'user') { window.location.replace('/'); return; }
    if (loggedIn && role === 'employee' && !['plots', 'bookings', 'layout-landing'].includes(page)) { setPage('plots'); window.history.replaceState({}, '', '/plot_lists'); return; }
    if (loggedIn && role !== 'user' && page !== 'plots' && page !== 'users' && page !== 'layout-landing') loadData('bookings', pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, loggedIn, role]);

  async function saveBooking(values, rowId, statusOnly = false) {
    const normalizedPhone = statusOnly ? values.phone : normalizeIndianMobile(values.phone);
    if (!statusOnly && !normalizedPhone) { setError(INDIAN_MOBILE_ERROR); setNotice(''); return; }
    const payloadValues = statusOnly ? values : { ...values, phone: normalizedPhone };
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin-data', {
        method: rowId == null ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(employeeToken ? { 'x-employee-token': employeeToken } : { 'x-admin-pin': pin }) },
        body: JSON.stringify({ ...(rowId == null ? {} : { id: rowId }), ...payloadValues, project_id: Number(values.project_id || (PROJECT_IDS[projectTab] || PROJECT_IDS.velavan_nagar)) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save booking.');
      if (data.warning) setNotice(data.warning);
      else setNotice(statusOnly ? 'Status updated.' : rowId == null ? 'Customer added successfully.' : 'Booking updated successfully.');
      if (statusOnly) {
        setBookings(current => current.map(row => String(row.id) === String(rowId)
          ? { ...row, ...(data.booking || values), status: (data.booking || values).status || values.status }
          : row));
        if (data.plotStatusSynced) {
          setPlots(current => current.map(plot => String(plot.id) === String(values.plot_id) && String(plot.project_id) === String(values.project_id)
            ? { ...plot, status: values.status }
            : plot));
        }
        // Refresh the authoritative map status feed so the KPI cards update immediately.
        await loadData('bookings', pin);
      } else {
        setEdit(null);
        await loadData('bookings', pin);
      }
    } catch (e) { setError(e.message || 'Could not save booking.'); }
    finally { setSaving(false); }
  }

  async function deleteBooking(row) {
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin-data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(employeeToken ? { 'x-employee-token': employeeToken } : { 'x-admin-pin': pin }) },
        body: JSON.stringify({ id: row.id, project_id: row.project_id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete booking.');
      setDeleteTarget(null);
      setNotice('Booking deleted.');
      await loadData('bookings', pin);
    } catch (e) { setError(e.message || 'Could not delete booking.'); }
    finally { setSaving(false); }
  }

  // The map renders the static geometry inventory and overlays database statuses.
  // Build dashboard inventory from those same geometry plot numbers so extra DB
  // rows are ignored and missing DB rows use the map's Available fallback.
  const dashboardPlots = useMemo(() => {
    const selectedProjects = dashboardProjectFilter === 'all'
      ? Object.keys(PROJECT_IDS)
      : [dashboardProjectFilter];
    const databasePlotsByKey = new Map();
    plots.forEach(plot => {
      const plotNumber = String(plot.plot_number ?? plot.unit_number ?? plot.plot_no ?? plot.unit_no ?? plot.id).trim();
      databasePlotsByKey.set(String(plot.project_id) + ':' + plotNumber, plot);
    });
    return selectedProjects.flatMap(projectKey => {
      const projectId = PROJECT_IDS[projectKey];
      return (DASHBOARD_GEOMETRY_PLOTS[projectKey] || []).map(([plotNumber]) => {
        const number = String(plotNumber);
        const databasePlot = databasePlotsByKey.get(String(projectId) + ':' + number);
        return {
          project_id: projectId,
          plot_number: number,
          status: databasePlot
            ? (STATUSES.find(item => item.value.toLowerCase() === String(databasePlot.status ?? '').trim().toLowerCase())?.value || 'Unclassified')
            : 'Available',
        };
      });
    });
  }, [plots, dashboardProjectFilter]);
  const plotCounts = useMemo(() => {
    const counts = { Available: 0, Reserved: 0, Booked: 0, Sold: 0, Unclassified: 0 };
    dashboardPlots.forEach(plot => { counts[plot.status] = (counts[plot.status] || 0) + 1; });
    return counts;
  }, [dashboardPlots]);
  const showProjectColumn = page === 'bookings' ? projectTab === 'all' : page === 'dashboard' && dashboardProjectFilter === 'all';

  const selectedProjectBookings = useMemo(() => page !== 'bookings' || projectTab === 'all' ? bookings : bookings.filter(row => String(row.project_id) === String(PROJECT_IDS[projectTab])), [bookings, projectTab, page]);

  const visibleBookings = useMemo(() => bookings.filter(row => {
    const plot = plotById.get(String(row.project_id) + ':' + String(row.plot_id)) || plotById.get(String(row.plot_id));
    const unit = field(plot, 'plot_number', 'unit_number');
    const text = [row.id, row.customer_name, row.phone, row.plot_id, unit].map(v => String(v ?? '')).join(' ').toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase().trim());
    const matchesStatus = statusFilter === 'All' || normalizedStatus(row.status) === statusFilter;
    const matchesBookingProject = page !== 'bookings' || projectTab === 'all' || String(row.project_id) === String(PROJECT_IDS[projectTab]);
    const matchesDashboardProject = page !== 'dashboard' || dashboardProjectFilter === 'all' || String(row.project_id) === String(PROJECT_IDS[dashboardProjectFilter]);
    const matchesProject = matchesBookingProject && matchesDashboardProject;
    return matchesSearch && matchesStatus && matchesProject;
  }), [bookings, plotById, search, statusFilter, projectTab, dashboardProjectFilter, page]);

  useEffect(() => { setBookingPage(1); setSelectedBookingKeys([]); }, [search, statusFilter, projectTab, bookingPageSize]);
  const bookingPageCount = Math.max(1, Math.ceil(visibleBookings.length / bookingPageSize));
  useEffect(() => { if (bookingPage > bookingPageCount) setBookingPage(bookingPageCount); }, [bookingPage, bookingPageCount]);
  const paginatedBookings = useMemo(() => visibleBookings.slice((bookingPage - 1) * bookingPageSize, bookingPage * bookingPageSize), [visibleBookings, bookingPage, bookingPageSize]);
  const bookingKey = row => String(row.project_id) + ':' + String(row.id);
  const currentPageKeys = paginatedBookings.map(bookingKey);
  const allCurrentPageSelected = currentPageKeys.length > 0 && currentPageKeys.every(key => selectedBookingKeys.includes(key));
  const togglePageSelection = checked => setSelectedBookingKeys(current => checked ? Array.from(new Set([...current, ...currentPageKeys])) : current.filter(key => !currentPageKeys.includes(key)));
  const toggleBookingSelection = (row, checked) => setSelectedBookingKeys(current => checked ? Array.from(new Set([...current, bookingKey(row)])) : current.filter(key => key !== bookingKey(row)));
  const selectedBookingRows = visibleBookings.filter(row => selectedBookingKeys.includes(bookingKey(row)));

  async function bulkDeleteBookings() {
    if (!selectedBookingRows.length || saving) return;
    setSaving(true); setError(''); setNotice('');
    let deleted = 0; const failures = [];
    try {
      for (const row of selectedBookingRows) {
        try {
          const response = await fetch('/api/admin-data', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(employeeToken ? { 'x-employee-token': employeeToken } : { 'x-admin-pin': pin }) }, body: JSON.stringify({ id: row.id, project_id: row.project_id }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.ok) throw new Error(data.error || 'Delete failed');
          deleted++;
        } catch (err) { failures.push(field(row, 'customer_name', 'name') || ('Booking #' + row.id)); }
      }
      setBulkDeleteConfirm(false); setSelectedBookingKeys([]);
      if (deleted) setNotice(deleted + ' booking' + (deleted === 1 ? '' : 's') + ' deleted successfully.');
      if (failures.length) setError('Could not delete: ' + failures.join(', '));
      await loadData('bookings', pin);
    } finally { setSaving(false); }
  }

  if (authChecking) {
    return <main className="dash-login"><div className="login-card" role="status"><p className="login-copy">Checking your session…</p></div></main>;
  }

  if (!loggedIn) {
    return (
      <main className="dash-login">
        <form className="login-card" onSubmit={e => { e.preventDefault(); login(); }}>
          <img className="login-logo" src="/mary-ann-logo.svg" alt="Mary Ann Elite Properties" />
          <h1>Sign in</h1>
          <p className="login-copy">{role === 'admin' ? 'Sign in with your Admin PIN.' : role === 'employee' ? 'Sign in with your employee username and password.' : 'Continue to explore our projects and interactive plot layouts.'}</p>
          <label htmlFor="login-role">Role</label>
          <select id="login-role" value={role} onChange={e => { setRole(e.target.value); setError(''); setNotice(''); setPin(''); setEmployeeUsername(''); setEmployeePassword(''); }}><option value="admin">Admin</option><option value="employee">Employee</option><option value="user">User</option></select>
          {role === 'admin' && <><label htmlFor="admin-pin">Admin PIN</label><input id="admin-pin" type="password" inputMode="text" autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter your Admin PIN" required maxLength={32} /></>}
          {role === 'employee' && <><label htmlFor="employee-username">Username</label><input id="employee-username" autoComplete="username" value={employeeUsername} onChange={e => setEmployeeUsername(e.target.value)} required /><label htmlFor="employee-password">Password</label><div className="password-field login-password-field"><input id="employee-password" type={showLoginPassword ? 'text' : 'password'} autoComplete="current-password" value={employeePassword} onChange={e => setEmployeePassword(e.target.value)} required /><button type="button" className="password-toggle" aria-label={showLoginPassword ? 'Hide password' : 'Show password'} aria-pressed={showLoginPassword} onClick={() => setShowLoginPassword(value => !value)}>{showLoginPassword ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 9 4.6 10 7-.4 1-1.4 2.4-3 3.7M6.2 6.2C3.9 7.6 2.5 9.6 2 12c1 2.4 4.8 7 10 7 1 0 2-.2 2.9-.5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></>}
          {error && !(role === 'user' && error.includes('User access is not configured')) && <p className="dash-error" role="alert">{error}</p>}{notice && <p className="dash-notice" role="status">{notice}</p>}
          <button className="primary-btn login-submit" disabled={saving || (role === 'admin' && !pin) || (role === 'employee' && (!employeeUsername || !employeePassword))}>{saving ? 'Please wait…' : 'Sign in'} <span>→</span></button>
        </form>
        <AppDownload className="login-app-dl" />
      </main>
    );
  }

  return (
    <div className={"dashboard-shell" + (sidebarOpen ? " mobile-sidebar-open" : "")} data-native-app={String(nativeApp)}>
      {sidebarOpen && <button type="button" className="dashboard-sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} />}
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-header">
          <a className="dashboard-brand" href="/dashboard" aria-label="Mary Ann dashboard home">
            <img className="dashboard-brand-logo" src="/mary-ann-sidebar-white-logo.svg" alt="Mary Ann Elite Properties" />
          </a>
          <button type="button" className="dashboard-sidebar-close" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)}>×</button>
        </div>
        {role === 'admin' && <button className={'nav-item' + (page === 'dashboard' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/dashboard'); setPage('dashboard'); setShowCreatePage(false); setEditingProject(null); setSidebarOpen(false); }}><span className="nav-icon">▦</span> Dashboard</button>}
        {role !== 'user' && <button className={'nav-item' + (page === 'bookings' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/bookings'); setPage('bookings'); setShowCreatePage(false); setEditingProject(null); setSidebarOpen(false); }}>
          <span className="nav-icon">▤</span> Bookings
        </button>}
        {role !== 'user' && <button className={'nav-item' + (page === 'layout-landing' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/layout_landing'); setPage('layout-landing'); setShowCreatePage(false); setEditingProject(null); setSidebarOpen(false); }}><span className="nav-icon">✎</span> Layout Landing</button>}
        {role === 'admin' && <button className={'nav-item' + (page === 'users' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/users'); setPage('users'); setShowCreatePage(false); setEditingProject(null); setSidebarOpen(false); }}><span className="nav-icon">♙</span> Users</button>}
        <button className={'nav-item' + (page === 'plots' && !showCreatePage ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/plot_lists'); setPage('plots'); setShowCreatePage(false); setEditingProject(null); setSidebarOpen(false); }}>
          <span className="nav-icon">▦</span> Plot lists
        </button>
        {role !== 'user' && <button className={'nav-item' + (showCreatePage ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/create_plots'); setPage('plots'); setEditingProject(null); setShowCreatePage(true); setSidebarOpen(false); }}><span className="nav-icon">＋</span> Create Plots</button>}
              </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-mobile-brand-row"><a className="dashboard-mobile-brand" href="/dashboard" aria-label="Mary Ann dashboard home"><img src="/mary-ann-logo.svg" alt="Mary Ann Elite Properties" /></a><button type="button" className="dashboard-menu-toggle" aria-label="Open navigation menu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><span></span><span></span><span></span></button></div>
          <div className="dashboard-heading-group"><h1>{showCreatePage ? (editingProject ? 'Edit project' : 'Create Plots') : page === 'dashboard' ? 'Dashboard' : page === 'bookings' ? 'Bookings' : page === 'users' ? 'Users' : page === 'layout-landing' ? 'Layout Landing' : 'Plot lists'}</h1></div>
          <div className="topbar-actions profile-wrap">
            <button type="button" className="topbar-avatar profile-trigger" aria-label={role === 'admin' ? 'Open administrator menu' : 'Open user menu'} aria-expanded={profileOpen} onClick={() => setProfileOpen(open => !open)}><img className="topbar-avatar-image" src="/user-avatar.svg" alt="" /></button>
            {profileOpen && <div className="profile-menu" role="menu">
              <strong className="profile-role">{role === 'admin' ? 'Administrator' : role === 'employee' ? userName || 'Employee' : userName || 'User'}</strong>
              {role === 'admin' && <span className="profile-company">Mary Ann Elite Properties</span>}
              <span className="profile-session"><i />{role === 'admin' ? 'Connected to admin session' : role === 'employee' ? 'Employee session' : 'Approved user session'}</span>
              <button className="profile-signout" role="menuitem" onClick={() => { setProfileOpen(false); if (window.sessionStorage.getItem('maep_admin_session')) fetch('/api/admin-auth?action=logout', { method: 'POST', keepalive: true }).catch(() => {}).finally(() => window.sessionStorage.removeItem('maep_admin_session')); window.sessionStorage.removeItem('maep_admin_pin'); window.sessionStorage.removeItem('maep_user_mode'); window.sessionStorage.removeItem('maep_employee_token'); window.sessionStorage.removeItem('maep_employee_username'); setEmployeeToken(''); setLoggedIn(false); setPin(''); setUserName(''); setBookings([]); setPlots([]); setError(''); setNotice(''); setRole('admin'); setShowCreatePage(false); setEditingProject(null); setProjectDelete(null); }}>Sign out</button>
            </div>}
          </div>
        </header>

        <section className="dashboard-content">
          {page !== 'plots' && error && <div className="alert alert-error" role="alert">{error}</div>}
          {page !== 'plots' && notice && <div className="alert alert-success" role="status">{notice}</div>}

          {page === 'layout-landing' ? <LayoutLandingEditor pin={pin} employeeToken={employeeToken} setError={setError} setNotice={setNotice} /> : showCreatePage ? (
            <CreatePlotsPage editingProject={editingProject} authHeaders={employeeToken ? { 'x-employee-token': employeeToken } : { 'x-admin-pin': pin }} onCancel={() => { setShowCreatePage(false); setEditingProject(null); window.history.pushState({}, '', '/plot_lists'); }} onSaved={async () => {
              try {
                const response = await fetch('/api/projects', { cache: 'no-store' });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) throw new Error(data.error || 'Project saved, but the list could not refresh.');
                setProjects(data.projects || []); setProjectsError(data.warning || '');
              } catch (refreshError) {
                setProjectsError(refreshError.message || 'Project saved, but the project list could not refresh.');
              }
              setShowCreatePage(false); setEditingProject(null);
              window.history.pushState({}, '', '/plot_lists'); setNotice('Project saved successfully.');
            }} />
          ) : page !== 'plots' ? (
            <>
              {page === 'users' ? <EmployeeUsersPage pin={pin} employees={employees} setEmployees={setEmployees} employeeForm={employeeForm} setEmployeeForm={setEmployeeForm} employeeDelete={employeeDelete} setEmployeeDelete={setEmployeeDelete} setError={setError} setNotice={setNotice} /> : page === 'dashboard' ? (
                <>
                  <div className="dashboard-welcome"><div><h2>{dashboardProjectFilter === 'all' ? 'All Projects' : (PROJECT_NAMES[PROJECT_IDS[dashboardProjectFilter]] || 'Selected Project')}</h2></div><div className="dashboard-welcome-actions"><label className="dashboard-project-filter"><span>Project</span><select value={dashboardProjectFilter} onChange={e => setDashboardProjectFilter(e.target.value)} aria-label="Filter dashboard by project"><option value="all">All Projects</option><option value="velavan_nagar">Velavan Nagar</option><option value="saraswathi_garden">Saraswathi Garden</option><option value="shanmuga_avenue">Shanmuga Avenue</option><option value="meenakshi_garden_phase1">Meenakshi Garden Phase 1</option><option value="meenakshi_garden_phase2">Meenakshi Garden Phase 2</option></select></label><div className="inventory-total"><span>Total units</span><strong>{dashboardPlots.length}</strong><small>{dashboardProjectFilter === 'all' ? 'Across all projects' : 'Selected project'}</small></div></div></div>
                  <div className="kpi-grid">
                    <article className="kpi-card kpi-available"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12.5 9.2 17 20 6" /></svg></div><div className="kpi-content"><span className="kpi-label">Available plots</span><strong>{plotCounts.Available || 0}</strong><small>Ready for enquiry</small></div></article>
                    <article className="kpi-card kpi-reserved"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5 14.6 8.8 20.5 9.6 16.2 13.7 17.2 19.5 12 16.7 6.8 19.5 7.8 13.7 3.5 9.6 9.4 8.8Z" /></svg></div><div className="kpi-content"><span className="kpi-label">Reserved plots</span><strong>{plotCounts.Reserved || 0}</strong><small>Temporarily held</small></div></article>
                    <article className="kpi-card kpi-booked"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14l2.5 2.5L16 12" /></svg></div><div className="kpi-content"><span className="kpi-label">Booked plots</span><strong>{plotCounts.Booked || 0}</strong><small>Booking in progress</small></div></article>
                    <article className="kpi-card kpi-sold"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12 12 4h7l1 7-8 9Z"/><circle cx="16" cy="8" r="1"/><path d="m8.5 13.5 2 2 4-4" /></svg></div><div className="kpi-content"><span className="kpi-label">Sold plots</span><strong>{plotCounts.Sold || 0}</strong><small>Successfully sold</small></div></article>
                  </div>
                  {plotCounts.Unclassified > 0 && <p className="dashboard-inventory-warning" role="status">{plotCounts.Unclassified} unit(s) have an empty or unrecognized status. Please review these plot records.</p>}
                  <div className="inventory-progress"><div><span>Inventory movement</span><strong>{dashboardPlots.length ? Math.round(((plotCounts.Reserved + plotCounts.Booked + plotCounts.Sold) / dashboardPlots.length) * 100) : 0}% committed</strong></div><div className="inventory-track"><i style={{ width: (dashboardPlots.length ? Math.min(100, ((plotCounts.Reserved + plotCounts.Booked + plotCounts.Sold) / dashboardPlots.length) * 100) : 0) + '%' }} /></div></div>

                </>
              ) : null}
              {page !== 'users' && <div className={page === 'dashboard' ? "dashboard-recent-layout" : "dashboard-recent-layout dashboard-recent-layout-single"}>
                <div className="dashboard-recent-main">
              <div className="page-intro"><div><h2>{page === 'dashboard' ? 'Recent enquiries & bookings' : 'Bookings overview'}</h2><p>Review customer enquiries and manage unit availability.</p></div>{page !== 'dashboard' && <div className="record-count"><strong>{selectedProjectBookings.length}</strong><span>Total bookings</span></div>}</div>
              {page === 'bookings' && <div className="booking-project-tabs" role="tablist" aria-label="Filter bookings by project">
                {[['all', 'All'], ['velavan_nagar', 'Velavan Nagar'], ['saraswathi_garden', 'Saraswathi Garden'], ['shanmuga_avenue', 'Shanmuga Avenue'], ['meenakshi_garden_phase1', 'Meenakshi Phase 1'], ['meenakshi_garden_phase2', 'Meenakshi Phase 2']].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={projectTab === key} className={'booking-project-tab' + (projectTab === key ? ' active' : '')} onClick={() => setProjectTab(key)}>{label}</button>)}
              </div>}
              <section className="table-card">
                <div className="table-toolbar">
                  <label className="search-field"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, phone or unit…" /></label>
                  <div className="booking-toolbar-actions">
                    {page === 'bookings' && <button type="button" className="add-customer-btn" onClick={() => { setError(''); setEdit({ id: null, customer_name: '', phone: '', plot_id: '', status: 'Available', project_id: PROJECT_IDS[projectTab === 'all' ? 'velavan_nagar' : projectTab] }); }}>Add Customers +</button>}
                    <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
                      <option value="All">All statuses</option>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                {page === 'bookings' && <div className="booking-bulk-toolbar"><span>{selectedBookingKeys.length} selected</span><button type="button" className="delete-btn" onClick={() => setBulkDeleteConfirm(true)} disabled={!selectedBookingRows.length || saving}>Delete selected</button></div>}
                {loading ? <div className="table-state">Loading bookings from Supabase…</div> : (
                  <div className="table-scroll"><table className="data-table">
                    <thead><tr>{page === 'bookings' && <th><input type="checkbox" aria-label="Select all bookings on this page" checked={allCurrentPageSelected} onChange={e => togglePageSelection(e.target.checked)} /></th>}<th>ID</th>{showProjectColumn && <th>Project</th>}<th>Customer Name</th><th>Phone Number</th><th>Plot Id</th><th>Unit Number</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {(page === 'bookings' ? paginatedBookings : visibleBookings.slice(0, 5)).map(row => {
                        const plot = plotById.get(String(row.project_id) + ':' + String(row.plot_id)) || plotById.get(String(row.plot_id));
                        return <tr key={String(row.project_id) + ':' + row.id}>
                          {page === 'bookings' && <td><input type="checkbox" aria-label={'Select booking ' + row.id} checked={selectedBookingKeys.includes(bookingKey(row))} onChange={e => toggleBookingSelection(row, e.target.checked)} /></td>}
                          <td className="id-cell">#{row.id}</td>
                          {showProjectColumn && <td><span className="unit-pill">{PROJECT_NAMES[row.project_id] || projects.find(project => Number(project.project_id) === Number(row.project_id))?.name || ('Project ' + row.project_id)}</span></td>}
                          <td><strong>{field(row, 'customer_name', 'name') || '—'}</strong></td>
                          <td>{field(row, 'phone', 'phone_number') || '—'}</td>
                          <td>{row.plot_id ?? '—'}</td>
                          <td><span className="unit-pill">{field(plot, 'plot_number', 'unit_number') || '—'}</span></td>
                          <td>{role === 'employee' ? <span className={'status-select status-' + normalizedStatus(row.status).toLowerCase()}>{statusLabel(row.status)}</span> : <select className={'status-select status-' + normalizedStatus(row.status).toLowerCase()} value={normalizedStatus(row.status)} onChange={e => saveBooking({
                            customer_name: field(row, 'customer_name', 'name'),
                            phone: field(row, 'phone', 'phone_number'),
                            plot_id: row.plot_id,
                            project_id: row.project_id,
                            status: e.target.value,
                          }, row.id, true)} disabled={saving} aria-label={'Status for booking ' + row.id}>
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>}</td>
                          <td><div className="row-actions"><button className="edit-btn" type="button" onClick={() => { setError(''); setEdit({
                            id: row.id, customer_name: field(row, 'customer_name', 'name'), phone: field(row, 'phone', 'phone_number'),
                            plot_id: String(row.plot_id ?? ''), project_id: Number(row.project_id || 1), status: normalizedStatus(row.status),
                          }); }} disabled={saving}>Edit</button><button className="delete-btn" type="button" onClick={() => setDeleteTarget(row)} disabled={saving}>Delete</button></div></td>
                        </tr>;
                      })}
                      {!(page === 'bookings' ? paginatedBookings : visibleBookings.slice(0, 5)).length && <tr><td colSpan={(showProjectColumn ? 8 : 7) + (page === 'bookings' ? 1 : 0)} className="empty-cell">{selectedProjectBookings.length ? 'No bookings match your search.' : 'No bookings found in Supabase.'}</td></tr>}
                    </tbody>
                  </table></div>
                )}
                {page === 'bookings' ? <div className="booking-pagination">
                  <div className="booking-pagination-summary">Showing {visibleBookings.length ? ((bookingPage - 1) * bookingPageSize + 1) : 0}–{Math.min(bookingPage * bookingPageSize, visibleBookings.length)} of {visibleBookings.length} filtered bookings</div>
                  <div className="booking-pagination-controls">
                    <label>Items per page <select value={bookingPageSize} onChange={e => setBookingPageSize(Number(e.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
                    <button type="button" className="page-btn" onClick={() => setBookingPage(1)} disabled={bookingPage <= 1}>First</button>
                    <button type="button" className="page-btn" onClick={() => setBookingPage(value => Math.max(1, value - 1))} disabled={bookingPage <= 1}>Previous</button>
                    <span className="page-indicator">Page {bookingPage} of {bookingPageCount}</span>
                    <button type="button" className="page-btn" onClick={() => setBookingPage(value => Math.min(bookingPageCount, value + 1))} disabled={bookingPage >= bookingPageCount}>Next</button>
                    <button type="button" className="page-btn" onClick={() => setBookingPage(bookingPageCount)} disabled={bookingPage >= bookingPageCount}>Last</button>
                  </div>
                </div> : <div className="table-footer">Showing {visibleBookings.length} of {selectedProjectBookings.length} bookings</div>}
              </section>
                </div>
                {page === 'dashboard' && (
                  <div className="inventory-mix-widget">
                    <div className="chart-heading inventory-mix-heading">
                      <div><span className="chart-eyebrow">INVENTORY MIX</span><h3>Plot availability</h3></div>
                    </div>
                    <article className="chart-panel chart-panel-donut">
                      <div className="donut-layout">
                        <div className="inventory-donut" style={{ background: dashboardPlots.length ? `conic-gradient(#18a779 0% ${plotCounts.Available / dashboardPlots.length * 100}%, #e8b34e ${plotCounts.Available / dashboardPlots.length * 100}% ${(plotCounts.Available + plotCounts.Reserved) / dashboardPlots.length * 100}%, #4e82d5 ${(plotCounts.Available + plotCounts.Reserved) / dashboardPlots.length * 100}% ${(plotCounts.Available + plotCounts.Reserved + plotCounts.Booked) / dashboardPlots.length * 100}%, #dd6572 ${(plotCounts.Available + plotCounts.Reserved + plotCounts.Booked) / dashboardPlots.length * 100}% 100%)` : 'conic-gradient(#e5eaf1 0% 100%)' }}>
                          <div className="donut-hole"><strong>{dashboardPlots.length}</strong><span>Total plots</span></div>
                        </div>
                        <div className="chart-legend">
                          <div><i className="legend-available" /><span>Available</span><strong>{plotCounts.Available}</strong></div>
                          <div><i className="legend-reserved" /><span>Reserved</span><strong>{plotCounts.Reserved}</strong></div>
                          <div><i className="legend-booked" /><span>Booked</span><strong>{plotCounts.Booked}</strong></div>
                          <div><i className="legend-sold" /><span>Sold</span><strong>{plotCounts.Sold}</strong></div>
                        </div>
                      </div>
                    </article>
                  </div>
                )}
              </div>}
            </>
          ) : (
            <section className="project-list-view" aria-label="Project list">
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              {notice && <div className="alert alert-success" role="status">{notice}</div>}
              {projectsError && projects.length > 0 && <div className="alert alert-error" role="status">{projectsError}</div>}
              <label className="project-filter-box">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={plotSearch} onChange={e => setPlotSearch(e.target.value)} placeholder="Search projects..." aria-label="Filter projects" />
                <span className="filter-caption">FILTER</span>
              </label>
              {projectsLoading ? (
                <div className="project-filter-empty"><strong>Loading projects…</strong></div>
              ) : projectsError && !projects.length ? (
                <div className="project-filter-empty" role="alert"><strong>Could not load projects</strong><p>{projectsError}</p><button type="button" className="edit-btn" onClick={() => window.location.reload()}>Retry</button></div>
              ) : projects.filter(project => [project.name, project.layout, project.location, project.description].join(' ').toLowerCase().includes(plotSearch.trim().toLowerCase())).length ? (
                <div className="project-cards">
                  {projects.filter(project => [project.name, project.layout, project.location, project.description].join(' ').toLowerCase().includes(plotSearch.trim().toLowerCase())).map(project => (
                    <article className="project-list-card" key={project.id} role="link" tabIndex={0} onClick={() => { window.open(project.route || ('/' + project.slug), '_blank', 'noopener,noreferrer'); }} onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.open(project.route || ('/' + project.slug), '_blank', 'noopener,noreferrer'); } }} aria-label={'Open ' + project.name + ' interactive plot map'}>
                      <div className="project-card-visual" aria-label={'Preview for ' + project.name}>
                        {project.mapKey === 'velavan_nagar' ? (
                          <svg className="project-map-static" viewBox="0 0 4400 3400" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Static thumbnail of the Velavan Nagar plot layout">
                            <rect width="4400" height="3400" fill="#e8e4dc" />
                            <g fill="#363e4c">{G.base.map((d, i) => <path key={'road-' + i} d={d} />)}</g>
                            <g fill="#cdd3c3">{G.park.map((d, i) => <path key={'park-' + i} d={d} />)}</g>
                            <g fill="#ded6c6">{G.misc.map((d, i) => <path key={'misc-' + i} d={d} />)}</g>
                            <g fill="none" stroke="#e9e4d6" strokeWidth="6" strokeDasharray="34 26">{G.dash.map((d, i) => <path key={'road-mark-' + i} d={d} />)}</g>
                            <g stroke="#aab0ba" strokeWidth="8" strokeLinejoin="round">{P.map(([id, x, y, points, area, pm]) => <polygon key={id} points={points} fill={pm ? '#dcdfe5' : '#ffffff'} />)}</g>
                            <g fill="#1b2433" stroke="#ffffff" strokeWidth="10" paintOrder="stroke" fontSize="44" fontWeight="700" textAnchor="middle" dominantBaseline="central">{P.map(([id, x, y]) => <text key={'number-' + id} x={x} y={y}>{id}</text>)}</g>
                          </svg>
                        ) : (
                          <ProjectMapThumbnail project={project} />
                        )}
                        <div className="project-preview-overlay" aria-hidden="true"><span className="project-visual-mark">MA</span><span className="project-visual-tag">INTERACTIVE PLOT MAP</span></div>
                      </div>
                      <div className="project-card-content">
                        <div className="project-card-heading"><div><span className="project-card-kicker">MARY ANN ELITE PROPERTIES</span><h2>{project.name}</h2></div><span className="project-card-arrow" aria-hidden="true">↗</span></div>
                        <p className="project-card-location"><span aria-hidden="true">⌖</span> {project.location}</p>
                        <p className="project-card-description">{project.description}</p>
                        <div className="project-card-footer"><span className="project-type"><span aria-hidden="true">▦</span> Interactive Plot Layout · {project.geometry?.P?.length ?? DASHBOARD_GEOMETRY_PLOTS[project.slug]?.length ?? 0} Plots</span><span className="project-view-link">{project.mapReady ? 'View project' : 'Map coming soon'} <span aria-hidden="true">{project.mapReady ? '→' : '…'}</span></span></div>
                      </div>
                      {role !== 'user' && project.customProjectId != null && <div className="project-card-actions" onClick={e => e.stopPropagation()}>
                        <button type="button" className="edit-btn" onClick={() => { setEditingProject(project); setShowCreatePage(true); window.history.pushState({}, '', '/create_plots'); }}>Edit details</button>
                        <button type="button" className="delete-btn" onClick={() => setProjectDelete(project)}>Delete project</button>
                      </div>}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="project-filter-empty"><span aria-hidden="true">⌕</span><strong>No projects found</strong><p>Try another project name or location.</p></div>
              )}
            </section>
          )}
        </section>
      </main>

      {edit && <div className="edit-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEdit(null); }}>
        <form className="edit-modal" onSubmit={e => { e.preventDefault(); saveBooking(edit, edit.id); }}>
          <button type="button" className="modal-close" onClick={() => setEdit(null)} aria-label="Close">×</button>
          <p className="eyebrow">{edit.id == null ? 'MANUAL CUSTOMER ENTRY' : 'BOOKING #' + edit.id}</p><h2>{edit.id == null ? 'Add customer' : 'Edit booking'}</h2><p className="modal-copy">{edit.id == null ? 'Enter customer details and add them to the bookings table.' : 'Update customer details, unit and availability status.'}</p>
          <label>Customer Name<input value={edit.customer_name} onChange={e => setEdit(s => ({ ...s, customer_name: e.target.value }))} required maxLength={120} /></label>
          <label>Phone Number<input type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210 or +91 98765 43210" value={edit.phone} onChange={e => setEdit(s => ({ ...s, phone: e.target.value }))} onBlur={() => setEdit(s => ({ ...s, phone: normalizeIndianMobile(s.phone) || s.phone }))} required maxLength={16} /></label>
          <label>Unit Number<select value={edit.plot_id} onChange={e => {
            const selected = plots.find(plot => String(plot.id) === e.target.value);
            setEdit(s => ({ ...s, plot_id: e.target.value, status: normalizedStatus(selected?.status) === 'Reserved' ? 'Reserved' : s.status }));
          }} required>
            <option value="" disabled>Select a unit</option>
            {plots.filter(plot => {
              const plotStatus = normalizedStatus(plot.status);
              const sameProject = String(plot.project_id) === String(edit.project_id);
              return sameProject && ((edit?.id != null && String(plot.id) === String(edit.plot_id)) || !['Booked', 'Sold'].includes(plotStatus));
            }).map(plot => <option key={plot.id} value={String(plot.id)}>{field(plot, 'plot_number', 'unit_number')} (Plot ID: {plot.id})</option>)}
          </select></label>
          <label>Status<select value={edit.status} onChange={e => setEdit(s => ({ ...s, status: e.target.value }))}>{STATUSES.filter(s => edit.id != null || ['Available', 'Reserved'].includes(s.value)).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          {error && <p className="dash-error">{error}</p>}
          <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setEdit(null)}>Cancel</button><button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : edit.id == null ? 'Add customer' : 'Save changes'}</button></div>
        </form>
      </div>}
      {bulkDeleteConfirm && <div className="edit-overlay confirm-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setBulkDeleteConfirm(false); }}>
        <section className="confirm-modal" role="alertdialog" aria-modal="true">
          <div className="confirm-icon" aria-hidden="true">!</div><button type="button" className="modal-close" onClick={() => setBulkDeleteConfirm(false)} aria-label="Close" disabled={saving}>×</button>
          <p className="eyebrow">CONFIRM BULK ACTION</p><h2>Delete selected bookings?</h2>
          <p>Are you sure you want to permanently delete <strong>{selectedBookingRows.length}</strong> selected booking{selectedBookingRows.length === 1 ? '' : 's'}? This action cannot be undone.</p>
          <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setBulkDeleteConfirm(false)} disabled={saving}>Cancel</button><button type="button" className="confirm-delete-btn" onClick={bulkDeleteBookings} disabled={saving}>{saving ? 'Deleting…' : 'Yes, delete selected'}</button></div>
        </section>
      </div>}
      {projectDelete && <div className="edit-overlay confirm-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setProjectDelete(null); }}>
        <section className="confirm-modal project-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="project-delete-title">
          <div className="confirm-icon" aria-hidden="true">!</div><button type="button" className="modal-close" onClick={() => setProjectDelete(null)} aria-label="Close" disabled={saving}>×</button>
          <p className="eyebrow">PERMANENT PROJECT ACTION</p><h2 id="project-delete-title">Delete this project?</h2>
          <p><strong>{projectDelete.name}</strong> and its plot inventory, bookings, map edits, and uploaded source file will be deleted. Existing built-in projects cannot be deleted here.</p>
          {error && <p className="dash-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setProjectDelete(null)} disabled={saving}>Cancel</button><button type="button" className="confirm-delete-btn" disabled={saving} onClick={async () => {
            setSaving(true); setError('');
            try {
              const response = await fetch('/api/create-project?action=delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(employeeToken ? { 'x-employee-token': employeeToken } : { 'x-admin-pin': pin }) }, body: JSON.stringify({ id: projectDelete.customProjectId }) });
              const data = await response.json().catch(() => ({}));
              if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete project.');
              setProjectDelete(null);
              const refreshed = await fetch('/api/projects', { cache: 'no-store' }); const result = await refreshed.json().catch(() => ({}));
              if (!refreshed.ok || !result.ok) throw new Error(result.error || 'Project deleted, but list refresh failed.');
              setProjects(result.projects || []); setProjectsError(result.warning || ''); setNotice(data.storage_cleanup_pending ? 'Project deleted. Source-file cleanup is pending.' : 'Project deleted successfully.');
            } catch (e) { setError(e.message || 'Could not delete project.'); }
            finally { setSaving(false); }
          }}>{saving ? 'Deleting…' : 'Yes, delete project'}</button></div>
        </section>
      </div>}
      {deleteTarget && <div className="edit-overlay confirm-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setDeleteTarget(null); }}>
        <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-copy">
          <div className="confirm-icon" aria-hidden="true">!</div>
          <button type="button" className="modal-close" onClick={() => setDeleteTarget(null)} aria-label="Close" disabled={saving}>×</button>
          <p className="eyebrow">CONFIRM ACTION</p>
          <h2 id="delete-confirm-title">Delete customer booking?</h2>
          <p id="delete-confirm-copy">Are you sure you want to delete <strong>{field(deleteTarget, 'customer_name', 'name') || 'this customer'}</strong>? This action cannot be undone.</p>
          <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</button><button type="button" className="confirm-delete-btn" onClick={() => deleteBooking(deleteTarget)} disabled={saving}>{saving ? 'Deleting…' : 'Yes, delete'}</button></div>
        </section>
      </div>}
    </div>
  );
}

const APK_URL = 'https://github.com/joshua270390/PlotMap_MAEP/releases/latest/download/MaryAnn-PlotMap.apk';
function AppDownload({ className }) {
  if (typeof navigator !== 'undefined' && /MAEPApp/.test(navigator.userAgent)) return null;
  return <a className={className} href={APK_URL} rel="noopener"><span className="nav-icon">📱</span> Download the App</a>;
}
