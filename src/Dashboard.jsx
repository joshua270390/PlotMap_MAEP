import { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';
import { P, G } from './data.js';

const PROJECT_IDS = { velavan_nagar: 1, saraswathi_garden: 3, shanmuga_avenue: 2 };
const PROJECT_NAMES = { 1: 'Velavan Nagar', 3: 'Saraswathi Garden', 2: 'Shanmuga Avenue' };
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
  const [page, setPage] = useState(() => { const path = window.location.pathname.replace(/\/+$/, ''); return path === '/plot_lists' ? 'plots' : path === '/bookings' ? 'bookings' : path === '/users' ? 'users' : 'dashboard'; });
  const [bookings, setBookings] = useState([]);
  const [plots, setPlots] = useState([]);
  const [mapPlotStatuses, setMapPlotStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [plotSearch, setPlotSearch] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectTab, setProjectTab] = useState('all');
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keep the rendered dashboard page aligned with browser Back/Forward navigation.
  // Returning from a dashboard route to '/' must remount the PlotMap app, not leave stale dashboard UI.
  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (role !== 'admin') {
        if (path !== '/plot_lists') window.history.replaceState({}, '', '/plot_lists');
        setPage('plots');
        return;
      }
      const routes = ['/dashboard', '/bookings', '/plot_lists', '/users'];
      if (!routes.includes(path)) {
        window.location.reload();
        return;
      }
      setPage(path === '/plot_lists' ? 'plots' : path === '/bookings' ? 'bookings' : path === '/users' ? 'users' : 'dashboard');
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [role]);

  // Restore and verify saved Admin or approved User sessions after a refresh.
  useEffect(() => {
    const savedUserMode = window.sessionStorage.getItem('maep_user_mode');
    if (savedUserMode === 'true') {
      setRole('user'); setUserName('User'); setLoggedIn(true); setPage('plots');
      if (window.location.pathname !== '/plot_lists') window.history.replaceState({}, '', '/plot_lists');
      setAuthChecking(false);
      return;
    }
    const savedEmployeeToken = window.sessionStorage.getItem('maep_employee_token');
    if (savedEmployeeToken) { setRole('employee'); setEmployeeToken(savedEmployeeToken); setUserName(window.sessionStorage.getItem('maep_employee_username') || 'Employee'); setLoggedIn(true); setPage('plots'); if (window.location.pathname !== '/plot_lists') window.history.replaceState({}, '', '/plot_lists'); setAuthChecking(false); return; }
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
        if (!cancelled) setProjects(data.projects);
      })
      .catch(error => { if (!cancelled) setProjectsError(error.message || 'Could not load projects.'); })
      .finally(() => { if (!cancelled) setProjectsLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  async function loadData(view = page, currentPin = pin) {
    setLoading(true); setError('');
    try {
      const requests = [fetch('/api/admin-data?view=' + encodeURIComponent(view) + (view === 'bookings' ? '&project_id=all' : ''), {
        headers: { 'x-admin-pin': currentPin },
        cache: 'no-store',
      })];
      // Dashboard KPIs must use the exact public status feed used by the plot map,
      // not booking-row statuses that can disagree with manually edited plot states.
      if (view === 'bookings') requests.push(fetch('/api/plots', { cache: 'no-store' }));
      const responses = await Promise.all(requests);
      const response = responses[0];
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load dashboard data.');
      if (view === 'bookings') {
        const mapResponse = responses[1];
        const mapData = await mapResponse.json().catch(() => ({}));
        if (!mapResponse.ok || !mapData.ok) throw new Error('Could not load plot-map availability. Please refresh and try again.');
        setMapPlotStatuses(mapData.plots || {});
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
        setUserName('User'); setLoggedIn(true); setAuthChecking(false); setPage('plots');
        window.history.replaceState({}, '', '/plot_lists');
        setNotice('Welcome. You can view plot lists and submit enquiries.');
        return;
      }
      if (role === 'employee') {
        const response = await fetch('/api/employee-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: employeeUsername, password: employeePassword }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Employee login failed.');
        window.sessionStorage.setItem('maep_employee_token', data.token); window.sessionStorage.setItem('maep_employee_username', data.username);
        window.sessionStorage.removeItem('maep_admin_pin'); window.sessionStorage.removeItem('maep_user_mode');
        setEmployeeToken(data.token); setUserName(data.username); setLoggedIn(true); setAuthChecking(false); setPage('plots'); window.history.replaceState({}, '', '/plot_lists'); return;
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
      setPage('dashboard');
      setLoggedIn(true); setAuthChecking(false); setNotice('Welcome to the admin dashboard.');
      await loadData('bookings', pin);
    } catch (e) { setError(e.message || 'Could not sign in.'); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    if (loggedIn && role !== 'admin' && page !== 'plots') { setPage('plots'); window.history.replaceState({}, '', '/plot_lists'); return; }
    if (loggedIn && role === 'admin' && page !== 'plots' && page !== 'users') loadData('bookings', pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, loggedIn, role]);

  async function saveBooking(values, rowId, statusOnly = false) {
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin-data', {
        method: rowId == null ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ ...(rowId == null ? {} : { id: rowId }), ...values, project_id: Number(values.project_id || (PROJECT_IDS[projectTab] || PROJECT_IDS.velavan_nagar)) }),
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
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ id: row.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete booking.');
      setDeleteTarget(null);
      setNotice('Booking deleted.');
      await loadData('bookings', pin);
    } catch (e) { setError(e.message || 'Could not delete booking.'); }
    finally { setSaving(false); }
  }

  const plotCounts = useMemo(() => {
    const counts = { Available: 0, Reserved: 0, Booked: 0, Sold: 0 };
    P.forEach(([id]) => {
      const value = normalizedStatus(mapPlotStatuses[String(id)]);
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }, [mapPlotStatuses]);

  const selectedProjectBookings = useMemo(() => page !== 'bookings' || projectTab === 'all' ? bookings : bookings.filter(row => String(row.project_id) === String(PROJECT_IDS[projectTab])), [bookings, projectTab, page]);

  const visibleBookings = useMemo(() => bookings.filter(row => {
    const plot = plotById.get(String(row.project_id) + ':' + String(row.plot_id)) || plotById.get(String(row.plot_id));
    const unit = field(plot, 'plot_number', 'unit_number');
    const text = [row.id, row.customer_name, row.phone, row.plot_id, unit].map(v => String(v ?? '')).join(' ').toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase().trim());
    const matchesStatus = statusFilter === 'All' || normalizedStatus(row.status) === statusFilter;
    const matchesProject = page !== 'bookings' || projectTab === 'all' || String(row.project_id) === String(PROJECT_IDS[projectTab]);
    return matchesSearch && matchesStatus && matchesProject;
  }), [bookings, plotById, search, statusFilter, projectTab, page]);

  if (authChecking) {
    return <main className="dash-login"><div className="login-card" role="status"><p className="login-copy">Checking your session…</p></div></main>;
  }

  if (!loggedIn) {
    return (
      <main className="dash-login">
        <form className="login-card" onSubmit={e => { e.preventDefault(); login(); }}>
          <img className="login-logo" src="/mary-ann-logo.svg" alt="Mary Ann Elite Properties" />
          <h1>Sign in</h1>
          <p className="login-copy">{role === 'admin' ? 'Sign in with your Admin PIN.' : role === 'employee' ? 'Sign in with your employee username and password.' : 'Select User and sign in to view plot lists and submit enquiries.'}</p>
          <label htmlFor="login-role">Role</label>
          <select id="login-role" value={role} onChange={e => { setRole(e.target.value); setError(''); setNotice(''); setPin(''); setEmployeeUsername(''); setEmployeePassword(''); }}><option value="admin">Admin</option><option value="employee">Employee</option><option value="user">User</option></select>
          {role === 'admin' && <><label htmlFor="admin-pin">Admin PIN</label><input id="admin-pin" type="password" inputMode="text" autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter your Admin PIN" required maxLength={32} /></>}
          {role === 'employee' && <><label htmlFor="employee-username">Username</label><input id="employee-username" autoComplete="username" value={employeeUsername} onChange={e => setEmployeeUsername(e.target.value)} required /><label htmlFor="employee-password">Password</label><div className="password-field login-password-field"><input id="employee-password" type={showLoginPassword ? 'text' : 'password'} autoComplete="current-password" value={employeePassword} onChange={e => setEmployeePassword(e.target.value)} required /><button type="button" className="password-toggle" aria-label={showLoginPassword ? 'Hide password' : 'Show password'} aria-pressed={showLoginPassword} onClick={() => setShowLoginPassword(value => !value)}>{showLoginPassword ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 9 4.6 10 7-.4 1-1.4 2.4-3 3.7M6.2 6.2C3.9 7.6 2.5 9.6 2 12c1 2.4 4.8 7 10 7 1 0 2-.2 2.9-.5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></>}
          {error && !(role === 'user' && error.includes('User access is not configured')) && <p className="dash-error" role="alert">{error}</p>}{notice && <p className="dash-notice" role="status">{notice}</p>}
          <button className="primary-btn login-submit" disabled={saving || (role === 'admin' && !pin) || (role === 'employee' && (!employeeUsername || !employeePassword))}>{saving ? 'Please wait…' : 'Sign in'} <span>→</span></button>
        </form>
      </main>
    );
  }

  return (
    <div className={"dashboard-shell" + (sidebarOpen ? " mobile-sidebar-open" : "")}>
      {sidebarOpen && <button type="button" className="dashboard-sidebar-backdrop" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} />}
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-header">
          <a className="dashboard-brand" href="/dashboard" aria-label="Mary Ann dashboard home">
            <img className="dashboard-brand-logo" src="/mary-ann-sidebar-white-logo.svg" alt="Mary Ann Elite Properties" />
          </a>
          <button type="button" className="dashboard-sidebar-close" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)}>×</button>
        </div>
        {role === 'admin' && <button className={'nav-item' + (page === 'dashboard' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/dashboard'); setPage('dashboard'); setSidebarOpen(false); }}><span className="nav-icon">▦</span> Dashboard</button>}
        {role === 'admin' && <button className={'nav-item' + (page === 'bookings' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/bookings'); setPage('bookings'); setSidebarOpen(false); }}>
          <span className="nav-icon">▤</span> Bookings
        </button>}
        {role === 'admin' && <button className={'nav-item' + (page === 'users' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/users'); setPage('users'); setSidebarOpen(false); }}><span className="nav-icon">♙</span> Users</button>}
        <button className={'nav-item' + (page === 'plots' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/plot_lists'); setPage('plots'); setSidebarOpen(false); }}>
          <span className="nav-icon">▦</span> Plot lists
        </button>
              </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-mobile-brand-row"><a className="dashboard-mobile-brand" href="/dashboard" aria-label="Mary Ann dashboard home"><img src="/mary-ann-logo.svg" alt="Mary Ann Elite Properties" /></a><button type="button" className="dashboard-menu-toggle" aria-label="Open navigation menu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}><span></span><span></span><span></span></button></div>
          <div className="dashboard-heading-group"><h1>{page === 'dashboard' ? 'Dashboard' : page === 'bookings' ? 'Bookings' : page === 'users' ? 'Users' : 'Plot lists'}</h1></div>
          <div className="topbar-actions profile-wrap">
            <button type="button" className="topbar-avatar profile-trigger" aria-label={role === 'admin' ? 'Open administrator menu' : 'Open user menu'} aria-expanded={profileOpen} onClick={() => setProfileOpen(open => !open)}><img className="topbar-avatar-image" src="/user-avatar.svg" alt="" /></button>
            {profileOpen && <div className="profile-menu" role="menu">
              <strong className="profile-role">{role === 'admin' ? 'Administrator' : role === 'employee' ? userName || 'Employee' : userName || 'User'}</strong>
              {role === 'admin' && <span className="profile-company">Mary Ann Elite Properties</span>}
              <span className="profile-session"><i />{role === 'admin' ? 'Connected to admin session' : role === 'employee' ? 'Employee session' : 'Approved user session'}</span>
              <button className="profile-signout" role="menuitem" onClick={() => { setProfileOpen(false); window.sessionStorage.removeItem('maep_admin_pin'); window.sessionStorage.removeItem('maep_user_mode'); window.sessionStorage.removeItem('maep_employee_token'); window.sessionStorage.removeItem('maep_employee_username'); setEmployeeToken(''); setLoggedIn(false); setPin(''); setUserName(''); setBookings([]); setPlots([]); setError(''); setNotice(''); setRole('admin'); }}>Sign out</button>
            </div>}
          </div>
        </header>

        <section className="dashboard-content">
          {page !== 'plots' && error && <div className="alert alert-error" role="alert">{error}</div>}
          {page !== 'plots' && notice && <div className="alert alert-success" role="status">{notice}</div>}

          {page !== 'plots' ? (
            <>
              {page === 'users' ? <EmployeeUsersPage pin={pin} employees={employees} setEmployees={setEmployees} employeeForm={employeeForm} setEmployeeForm={setEmployeeForm} employeeDelete={employeeDelete} setEmployeeDelete={setEmployeeDelete} setError={setError} setNotice={setNotice} /> : page === 'dashboard' ? (
                <>
                  <div className="dashboard-welcome"><div><span className="dashboard-kicker">MARY ANN ELITE PROPERTIES</span><h2>Property inventory overview</h2><p>Live unit availability and sales progress at a glance.</p></div><div className="inventory-total"><span>Total units</span><strong>{P.length}</strong><small>Across this layout</small></div></div>
                  <div className="kpi-grid">
                    <article className="kpi-card kpi-available"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12.5 9.2 17 20 6" /></svg></div><div className="kpi-content"><span className="kpi-label">Available Plot</span><strong>{plotCounts.Available || 0}</strong><small>Ready for enquiry</small></div></article>
                    <article className="kpi-card kpi-reserved"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5 14.6 8.8 20.5 9.6 16.2 13.7 17.2 19.5 12 16.7 6.8 19.5 7.8 13.7 3.5 9.6 9.4 8.8Z" /></svg></div><div className="kpi-content"><span className="kpi-label">Reserved Plot</span><strong>{plotCounts.Reserved || 0}</strong><small>Temporarily held</small></div></article>
                    <article className="kpi-card kpi-booked"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14l2.5 2.5L16 12" /></svg></div><div className="kpi-content"><span className="kpi-label">Booked Plot</span><strong>{plotCounts.Booked || 0}</strong><small>Booking in progress</small></div></article>
                    <article className="kpi-card kpi-sold"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12 12 4h7l1 7-8 9Z"/><circle cx="16" cy="8" r="1"/><path d="m8.5 13.5 2 2 4-4" /></svg></div><div className="kpi-content"><span className="kpi-label">Sold Plot</span><strong>{plotCounts.Sold || 0}</strong><small>Successfully sold</small></div></article>
                  </div>
                  <div className="inventory-progress"><div><span>Inventory movement</span><strong>{P.length ? Math.round(((plotCounts.Reserved + plotCounts.Booked + plotCounts.Sold) / P.length) * 100) : 0}% committed</strong></div><div className="inventory-track"><i style={{ width: (P.length ? Math.min(100, ((plotCounts.Reserved + plotCounts.Booked + plotCounts.Sold) / P.length) * 100) : 0) + '%' }} /></div></div>

                </>
              ) : null}
              {page !== 'users' && <div className={page === 'dashboard' ? "dashboard-recent-layout" : "dashboard-recent-layout dashboard-recent-layout-single"}>
                <div className="dashboard-recent-main">
              <div className="page-intro"><div><h2>{page === 'dashboard' ? 'Recent enquiries & bookings' : 'Bookings overview'}</h2><p>Review customer enquiries and manage unit availability.</p></div>{page !== 'dashboard' && <div className="record-count"><strong>{selectedProjectBookings.length}</strong><span>Total bookings</span></div>}</div>
              {page === 'bookings' && <div className="booking-project-tabs" role="tablist" aria-label="Filter bookings by project">
                {[['all', 'All'], ['velavan_nagar', 'Velavan Nagar'], ['saraswathi_garden', 'Saraswathi Garden'], ['shanmuga_avenue', 'Shanmuga Avenue']].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={projectTab === key} className={'booking-project-tab' + (projectTab === key ? ' active' : '')} onClick={() => setProjectTab(key)}>{label}</button>)}
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
                {loading ? <div className="table-state">Loading bookings from Supabase…</div> : (
                  <div className="table-scroll"><table className="data-table">
                    <thead><tr><th>ID</th>{projectTab === 'all' && <th>Project</th>}<th>Customer Name</th><th>Phone Number</th><th>Plot Id</th><th>Unit Number</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {visibleBookings.map(row => {
                        const plot = plotById.get(String(row.project_id) + ':' + String(row.plot_id)) || plotById.get(String(row.plot_id));
                        return <tr key={String(row.project_id) + ':' + row.id}>
                          <td className="id-cell">#{row.id}</td>
                          {projectTab === 'all' && <td><span className="unit-pill">{PROJECT_NAMES[row.project_id] || ('Project ' + row.project_id)}</span></td>}
                          <td><strong>{field(row, 'customer_name', 'name') || '—'}</strong></td>
                          <td>{field(row, 'phone', 'phone_number') || '—'}</td>
                          <td>{row.plot_id ?? '—'}</td>
                          <td><span className="unit-pill">{field(plot, 'plot_number', 'unit_number') || '—'}</span></td>
                          <td><select className={'status-select status-' + normalizedStatus(row.status).toLowerCase()} value={normalizedStatus(row.status)} onChange={e => saveBooking({
                            customer_name: field(row, 'customer_name', 'name'),
                            phone: field(row, 'phone', 'phone_number'),
                            plot_id: row.plot_id,
                            project_id: row.project_id,
                            status: e.target.value,
                          }, row.id, true)} disabled={saving} aria-label={'Status for booking ' + row.id}>
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select></td>
                          <td><div className="row-actions"><button className="edit-btn" onClick={() => { setError(''); setEdit({
                            id: row.id, customer_name: field(row, 'customer_name', 'name'), phone: field(row, 'phone', 'phone_number'),
                            plot_id: String(row.plot_id ?? ''), project_id: Number(row.project_id || 1), status: normalizedStatus(row.status),
                          }); }}>Edit</button><button className="delete-btn" onClick={() => setDeleteTarget(row)} disabled={saving}>Delete</button></div></td>
                        </tr>;
                      })}
                      {!visibleBookings.length && <tr><td colSpan={projectTab === 'all' ? 8 : 7} className="empty-cell">{selectedProjectBookings.length ? 'No bookings match your search.' : 'No bookings found in Supabase.'}</td></tr>}
                    </tbody>
                  </table></div>
                )}
                <div className="table-footer">Showing {visibleBookings.length} of {selectedProjectBookings.length} bookings</div>
              </section>
                </div>
                {page === 'dashboard' && (
                  <div className="inventory-mix-widget">
                    <div className="chart-heading inventory-mix-heading">
                      <div><span className="chart-eyebrow">INVENTORY MIX</span><h3>Plot availability</h3></div>
                    </div>
                    <article className="chart-panel chart-panel-donut">
                      <div className="donut-layout">
                        <div className="inventory-donut" style={{ background: P.length ? `conic-gradient(#18a779 0% ${plotCounts.Available / P.length * 100}%, #e8b34e ${plotCounts.Available / P.length * 100}% ${(plotCounts.Available + plotCounts.Reserved) / P.length * 100}%, #4e82d5 ${(plotCounts.Available + plotCounts.Reserved) / P.length * 100}% ${(plotCounts.Available + plotCounts.Reserved + plotCounts.Booked) / P.length * 100}%, #dd6572 ${(plotCounts.Available + plotCounts.Reserved + plotCounts.Booked) / P.length * 100}% 100%)` : 'conic-gradient(#e5eaf1 0% 100%)' }}>
                          <div className="donut-hole"><strong>{P.length}</strong><span>Total plots</span></div>
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
              <label className="project-filter-box">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={plotSearch} onChange={e => setPlotSearch(e.target.value)} placeholder="Search projects..." aria-label="Filter projects" />
                <span className="filter-caption">FILTER</span>
              </label>
              {projectsLoading ? (
                <div className="project-filter-empty"><strong>Loading projects…</strong></div>
              ) : projectsError ? (
                <div className="project-filter-empty" role="alert"><strong>Could not load projects</strong><p>{projectsError}</p><button type="button" className="edit-btn" onClick={() => window.location.reload()}>Retry</button></div>
              ) : projects.filter(project => [project.name, project.layout, project.location, project.description].join(' ').toLowerCase().includes(plotSearch.trim().toLowerCase())).length ? (
                <div className="project-cards">
                  {projects.filter(project => [project.name, project.layout, project.location, project.description].join(' ').toLowerCase().includes(plotSearch.trim().toLowerCase())).map(project => (
                    <a className="project-list-card" href={'/' + project.slug} key={project.id} aria-label={'Open ' + project.name + ' interactive plot map'}>
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
                          <div className="project-map-pending" role="img" aria-label="Saraswathi Garden map preview will be added from its layout PDF"><span className="project-visual-mark">MA</span><span className="project-visual-tag">LAYOUT MAP</span></div>
                        )}
                        <div className="project-preview-overlay" aria-hidden="true"><span className="project-visual-mark">MA</span><span className="project-visual-tag">INTERACTIVE PLOT MAP</span></div>
                      </div>
                      <div className="project-card-content">
                        <div className="project-card-heading"><div><span className="project-card-kicker">MARY ANN ELITE PROPERTIES</span><h2>{project.name}</h2></div><span className="project-card-arrow" aria-hidden="true">↗</span></div>
                        <p className="project-card-location"><span aria-hidden="true">⌖</span> {project.location}</p>
                        <p className="project-card-description">{project.description}</p>
                        <div className="project-card-footer"><span className="project-type"><span aria-hidden="true">▦</span> Interactive Plot Layout</span><span className="project-view-link">{project.mapReady ? 'View project' : 'Map coming soon'} <span aria-hidden="true">{project.mapReady ? '→' : '…'}</span></span></div>
                      </div>
                    </a>
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
          <label>Phone Number<input value={edit.phone} onChange={e => setEdit(s => ({ ...s, phone: e.target.value }))} required maxLength={25} /></label>
          <label>Unit Number<select value={edit.plot_id} onChange={e => {
            const selected = plots.find(plot => String(plot.id) === e.target.value);
            setEdit(s => ({ ...s, plot_id: e.target.value, status: normalizedStatus(selected?.status) === 'Reserved' ? 'Reserved' : s.status }));
          }} required>
            <option value="" disabled>Select a unit</option>
            {plots.filter(plot => {
              const plotStatus = normalizedStatus(plot.status);
              return (edit?.id != null && String(plot.id) === String(edit.plot_id)) || !['Booked', 'Sold'].includes(plotStatus);
            }).map(plot => <option key={plot.id} value={String(plot.id)}>{field(plot, 'plot_number', 'unit_number')} (Plot ID: {plot.id})</option>)}
          </select></label>
          <label>Status<select value={edit.status} onChange={e => setEdit(s => ({ ...s, status: e.target.value }))}>{STATUSES.filter(s => edit.id != null || ['Available', 'Reserved'].includes(s.value)).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          {error && <p className="dash-error">{error}</p>}
          <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setEdit(null)}>Cancel</button><button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : edit.id == null ? 'Add customer' : 'Save changes'}</button></div>
        </form>
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
