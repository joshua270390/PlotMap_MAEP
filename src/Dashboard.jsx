import { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';
import { P, G } from './data.js';

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
  const [page, setPage] = useState(() => { const path = window.location.pathname.replace(/\/+$/, ''); return path === '/plot_lists' ? 'plots' : path === '/bookings' ? 'bookings' : 'dashboard'; });
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
  const [profileOpen, setProfileOpen] = useState(false);

  // Restore the admin session after a refresh in the same browser tab.
  useEffect(() => {
    const savedPin = window.sessionStorage.getItem('maep_admin_pin');
    if (!savedPin) return;
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
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      window.sessionStorage.setItem('maep_admin_pin', pin);
      setLoggedIn(true); setNotice('Welcome to the admin dashboard.');
      await loadData('bookings', pin);
    } catch (e) { setError(e.message || 'Could not sign in.'); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    // The Plot lists page is intentionally a static design for now.
    // Only the Bookings page loads live records from the API.
    if (loggedIn && page !== 'plots') loadData('bookings', pin);
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
      if (statusOnly) {
        setBookings(current => current.map(row => String(row.id) === String(rowId)
          ? { ...row, ...(data.booking || values), status: (data.booking || values).status || values.status }
          : row));
        if (data.plotStatusSynced) {
          setPlots(current => current.map(plot => String(plot.id) === String(values.plot_id)
            ? { ...plot, status: values.status }
            : plot));
        }
      } else {
        setEdit(null);
        await loadData('bookings', pin);
      }
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

  const plotCounts = useMemo(() => {
    const counts = { Available: 0, Reserved: 0, Booked: 0, Sold: 0 };
    plots.forEach(plot => { const value = normalizedStatus(plot.status); counts[value] = (counts[value] || 0) + 1; });
    return counts;
  }, [plots]);

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
          <img className="login-logo" src="/mary-ann-logo.svg" alt="Mary Ann Elite Properties" />
          <p className="eyebrow">ADMINISTRATOR ACCESS</p>
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
          <img className="dashboard-brand-logo" src="/mary-ann-sidebar-white-logo.svg" alt="Mary Ann Elite Properties" />
        </a>
        <button className={'nav-item' + (page === 'dashboard' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/dashboard'); setPage('dashboard'); }}><span className="nav-icon">▦</span> Dashboard</button>
        <button className={'nav-item' + (page === 'bookings' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/bookings'); setPage('bookings'); }}>
          <span className="nav-icon">▤</span> Bookings
        </button>
        <button className={'nav-item' + (page === 'plots' ? ' active' : '')} onClick={() => { window.history.pushState({}, '', '/plot_lists'); setPage('plots'); }}>
          <span className="nav-icon">▦</span> Plot lists
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div><h1>{page === 'dashboard' ? 'Dashboard' : page === 'bookings' ? 'Bookings' : 'Plot lists'}</h1></div>
          <div className="topbar-actions profile-wrap">
            <button type="button" className="topbar-avatar profile-trigger" aria-label="Open administrator menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(open => !open)}>MA</button>
            {profileOpen && <div className="profile-menu" role="menu">
              <strong className="profile-role">Administrator</strong>
              <span className="profile-company">Mary Ann Elite Properties</span>
              <span className="profile-session"><i />Connected to admin session</span>
              <button className="profile-signout" role="menuitem" onClick={() => { setProfileOpen(false); window.sessionStorage.removeItem('maep_admin_pin'); setLoggedIn(false); setPin(''); setBookings([]); setPlots([]); setError(''); setNotice(''); }}>Sign out</button>
            </div>}
          </div>
        </header>

        <section className="dashboard-content">
          {page !== 'plots' && error && <div className="alert alert-error" role="alert">{error}</div>}
          {page !== 'plots' && notice && <div className="alert alert-success" role="status">{notice}</div>}

          {page !== 'plots' ? (
            <>
              {page === 'dashboard' ? (
                <>
                  <div className="dashboard-welcome"><div><span className="dashboard-kicker">MARY ANN ELITE PROPERTIES</span><h2>Property inventory overview</h2><p>Live unit availability and sales progress at a glance.</p></div><div className="inventory-total"><span>Total units</span><strong>{plots.length}</strong><small>Across this layout</small></div></div>
                  <div className="kpi-grid">
                    <article className="kpi-card kpi-available"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12.5 9.2 17 20 6" /></svg></div><div className="kpi-content"><span className="kpi-label">Available Plot</span><strong>{plotCounts.Available || 0}</strong><small>Ready for enquiry</small></div></article>
                    <article className="kpi-card kpi-reserved"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5 14.6 8.8 20.5 9.6 16.2 13.7 17.2 19.5 12 16.7 6.8 19.5 7.8 13.7 3.5 9.6 9.4 8.8Z" /></svg></div><div className="kpi-content"><span className="kpi-label">Reserved Plot</span><strong>{plotCounts.Reserved || 0}</strong><small>Temporarily held</small></div></article>
                    <article className="kpi-card kpi-booked"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14l2.5 2.5L16 12" /></svg></div><div className="kpi-content"><span className="kpi-label">Booked Plot</span><strong>{plotCounts.Booked || 0}</strong><small>Booking in progress</small></div></article>
                    <article className="kpi-card kpi-sold"><div className="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12 12 4h7l1 7-8 9Z"/><circle cx="16" cy="8" r="1"/><path d="m8.5 13.5 2 2 4-4" /></svg></div><div className="kpi-content"><span className="kpi-label">Sold Plot</span><strong>{plotCounts.Sold || 0}</strong><small>Successfully sold</small></div></article>
                  </div>
                  <div className="inventory-progress"><div><span>Inventory movement</span><strong>{plots.length ? Math.round(((plotCounts.Reserved + plotCounts.Booked + plotCounts.Sold) / plots.length) * 100) : 0}% committed</strong></div><div className="inventory-track"><i style={{ width: (plots.length ? Math.min(100, ((plotCounts.Reserved + plotCounts.Booked + plotCounts.Sold) / plots.length) * 100) : 0) + '%' }} /></div></div>
                  <section className="dashboard-chart-grid" aria-label="Inventory charts">
                    <article className="chart-panel chart-panel-donut">
                      <div className="chart-heading"><div><span className="chart-eyebrow">INVENTORY MIX</span><h3>Plot availability</h3></div><span className="chart-menu-mark">•••</span></div>
                      <div className="donut-layout">
                        <div className="inventory-donut" style={{ background: plots.length ? `conic-gradient(#18a779 0% ${plotCounts.Available / plots.length * 100}%, #e8b34e ${plotCounts.Available / plots.length * 100}% ${(plotCounts.Available + plotCounts.Reserved) / plots.length * 100}%, #4e82d5 ${(plotCounts.Available + plotCounts.Reserved) / plots.length * 100}% ${(plotCounts.Available + plotCounts.Reserved + plotCounts.Booked) / plots.length * 100}%, #dd6572 ${(plotCounts.Available + plotCounts.Reserved + plotCounts.Booked) / plots.length * 100}% 100%)` : 'conic-gradient(#e5eaf1 0% 100%)' }}>
                          <div className="donut-hole"><strong>{plots.length}</strong><span>Total plots</span></div>
                        </div>
                        <div className="chart-legend">
                          <div><i className="legend-available" /><span>Available</span><strong>{plotCounts.Available}</strong></div>
                          <div><i className="legend-reserved" /><span>Reserved</span><strong>{plotCounts.Reserved}</strong></div>
                          <div><i className="legend-booked" /><span>Booked</span><strong>{plotCounts.Booked}</strong></div>
                          <div><i className="legend-sold" /><span>Sold</span><strong>{plotCounts.Sold}</strong></div>
                        </div>
                      </div>
                    </article>
                    <article className="chart-panel chart-panel-bars">
                      <div className="chart-heading"><div><span className="chart-eyebrow">PROPERTY PERFORMANCE</span><h3>Inventory status</h3></div><span className="chart-period">Live</span></div>
                      <div className="inventory-bars">
                        {[
                          { label: 'Available', value: plotCounts.Available, tone: 'bar-available' },
                          { label: 'Reserved', value: plotCounts.Reserved, tone: 'bar-reserved' },
                          { label: 'Booked', value: plotCounts.Booked, tone: 'bar-booked' },
                          { label: 'Sold', value: plotCounts.Sold, tone: 'bar-sold' },
                        ].map(item => <div className="inventory-bar-row" key={item.label}><div className="bar-label"><span>{item.label}</span><strong>{item.value}</strong></div><div className="bar-track"><i className={item.tone} style={{ width: (plots.length ? item.value / Math.max(...Object.values(plotCounts), 1) * 100 : 0) + '%' }} /></div></div>)}
                      </div>
                      <div className="chart-footnote"><span className="chart-live-dot" /> Updated from current plot records</div>
                    </article>
                  </section>
                </>
              ) : null}
              <div className="page-intro"><div><h2>{page === 'dashboard' ? 'Recent enquiries & bookings' : 'Bookings overview'}</h2><p>Review customer enquiries and manage unit availability.</p></div><div className="record-count"><strong>{bookings.length}</strong><span>Total bookings</span></div></div>
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
                  <a className="project-list-card" href="/velavan_nagar" aria-label="Open Velavan Nagar interactive plot map">
                    <div className="project-card-visual" aria-label="Static preview of the Velavan Nagar interactive plot map">
                      <svg className="project-map-static" viewBox="0 0 4400 3400" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Static thumbnail of the Velavan Nagar plot layout">
                        <rect width="4400" height="3400" fill="#e8e4dc" />
                        <g fill="#363e4c">
                          {G.base.map((d, i) => <path key={'road-' + i} d={d} />)}
                        </g>
                        <g fill="#cdd3c3">
                          {G.park.map((d, i) => <path key={'park-' + i} d={d} />)}
                        </g>
                        <g fill="#ded6c6">
                          {G.misc.map((d, i) => <path key={'misc-' + i} d={d} />)}
                        </g>
                        <g fill="none" stroke="#e9e4d6" strokeWidth="6" strokeDasharray="34 26">
                          {G.dash.map((d, i) => <path key={'road-mark-' + i} d={d} />)}
                        </g>
                        <g stroke="#aab0ba" strokeWidth="8" strokeLinejoin="round">
                          {P.map(([id, x, y, points, area, pm]) => <polygon key={id} points={points} fill={pm ? '#dcdfe5' : '#ffffff'} />)}
                        </g>
                        <g fill="#1b2433" stroke="#ffffff" strokeWidth="10" paintOrder="stroke" fontSize="44" fontWeight="700" textAnchor="middle" dominantBaseline="central">
                          {P.map(([id, x, y]) => <text key={'number-' + id} x={x} y={y}>{id}</text>)}
                        </g>
                      </svg>
                      <div className="project-preview-overlay" aria-hidden="true"><span className="project-visual-mark">MA</span><span className="project-visual-tag">INTERACTIVE PLOT MAP</span></div>
                    </div>
                    <div className="project-card-content">
                      <div className="project-card-heading"><div><span className="project-card-kicker">MARY ANN ELITE PROPERTIES</span><h2>Velavan Nagar</h2></div><span className="project-card-arrow" aria-hidden="true">↗</span></div>
                      <p className="project-card-location"><span aria-hidden="true">⌖</span> Madurai, Tamil Nadu</p>
                      <p className="project-card-description">Open the Velavan Nagar interactive plot layout and view plot details.</p>
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
