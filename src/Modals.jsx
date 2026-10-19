import { useEffect, useRef, useState } from 'react';
import { COMPANY, PHONE, PROJECT } from './config.js';
import { NAMES, inr } from './plots.js';

const backdrop = onClose => ({ onPointerDown: e => { if (e.target === e.currentTarget) onClose(); } });

export function UnitModal({ id, ax, status, setAd, onClose, onEnquire, onViewMap, reservedCustomers = [] }) {
  const a = ax.areaOf(id), lb = ax.lbl(id), sv = status || 'a', closeRef = useRef(null);
  const details = ax.ad.plotDetails?.[id] || {};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ phone: details.phone ?? PHONE, whatsapp: details.whatsapp ?? PHONE, area: String(a) });
  const [editError, setEditError] = useState('');
  useEffect(() => { closeRef.current && closeRef.current.focus(); }, []);
  useEffect(() => {
    const d = ax.ad.plotDetails?.[id] || {};
    setDraft({ phone: d.phone ?? PHONE, whatsapp: d.whatsapp ?? PHONE, area: String(ax.areaOf(id)) });
    setEditing(false); setEditError('');
  }, [id]);
  const phoneDigits = String(details.phone ?? PHONE).replace(/\D/g, '');
  const waDigits = String(details.whatsapp ?? PHONE).replace(/\D/g, '').replace(/^0+/, '').replace(/^91(?=\d{10}$)/, '');
  const draftArea = Number(draft.area);
  const saveDetails = () => {
    if (!(draftArea > 0) || !Number.isFinite(draftArea)) { setEditError('Enter a valid Sq.ft. value.'); return; }
    const phone = draft.phone.trim(), whatsapp = draft.whatsapp.trim();
    if (!phone || !whatsapp) { setEditError('Enter both contact and WhatsApp numbers.'); return; }
    setAd(old => ({
      ...old,
      area: { ...(old.area || {}), [id]: draftArea },
      plotDetails: { ...(old.plotDetails || {}), [id]: { phone, whatsapp } },
    }));
    setEditing(false); setEditError('');
  };
  return (
    <div className="mo" role="dialog" aria-modal="true" aria-labelledby="u_no_l" {...backdrop(onClose)}>
      <div className="mb">
        <button className="mx" ref={closeRef} type="button" aria-label="Close" onClick={onClose}>&times;</button>
        <div className="mh">
          <small>{COMPANY}</small><h2>{PROJECT}</h2>
          <div className="cts">
            <a href={'tel:+' + phoneDigits}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
              <span>{details.phone ?? PHONE}</span>
            </a>
            <a className="wa" target="_blank" rel="noopener" href={'https://wa.me/' + waDigits + '?text=' + encodeURIComponent('Hi, I am interested in Unit : ' + lb + ' of ' + PROJECT)}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7s1.8 2.8 4.4 3.9c1.6.7 2.3.7 3.1.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.5-.3z" /></svg>
              WhatsApp
            </a>
          </div>
        </div>
        <div className="mc">
          <div className="ul"><small id="u_no_l">UNIT NUMBER</small><b>{lb}</b></div>
          <div className={'sb ' + sv}>
            <h3><i /><span>{NAMES[sv]}</span></h3>
            {sv === 'a' || sv === 'r'
              ? <div><button className="mbtn" type="button" onClick={onEnquire}>Booking enquiry</button></div>
              : <p>{sv === 'b' ? 'This plot is currently booked.' : 'This plot has been sold.'}</p>}
          </div>
          {sv === 'r' && Array.isArray(reservedCustomers) && reservedCustomers.length > 0 && (
            <section className="reserved-customer-list" aria-label="Customers who reserved this unit">
              <h3>Already reserved by</h3>
              <ul>{reservedCustomers.map((customer, index) => (
                <li key={String(customer.name) + '-' + index}>
                  <span>{customer.name}</span>{customer.mobile && <small>{customer.mobile}</small>}
                </li>
              ))}</ul>
              <p>This unit is still open for enquiries until it is Booked or Sold.</p>
            </section>
          )}
          <div className="ub"><div className="uc">
            <div className="chips"><span className="u">Unit: {lb}</span><span className={sv}>Status: {NAMES[sv]}</span></div>
            <div className="ar"><b>{a} Sq.ft.</b> <span>&middot; {(a / 435.6).toFixed(2)} cents</span></div>
            {ax.rate > 0 && <><hr /><div className="pr"><i>Actual Price</i><b>{inr(a * ax.rate)}</b></div></>}
          </div></div>
          {editing ? (
            <div className="unit-edit-form">
              <label>Contact number<input type="tel" inputMode="tel" value={draft.phone} onChange={e => setDraft(v => ({ ...v, phone: e.target.value }))} /></label>
              <label>WhatsApp number<input type="tel" inputMode="tel" value={draft.whatsapp} onChange={e => setDraft(v => ({ ...v, whatsapp: e.target.value }))} /></label>
              <label>Area (Sq.ft.)<input type="number" min="1" step="any" value={draft.area} onChange={e => setDraft(v => ({ ...v, area: e.target.value }))} /></label>
              <p className="unit-edit-cent">= {draftArea > 0 && Number.isFinite(draftArea) ? (draftArea / 435.6).toFixed(2) : '0.00'} cent</p>
              {editError && <p className="unit-edit-error" role="alert">{editError}</p>}
              <div className="unit-edit-actions"><button className="mbtn" type="button" onClick={saveDetails}>Save changes</button><button className="unit-edit-cancel" type="button" onClick={() => { setEditing(false); setEditError(''); }}>Cancel</button></div>
            </div>
          ) : (
            <button className="unit-edit-trigger" type="button" onClick={() => { setDraft({ phone: details.phone ?? PHONE, whatsapp: details.whatsapp ?? PHONE, area: String(a) }); setEditing(true); }}>Edit unit details</button>
          )}
          <button className="mv" type="button" onClick={onViewMap}>&#128205; View on Map</button>
        </div>
      </div>
    </div>
  );
}


export function PlotStatusModal({ id, status, ax, customer = {}, onClose }) {
  const lb = ax.lbl(id);
  const sold = status === 's';
  const heading = sold ? 'Sold' : 'Booked';
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    addEventListener('keydown', onKeyDown);
    return () => removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return (
    <div className="mo plot-status-overlay" role="dialog" aria-modal="true" aria-labelledby="plot-status-title" {...backdrop(onClose)}>
      <div className="mb plot-status-modal">
        <button className="mx" ref={closeRef} type="button" aria-label="Close" onClick={onClose}>&times;</button>
        <div className="plot-status-modal-content">
          <span className={'plot-status-badge ' + (sold ? 'sold' : 'booked')}>{heading}</span>
          <h2 id="plot-status-title">This plot is {heading} by:</h2>
          <div className="plot-status-info">
            <div><span>Name:</span><strong>{customer?.name || '—'}</strong></div>
            <div><span>Mobile No:</span><strong>{customer?.mobile || '—'}</strong></div>
          </div>
          <p className="plot-status-unit">Unit: {lb}</p>
          <button className="plot-status-close" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const OK_MSG = [403, 404, 409, 422, 429];

export function EnquiryModal({ id, ax, onClose }) {
  const lb = ax.lbl(id);
  const [f, setF] = useState({ n: '', e: '', p: '', m: `Greetings, I am interested in Unit : ${lb} of ${PROJECT}`, hp: '' });
  const [err, setErr] = useState(''), [bad, setBad] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));

  async function send() {
    const n = f.n.trim(), e = f.e.trim(), p = f.p.trim(), digits = p.replace(/\D/g, '');
    const fail = (k, m) => { setBad(k); setErr(m); };
    if (!n) return fail('n', 'Please enter your name.');
    if (digits.length < 10 || digits.length > 13) return fail('p', 'Please enter a valid mobile number.');
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return fail('e', 'Please enter a valid email or leave it empty.');
    setErr(''); setBad(''); setBusy(true);
    try {
      const r = await fetch('/api/enquiry', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, email: e, phone: p, message: f.m.trim(), plot_number: lb, website: f.hp }),
      });
      let j = {}; try { j = await r.json(); } catch (_) {}
      if (!r.ok || !j.ok) { const x = new Error(j.error || 'HTTP ' + r.status); x.status = r.status; throw x; }
      setDone(true);
    } catch (x) {
      console.error('Enquiry failed', x);
      setErr(OK_MSG.includes(x.status) ? x.message : `Could not send your enquiry. Please try again or call ${PHONE}.`);
      setBusy(false);
    }
  }
  const enter = e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); if (!busy) send(); } };

  return (
    <div className="mo" role="dialog" aria-modal="true" aria-labelledby="f_t" {...backdrop(onClose)}>
      <div className="mb">
        <button className="mx" type="button" aria-label="Close enquiry form" onClick={onClose}>&times;</button>
        {!done ? (
          <div>
            <div className="fh"><h2 id="f_t">Booking enquiry form</h2><p>Unit No : {lb} | {PROJECT}</p></div>
            <div className="fb" onKeyDown={enter}>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.hp} onChange={set('hp')}
                style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
              <label>Name<input autoFocus type="text" autoComplete="name" maxLength={80} className={bad === 'n' ? 'bad' : ''} value={f.n} onChange={set('n')} /></label>
              <label>Email <em>(optional)</em><input type="email" autoComplete="email" maxLength={120} className={bad === 'e' ? 'bad' : ''} value={f.e} onChange={set('e')} /></label>
              <label>Mobile number<input type="tel" inputMode="tel" autoComplete="tel" maxLength={20} className={bad === 'p' ? 'bad' : ''} value={f.p} onChange={set('p')} /></label>
              <label>Message<textarea maxLength={500} value={f.m} onChange={set('m')} /></label>
              <p className="fe" role="alert">{err}</p>
              <button className="sub-btn" type="button" disabled={busy} onClick={send}><span>{busy ? 'Submitting\u2026' : 'Submit'}</span> &rarr;</button>
            </div>
          </div>
        ) : (
          <div className="ok">
            <div className="tick">&#10003;</div><h3>Enquiry sent</h3>
            <p>Thank you! Our team will contact you shortly about this plot.</p>
            <button className="mbtn" type="button" autoFocus onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
