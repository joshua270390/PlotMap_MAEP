import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AD0, delDm, revertPlot, setDm, setPlot } from './adminData.js';
import { AREAS, POS, cents } from './plots.js';

const num = v => parseFloat(v);

function PlotEditor({ id, ax, setAd }) {
  const p = ax.posOf(id);
  const [f, setF] = useState({ n: ax.lbl(id), a: String(ax.areaOf(id)), x: String(p[0]), y: String(p[1]) });
  const [m, setM] = useState(null);
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const a = num(f.a), [c, rem] = cents(a > 0 ? a : 0);
  const say = (t, ok) => setM({ t, ok });
  const save = () => {
    const nv = f.n.trim(), av = num(f.a), xv = num(f.x), yv = num(f.y);
    if (!nv) return say('Plot number cannot be empty.');
    const o = ax.findId(nv); if (o != null && o !== id) return say('Number ' + nv + ' is already used by another plot.');
    if (!(av > 0)) return say('Enter a valid area.');
    if (isNaN(xv) || isNaN(yv)) return say('Enter valid X and Y values.');
    setAd(ad => setPlot(ad, id, { nv, av, xv, yv })); say('Saved.', true);
  };
  const revert = () => {
    setAd(ad => revertPlot(ad, id));
    const q = POS[id]; setF({ n: String(id), a: String(AREAS[id]), x: String(q[0]), y: String(q[1]) }); say('Reverted number, area and position to original.', true);
  };
  return (
    <>
      <div className="eh"><span className="badge">{ax.lbl(id)}</span><div><b className="et">Plot {ax.lbl(id)}</b><small>{a > 0 ? `${a} sq.ft. \u00b7 ${c} cent ${rem} sqft approx.` : 'Enter an area'}</small></div></div>
      <div className="grid2">
        <label><span>Plot number</span><input type="text" inputMode="numeric" autoComplete="off" value={f.n} onChange={set('n')} /></label>
        <label><span>Area (sq.ft.)</span><input type="number" min="1" step="any" value={f.a} onChange={set('a')} /></label>
      </div>
      <div className="sec">Number position on map</div>
      <div className="grid2">
        <label><span>X axis</span><input type="number" step="any" value={f.x} onChange={set('x')} /></label>
        <label><span>Y axis</span><input type="number" step="any" value={f.y} onChange={set('y')} /></label>
      </div>
      <div className="arow"><button className="pri" type="button" onClick={save}>Save</button><button type="button" onClick={revert}>Revert</button></div>
      <p className={'hint' + (m ? (m.ok ? ' ok' : ' err') : '')}>{m && m.t}</p>
    </>
  );
}

function StatusEditor({ id, ax, status, setStatus, pin, setAd }) {
  const [value, setValue] = useState(({ a: 'Available', r: 'Reserved', b: 'Booked', s: 'Sold' })[status[id] || 'a']);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reservedCustomers, setReservedCustomers] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const currentColor = ax.ad.colors?.[id] || '#c7dfc7';

  useEffect(() => {
    let cancelled = false;
    async function loadReservedCustomers() {
      if (!pin) return;
      setCustomersLoading(true);
      try {
        const response = await fetch('/api/admin-data?view=bookings', {
          headers: { 'x-admin-pin': pin }, cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load Reserved customers.');
        const plot = (data.plots || []).find(item => String(item.plot_number ?? item.unit_number ?? item.id) === String(ax.lbl(id)));
        const rows = (data.bookings || []).filter(row => String(row.plot_id) === String(plot?.id) && String(row.status).toLowerCase() === 'reserved');
        if (!cancelled) {
          setReservedCustomers(rows);
          setSelectedBookingId('');
        }
      } catch (error) {
        if (!cancelled) setM({ t: error.message || 'Could not load Reserved customers.' });
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    }
    loadReservedCustomers();
    return () => { cancelled = true; };
  }, [id, pin, ax]);
  const presets = ['#c7dfc7', '#9fd7c2', '#a9c9f2', '#f6d58b', '#f4b6b6', '#d6c2f0', '#f2c6a0', '#d5dde6'];
  const save = async () => {
    setBusy(true); setM(null);
    try {
      if (['Booked', 'Sold'].includes(value) && !selectedBookingId) {
        setM({ t: 'Select a customer from the Reserved list before setting Booked or Sold.' });
        setBusy(false);
        return;
      }
      const response = await fetch('/api/plot-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ plot_number: ax.lbl(id), status: value, booking_id: selectedBookingId || undefined }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not update plot status.');
      const code = ({ Available: 'a', Reserved: 'r', Booked: 'b', Sold: 's' })[value];
      setStatus(old => ({ ...old, [id]: code }));
      setM({ t: 'Status saved to Supabase.', ok: true });
    } catch (e) {
      setM({ t: e.message || 'Could not update plot status.' });
    } finally { setBusy(false); }
  };
  const chooseColor = color => setAd(ad => ({ ...ad, colors: { ...(ad.colors || {}), [id]: color } }));
  return (
    <>
      <div className="sec">Availability status</div>
      <label><span>Plot status</span>
        <select value={value} onChange={e => { setValue(e.target.value); setM(null); setSelectedBookingId(''); }}>
          <option value="Available">Availability</option><option value="Reserved">Reserved</option><option value="Booked">Booked</option><option value="Sold">Sold</option>
        </select>
      </label>
      {['Booked', 'Sold'].includes(value) && <label><span>Reserved customer to {value.toLowerCase()}</span>
        <select value={selectedBookingId} onChange={e => setSelectedBookingId(e.target.value)} disabled={customersLoading || !reservedCustomers.length} required>
          <option value="">{customersLoading ? 'Loading Reserved customers…' : 'Select a Reserved customer'}</option>
          {reservedCustomers.map(row => <option key={row.id} value={String(row.id)}>{row.customer_name || row.name || 'Customer'} · {row.phone || row.phone_number || 'No phone'} (Booking #{row.id})</option>)}
        </select>
        {!customersLoading && !reservedCustomers.length && <p className="hint">No Reserved customer exists for this unit. Add the customer with Reserved status first.</p>}
      </label>}
      <div className="arow"><button className="pri" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save status'}</button></div>
      <div className="sec plot-color-heading">Unit plot color</div>
      <div className="plot-color-palette" role="group" aria-label="Choose unit plot color">
        {presets.map(color => <button key={color} type="button" className={'plot-color-swatch' + (currentColor.toLowerCase() === color ? ' selected' : '')} style={{ backgroundColor: color }} aria-label={'Set plot color ' + color} aria-pressed={currentColor.toLowerCase() === color} onClick={() => chooseColor(color)} />)}
        <label className="plot-custom-color"><span>Custom</span><input type="color" value={currentColor} onChange={e => chooseColor(e.target.value)} aria-label="Choose custom plot color" /></label>
        <button type="button" className="plot-color-reset" onClick={() => setAd(ad => { const colors = { ...(ad.colors || {}) }; delete colors[id]; return { ...ad, colors }; })}>Default</button>
      </div>
      <p className="hint">Color changes apply immediately and are saved in this browser.</p>
      <p className={'hint' + (m ? (m.ok ? ' ok' : ' err') : '')}>{m && m.t}</p>
    </>
  );
}

function DmEditor({ k, ax, setAd, onGone }) {
  const d = ax.dmList().find(x => x.k === k);
  const [f, setF] = useState({ t: d.t, x: String(d.x), y: String(d.y), r: String(d.r) });
  const [m, setM] = useState(null);
  const set = key => e => setF(s => ({ ...s, [key]: e.target.value }));
  const save = () => {
    const x = num(f.x), y = num(f.y), r = num(f.r), t = f.t.trim();
    if (!t || isNaN(x) || isNaN(y) || isNaN(r)) return setM({ t: 'Fill text, X, Y and rotation.' });
    setAd(ad => setDm(ad, k, { t, x, y, r })); setM({ t: 'Saved.', ok: true });
  };
  return (
    <>
      <div className="eh"><span className="badge">&harr;</span><div><b>Dimension label</b><small>Road or plot width marker</small></div></div>
      <label><span>Text</span><input type="text" autoComplete="off" value={f.t} onChange={set('t')} /></label>
      <div className="grid2">
        <label><span>X axis</span><input type="number" step="any" value={f.x} onChange={set('x')} /></label>
        <label><span>Y axis</span><input type="number" step="any" value={f.y} onChange={set('y')} /></label>
      </div>
      <label><span>Rotation (degrees)</span><input type="number" step="any" value={f.r} onChange={set('r')} /></label>
      <div className="arow"><button className="pri" type="button" onClick={save}>Save</button><button className="dng" type="button" onClick={() => { setAd(ad => delDm(ad, k)); onGone(); }}>Delete</button></div>
      <p className={'hint' + (m ? (m.ok ? ' ok' : ' err') : '')}>{m && m.t}</p>
    </>
  );
}

export default function AdminPanel({ panel, setPanel, ax, setAd, sel, selD, addMode, setAddMode, clearSel, status, setStatus, onAdminAuth, onAdminExit }) {
  const [pin, setPin] = useState(''), [authPin, setAuthPin] = useState(''), [pm, setPm] = useState(''), [note, setNote] = useState(null), [rst, setRst] = useState(false), [authBusy, setAuthBusy] = useState(false);
  const [rate, setRate] = useState(ax.ad.rate || '');
  const [isClosing, setIsClosing] = useState(false);
  const [mobileCompact, setMobileCompact] = useState(true);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ customer_name: '', phone: '', plot_id: '', status: 'Available' });
  const [customerPlots, setCustomerPlots] = useState([]);
  const [customerBusy, setCustomerBusy] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [customerNotice, setCustomerNotice] = useState('');
  const file = useRef(null), rt = useRef(0);

  if (panel === 'off') return <button id="admbtn" className="fl" type="button" onClick={() => setPanel('lock')}>Admin</button>;

  const unlock = async () => {
    if (authBusy || !pin) return;
    setAuthBusy(true); setPm('');
    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Wrong PIN.');
      setAuthPin(pin); setPin(''); setPanel('tools'); if (onAdminAuth) onAdminAuth(pin);
    } catch (error) {
      setPm(error.message || 'Admin authentication failed.');
    } finally { setAuthBusy(false); }
  };
  const exit = () => {
    if (isClosing) return;
    setIsClosing(true);
    setPin(''); setAuthPin(''); setPm(''); setNote(null); clearSel();
    if (onAdminExit) onAdminExit();
    window.setTimeout(() => { setPanel('off'); setIsClosing(false); }, 280);
  };
  const exportEdits = () => {
    const b = new Blob([JSON.stringify({ admin: ax.ad, status: {} }, null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'velavan-plot-edits.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };
  const importEdits = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result); if (!o || typeof o !== 'object' || !o.admin) throw 0;
        const n = Object.assign(AD0(), o.admin); setAd(n); setRate(n.rate || ''); clearSel(); setNote({ t: 'Imported.', ok: true });
      } catch (_) { setNote({ t: 'That file is not a valid edits file.' }); }
    };
    rd.readAsText(f);
  };
  const reset = () => {
    if (!rst) { setRst(true); rt.current = setTimeout(() => setRst(false), 3000); return; }
    clearTimeout(rt.current); setRst(false); setAd(AD0()); setRate(''); clearSel(); setNote({ t: 'All edits cleared.', ok: true });
  };

  const openAddCustomer = async () => {
    setCustomerOpen(true); setCustomerError(''); setCustomerNotice('');
    setCustomerForm({ customer_name: '', phone: '', plot_id: '', status: 'Available' });
    setCustomerLoading(true);
    try {
      const response = await fetch('/api/admin-data?view=bookings', { headers: { 'x-admin-pin': authPin }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load plot units.');
      setCustomerPlots(data.plots || []);
      if (data.warning) setCustomerError(data.warning);
      else if (!(data.plots || []).length) setCustomerError('No plot units were returned by the database for this project. Check PROJECT_ID and the plots table project_id values in Netlify environment variables.');
    } catch (error) {
      setCustomerError(error.name === 'TimeoutError' ? 'Loading units timed out. Please close the form and try again.' : (error.message || 'Could not load plot units.'));
    } finally { setCustomerLoading(false); }
  };

  const saveCustomer = async event => {
    event.preventDefault();
    if (customerBusy) return;
    setCustomerBusy(true); setCustomerError(''); setCustomerNotice('');
    try {
      const response = await fetch('/api/admin-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': authPin },
        body: JSON.stringify(customerForm),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not add customer.');
      const selectedPlot = customerPlots.find(plot => String(plot.id) === String(customerForm.plot_id));
      const plotMapId = selectedPlot ? ax.findId(String(selectedPlot.plot_number ?? selectedPlot.unit_number ?? '')) : null;
      const statusCode = ({ Available: 'a', Reserved: 'r', Booked: 'b', Sold: 's' })[customerForm.status] || 'a';
      if (plotMapId != null) setStatus(previous => ({ ...previous, [plotMapId]: statusCode }));
      setCustomerOpen(false);
      setNote({ t: data.warning || 'Customer added successfully. The record is saved to Supabase and will appear in the Bookings table.', ok: true });
    } catch (error) {
      setCustomerError(error.name === 'TimeoutError' ? 'Saving timed out. Please check the Bookings page before retrying to avoid a duplicate.' : (error.message || 'Could not add customer.'));
    } finally { setCustomerBusy(false); }
  };

  const handleOverlayMouseDown = event => {
    if (event.target === event.currentTarget) setCustomerOpen(false);
  };

  return (
    <>
    <div id="adm" className={"apn fl" + (isClosing ? " is-closing" : "") + (panel === "tools" ? (mobileCompact ? " mobile-compact" : " mobile-expanded") : "")}>
      <div className="ah">
        <div className="at">
          <span className="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z" /><path d="m9 12 2 2 4-4" /></svg></span>
          <div><b>Admin studio</b><small>Plots, labels and rates</small></div>
        </div>
        <div className="admin-header-actions">
          {panel === "tools" && <button className="admin-compact-toggle" type="button" onClick={() => setMobileCompact(value => !value)} aria-expanded={!mobileCompact} aria-label={mobileCompact ? "Expand Admin Studio editor" : "Collapse Admin Studio editor"}>{mobileCompact ? "Expand editor ＋" : "Collapse −"}</button>}
          <button className="ghost" type="button" onClick={exit}>Exit</button>
        </div>
      </div>
      <div className="abody">
        {panel === 'lock' ? (
          <div className="lockc">
            <div className="lk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></div>
            <p className="lt2">Enter your PIN to edit the plot map</p>
            <label><span>Admin PIN</span><input autoFocus type="password" inputMode="text" autoComplete="current-password" placeholder="Enter admin PIN" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && unlock()} /></label>
            <div className="arow"><button className="pri" type="button" disabled={authBusy} onClick={unlock}>{authBusy ? 'Checking…' : 'Unlock'}</button></div>
            <p className="hint" style={{ color: 'var(--sd)' }}>{pm}</p>
          </div>
        ) : (
          <div>
            <div className="sec">Selected</div>
            <div className="card">
              {addMode ? <p className="hint">Click on the map where the new dimension label should go.</p>
                : sel != null ? <><PlotEditor key={sel} id={sel} ax={ax} setAd={setAd} /><StatusEditor key={'status-' + sel} id={sel} ax={ax} status={status} setStatus={setStatus} pin={authPin} setAd={setAd} /></>
                : selD && ax.dmList().some(d => d.k === selD) ? <DmEditor key={selD} k={selD} ax={ax} setAd={setAd} onGone={clearSel} />
                : <p className="hint">Click a plot or a dimension label on the map to edit it.</p>}
            </div>
            <div className="sec">Customers & bookings</div>
            <div className="card">
              <button className="tool admin-add-customer" type="button" onClick={openAddCustomer}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="10" /></svg>
                Add Customer
              </button>
              <p className="hint">Add a customer here; the saved booking is shared with the Bookings page.</p>
            </div>
            <div className="sec">Map tools</div>
            <div className="card">
              <button className="tool" type="button" aria-pressed={addMode} onClick={() => { clearSel(); setAddMode(!addMode); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add dimension label
              </button>
              <label style={{ margin: 0 }}><span>Rate (&#8377; per sq.ft.)</span>
                <div className="pre"><em>&#8377;</em><input type="number" min="0" step="any" placeholder="0" value={rate} onChange={e => setRate(e.target.value)}
                  onBlur={() => setAd(ad => ({ ...ad, rate: Math.max(0, num(rate) || 0) }))} /></div>
              </label>
            </div>
            <div className="sec">Map colours</div>
            <div className="card map-colour-card">
              <label className="map-colour-field"><span>Road colour</span><input type="color" value={ax.ad.mapColors?.road || '#363e4c'} onChange={e => setAd(ad => ({ ...ad, mapColors: { ...(ad.mapColors || {}), road: e.target.value } }))} aria-label="Change road colour" /></label>
              <label className="map-colour-field"><span>Empty soil land colour</span><input type="color" value={ax.ad.mapColors?.soil || '#cf9560'} onChange={e => setAd(ad => ({ ...ad, mapColors: { ...(ad.mapColors || {}), soil: e.target.value } }))} aria-label="Change empty soil land colour" /></label>
              <button type="button" className="plot-color-reset" onClick={() => setAd(ad => { const mapColors = { ...(ad.mapColors || {}) }; delete mapColors.road; delete mapColors.soil; return { ...ad, mapColors }; })}>Reset map colours</button>
              <p className="hint">Changes apply immediately and are saved in this browser on desktop, tablet and mobile.</p>
            </div>
            <div className="sec">Backup</div>
            <div className="arow"><button type="button" onClick={exportEdits}>Export</button><button type="button" onClick={() => file.current.click()}>Import</button></div>
            <button className="dng wide" type="button" onClick={reset}>{rst ? 'Tap again to confirm' : 'Reset edits'}</button>
            <input type="file" ref={file} accept="application/json,.json" hidden onChange={importEdits} />
            <p className={'hint' + (note ? (note.ok ? ' ok' : '') : '')} style={note && !note.ok ? { color: 'var(--sd)' } : undefined}>
              {note ? note.t : 'Edits are saved in this browser only. Use Export to keep a backup or to move them to another device.'}
            </p>
          </div>
        )}
      </div>
    </div>
    {customerOpen && createPortal(<div className="admin-customer-overlay" role="presentation" onMouseDown={handleOverlayMouseDown}>
      <form className="admin-customer-modal" onSubmit={saveCustomer}>
        <button type="button" className="admin-customer-close" onClick={() => setCustomerOpen(false)} aria-label="Close">×</button>
        <p className="admin-customer-eyebrow">MANUAL CUSTOMER ENTRY</p>
        <h2>Add Customer</h2>
        <p className="admin-customer-copy">Enter the customer details. After saving, the booking will be available in the Bookings page.</p>
        <label>Customer Name<input value={customerForm.customer_name} onChange={event => setCustomerForm(old => ({ ...old, customer_name: event.target.value }))} required maxLength={120} autoFocus /></label>
        <label>Phone Number<input type="tel" value={customerForm.phone} onChange={event => setCustomerForm(old => ({ ...old, phone: event.target.value }))} required maxLength={25} /></label>
        <label>Unit Number<select value={customerForm.plot_id} onChange={event => setCustomerForm(old => ({ ...old, plot_id: event.target.value }))} required disabled={customerLoading || customerBusy || !customerPlots.length}>
          <option value="" disabled>{customerLoading ? 'Loading units…' : 'Select a unit'}</option>
          {customerPlots.map(plot => <option key={plot.id} value={String(plot.id)}>{String(plot.plot_number ?? plot.unit_number ?? plot.id)} (Plot ID: {plot.id})</option>)}
        </select></label>
        <label>Status<select value={customerForm.status} onChange={event => setCustomerForm(old => ({ ...old, status: event.target.value }))}>
          <option value="Available">Availability</option><option value="Reserved">Reserved</option><option value="Booked">Booked</option><option value="Sold">Sold</option>
        </select></label>
        {customerError && <p className="admin-customer-error" role="alert">{customerError}</p>}
        <div className="admin-customer-actions"><button type="button" className="admin-customer-cancel" onClick={() => setCustomerOpen(false)}>Cancel</button><button type="submit" className="admin-customer-submit" disabled={customerBusy || customerLoading || !customerPlots.length}>{customerBusy ? 'Saving…' : customerLoading ? 'Loading units…' : 'Add Customer'}</button></div>
      </form>
    </div>, document.body)}
    </>
  );
}
