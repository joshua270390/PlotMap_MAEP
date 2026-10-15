import { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';

const STATUSES = [
  { value: 'Available', label: 'Availability' },
  { value: 'Reserved', label: 'Reserved' },
  { value: 'Booked', label: 'Booked' },
  { value: 'Sold', label: 'Sold' },
];
const normalizedStatus = value => STATUSES.some(item => item.value === value) ? value : 'Available';
const statusLabel = value => STATUSES.find(item => item.value === normalizedStatus(value))?.label || 'Availability';
const field = (row, ...keys) => {
  for (const key of keys) if (row?.[key] != null) return String(row[key]);
  return '';
};

export default function Dashboard() {
  useEffect(() => {
    document.body.classList.add('dashboard-mode');
    return () => document.body.classList.remove('dashboard-mode');
  }, []);
  const [pin, setPin] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState(() => window.location.pathname === '/plot_lists' ? 'plots' : 'bookings');
  const [bookings, setBookings] = useState([]);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [plotSearch, setPlotSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const plotById = useMemo(() => new Map(plots.map(plot => [String(plot.id), plot])), [plots]);

  async function loadData(view = page, currentPin = pin) {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin-data?view=' + encodeURIComponent(view), {
        headers: { 'x-admin-pin': currentPin },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load dashboard data.');
      if (view === 'bookings') {
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
      const response = await fetch('/api/admin-auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Admin login failed.');
      setLoggedIn(true); setNotice('Welcome to the admin dashboard.');
      await loadData('bookings', pin);
    } catch (e) { setError(e.message || 'Could not sign in.'); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    // The Plot lists page is intentionally a static design for now.
    // Only the Bookings page loads live records from the API.
    if (loggedIn && page === 'bookings') loadData('bookings', pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, loggedIn]);

  async function saveBooking(values, rowId, statusOnly = false) {
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin-data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ id: rowId, ...values }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save booking.');
      if (data.warning) setNotice(data.warning);
      else setNotice(statusOnly ? 'Status updated.' : 'Booking updated successfully.');
      setEdit(null);
      await loadData('bookings', pin);
    } catch (e) { setError(e.message || 'Could not save booking.'); }
    finally { setSaving(false); }
  }

  async function deleteBooking(row) {
    const name = field(row, 'customer_name', 'name') || 'this booking';
    if (!window.confirm('Delete ' + name + '? This cannot be undone.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin-data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ id: row.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not delete booking.');
      setNotice('Booking deleted.');
      await loadData('bookings', pin);
    } catch (e) { setError(e.message || 'Could not delete booking.'); }
    finally { setSaving(false); }
  }

  const visibleBookings = useMemo(() => bookings.filter(row => {
    const plot = plotById.get(String(row.plot_id));
    const unit = field(plot, 'plot_number', 'unit_number');
    const text = [row.id, row.customer_name, row.phone, row.plot_id, unit].map(v => String(v ?? '')).join(' ').toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase().trim());
    const matchesStatus = statusFilter === 'All' || normalizedStatus(row.status) === statusFilter;
    return matchesSearch && matchesStatus;
  }), [bookings, plotById, search, statusFilter]);

  if (!loggedIn) {
    return (
      <main className="dash-login">
        <form className="login-card" onSubmit={e => { e.preventDefault(); login(); }}>
          <div className="login-mark">MA</div>
          <p className="eyebrow">MARY ANN ELITE PROPERTIES</p>
          <h1>Admin Dashboard</h1>
          <p className="login-copy">Sign in to manage bookings and plot availability.</p>
          <label htmlFor="admin-pin">Admin PIN</label>
          <input id="admin-pin" type="password" inputMode="text" autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter your Admin PIN" required />
          {error && <p className="dash-error" role="alert">{error}</p>}
          <button className="primary-btn login-submit" disabled={saving}>{saving ? 'Checking…' : 'Sign in'} <span>→</span></button>
        </form>
      </main>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <a className="dashboard-brand" href="/dashboard" aria-label="Mary Ann dashboard home">
          <span className="dashboard-brand-icon">MA</span>
          <span><strong>Mary Ann</strong><small>Elite Properties</small></span>
        </a>
        <p className="sidebar-label">MANAGEMENT</p>
        <button className={'nav-item' + (page === 'bookings' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/bookings'); setPage('bookings'); }}>
          <span className="nav-icon">▤</span> Bookings
        </button>
        <button className={'nav-item' + (page === 'plots' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/plot_lists'); setPage('plots'); }}>
          <span className="nav-icon">▦</span> Plot lists
        </button>
        <div className="sidebar-bottom">
          <span className="online-dot" /> Connected to admin session
          <button className="signout-btn" onClick={() => { setLoggedIn(false); setPin(''); setBookings([]); setPlots([]); setError(''); setNotice(''); }}>Sign out</button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div><p className="eyebrow">PROPERTY MANAGEMENT</p><h1>{page === 'bookings' ? 'Bookings' : 'Plot lists'}</h1></div>
          <div className="topbar-actions">
            <span className="topbar-avatar">MA</span>
            <div className="admin-label"><strong>Administrator</strong><small>Mary Ann Elite Properties</small></div>
            <button className="refresh-btn" onClick={() => page === 'bookings' ? loadData('bookings', pin) : setPlotSearch('')} disabled={loading} title="Refresh data">↻</button>
          </div>
        </header>

        <section className="dashboard-content">
          {page === 'bookings' && error && <div className="alert alert-error" role="alert">{error}</div>}
          {page === 'bookings' && notice && <div className="alert alert-success" role="status">{notice}</div>}

          {page === 'bookings' ? (
            <>
              <div className="page-intro"><div><h2>Bookings overview</h2><p>Review customer enquiries and manage unit availability.</p></div><div className="record-count"><strong>{bookings.length}</strong><span>Total bookings</span></div></div>
              <section className="table-card">
                <div className="table-toolbar">
                  <label className="search-field"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, phone or unit…" /></label>
                  <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">
                    <option value="All">All statuses</option>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {loading ? <div className="table-state">Loading bookings from Supabase…</div> : (
                  <div className="table-scroll"><table className="data-table">
                    <thead><tr><th>ID</th><th>Customer Name</th><th>Phone Number</th><th>Plot Id</th><th>Unit Number</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {visibleBookings.map(row => {
                        const plot = plotById.get(String(row.plot_id));
                        return <tr key={row.id}>
                          <td className="id-cell">#{row.id}</td>
                          <td><strong>{field(row, 'customer_name', 'name') || '—'}</strong></td>
                          <td>{field(row, 'phone', 'phone_number') || '—'}</td>
                          <td>{row.plot_id ?? '—'}</td>
                          <td><span className="unit-pill">{field(plot, 'plot_number', 'unit_number') || '—'}</span></td>
                          <td><select className={'status-select status-' + normalizedStatus(row.status).toLowerCase()} value={normalizedStatus(row.status)} onChange={e => saveBooking({
                            customer_name: field(row, 'customer_name', 'name'),
                            phone: field(row, 'phone', 'phone_number'),
                            plot_id: row.plot_id,
                            status: e.target.value,
                          }, row.id, true)} disabled={saving} aria-label={'Status for booking ' + row.id}>
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select></td>
                          <td><div className="row-actions"><button className="edit-btn" onClick={() => setEdit({
                            id: row.id, customer_name: field(row, 'customer_name', 'name'), phone: field(row, 'phone', 'phone_number'),
                            plot_id: String(row.plot_id ?? ''), status: normalizedStatus(row.status),
                          })}>Edit</button><button className="delete-btn" onClick={() => deleteBooking(row)} disabled={saving}>Delete</button></div></td>
                        </tr>;
                      })}
                      {!visibleBookings.length && <tr><td colSpan="7" className="empty-cell">{bookings.length ? 'No bookings match your search.' : 'No bookings found in Supabase.'}</td></tr>}
                    </tbody>
                  </table></div>
                )}
                <div className="table-footer">Showing {visibleBookings.length} of {bookings.length} bookings</div>
              </section>
            </>
          ) : (
            <section className="project-list-view" aria-label="Project list">
              <label className="project-filter-box">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={plotSearch} onChange={e => setPlotSearch(e.target.value)} placeholder="Search projects..." aria-label="Filter projects" />
                <span className="filter-caption">FILTER</span>
              </label>
              {(!plotSearch.trim() || 'mary ann elite properties madurai tamil nadu interactive plot layout'.includes(plotSearch.trim().toLowerCase())) ? (
                <div className="project-cards">
                  <a className="project-list-card" href="https://plot-map-maep-xipa.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="Open Mary Ann Elite Properties interactive plot map">
                    <div className="project-card-visual" aria-label="Preview of the interactive plot map">
                      <iframe className="project-map-preview" src="/" title="Mary Ann Elite Properties plot map preview" loading="lazy" tabIndex="-1" aria-hidden="true" />
                      <div className="project-preview-overlay" aria-hidden="true"><span className="project-visual-mark">MA</span><span className="project-visual-tag">INTERACTIVE PLOT MAP</span></div>
                    </div>
                    <div className="project-card-content">
                      <div className="project-card-heading"><div><span className="project-card-kicker">MARY ANN ELITE PROPERTIES</span><h2>Mary Ann Elite Properties</h2></div><span className="project-card-arrow" aria-hidden="true">↗</span></div>
                      <p className="project-card-location"><span aria-hidden="true">⌖</span> Madurai, Tamil Nadu</p>
                      <p className="project-card-description">Explore the interactive plot layout and view plot details.</p>
                      <div className="project-card-footer"><span className="project-type"><span aria-hidden="true">▦</span> Interactive Plot Layout</span><span className="project-view-link">View project <span aria-hidden="true">→</span></span></div>
                    </div>
                  </a>
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
          <p className="eyebrow">BOOKING #{edit.id}</p><h2>Edit booking</h2><p className="modal-copy">Update customer details, unit and availability status.</p>
          <label>Customer Name<input value={edit.customer_name} onChange={e => setEdit(s => ({ ...s, customer_name: e.target.value }))} required maxLength={120} /></label>
          <label>Phone Number<input value={edit.phone} onChange={e => setEdit(s => ({ ...s, phone: e.target.value }))} required maxLength={25} /></label>
          <label>Unit Number<select value={edit.plot_id} onChange={e => setEdit(s => ({ ...s, plot_id: e.target.value }))} required>
            {plots.map(plot => <option key={plot.id} value={String(plot.id)}>{field(plot, 'plot_number', 'unit_number')} (Plot ID: {plot.id})</option>)}
          </select></label>
          <label>Status<select value={edit.status} onChange={e => setEdit(s => ({ ...s, status: e.target.value }))}>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          {error && <p className="dash-error">{error}</p>}
          <div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setEdit(null)}>Cancel</button><button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>}
    </div>
  );
}
