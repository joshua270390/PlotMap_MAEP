import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlotMap from './PlotMap.jsx';
import AdminPanel from './AdminPanel.jsx';
import { EnquiryModal, UnitModal, PlotStatusModal } from './Modals.jsx';
import { P } from './data.js';
import { toStatus } from './plots.js';
import { addDm, loadAd, makeApi, saveAd } from './adminData.js';

export default function App() {
  const [status, setStatus] = useState({});          // a=Available, r=Reserved, b=Booked, s=Sold (from Supabase)
  const [plotDetails, setPlotDetails] = useState({});
  const [filt, setFilt] = useState(null);
  const [sel, setSel] = useState(null);              // selected plot (highlight / admin editor)
  const [selD, setSelD] = useState(null);            // selected dimension label (admin)
  const [unit, setUnit] = useState(null);
  const [closedPlot, setClosedPlot] = useState(null);
  const [form, setForm] = useState(false);
  const [ad, setAd] = useState(loadAd);              // admin edits, saved in this browser
  const [adminEnquiries, setAdminEnquiries] = useState([]);
  const [userMode, setUserMode] = useState(false);
  const [checkingUserSession, setCheckingUserSession] = useState(() => Boolean(window.sessionStorage.getItem('maep_user_token')));
  const [panel, setPanel] = useState('off');         // 'off' | 'lock' | 'tools'
  const [adminPin, setAdminPin] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const mapRef = useRef(null);
  const ax = useMemo(() => makeApi(ad), [ad]);
  const admin = panel === 'tools';

  useEffect(() => {
    const token = window.sessionStorage.getItem('maep_user_token');
    if (!token) { setCheckingUserSession(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/user-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-session': token },
          body: JSON.stringify({ action: 'verify' }),
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          window.sessionStorage.removeItem('maep_user_token');
          window.location.replace('/dashboard');
          return;
        }
        setUserMode(true);
      } catch {
        if (!cancelled) {
          window.sessionStorage.removeItem('maep_user_token');
          window.location.replace('/dashboard');
        }
      } finally {
        if (!cancelled) setCheckingUserSession(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { saveAd(ad); }, [ad]);
  useEffect(() => {
    fetch('/api/plots').then(r => r.json()).then(j => {
      if (!j.ok) return;
      const m = {};
      P.forEach(([id]) => { const v = j.plots[String(id)]; if (v) m[id] = toStatus(v); });
      setStatus(m);
      setPlotDetails(j.details || {});
    }).catch(() => {});   // no API (plain `vite` dev): every plot shows as Available
  }, []);

  const loadAdminEnquiries = useCallback(async adminPin => {
    try {
      const response = await fetch('/api/admin-data?view=bookings', { headers: { 'x-admin-pin': adminPin }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load customer enquiries.');
      const numberById = new Map((data.plots || []).map(plot => [String(plot.id), String(plot.plot_number ?? '')]));
      const grouped = new Map();
      (data.bookings || []).forEach(booking => {
        const plotNumber = numberById.get(String(booking.plot_id));
        const customerName = String(booking.customer_name || '').trim();
        if (!plotNumber || !customerName) return;
        if (!grouped.has(plotNumber)) grouped.set(plotNumber, new Set());
        grouped.get(plotNumber).add(customerName);
      });
      setAdminEnquiries([...grouped].map(([plotNumber, names]) => ({ plotNumber, names: [...names] })));
    } catch (error) {
      console.error('[admin-map] Could not load enquiry pins:', error);
      setAdminEnquiries([]);
    }
  }, []);

  // Restore the Admin Studio session when an Admin opens the map from the dashboard.
  useEffect(() => {
    if (window.sessionStorage.getItem('maep_user_token')) return;
    const savedPin = window.sessionStorage.getItem('maep_admin_pin');
    if (!savedPin) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin-auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: savedPin }), cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && data.ok) {
          setAdminPin(savedPin);
          setAdminAuthenticated(true);
          loadAdminEnquiries(savedPin);
        } else {
          window.sessionStorage.removeItem('maep_admin_pin');
          setAdminPin('');
          setAdminAuthenticated(false);
        }
      } catch {
        // Keep the saved PIN for a temporary network failure; do not unlock without verification.
      }
    })();
    return () => { cancelled = true; };
  }, [loadAdminEnquiries]);

  const handleAdminAuth = useCallback(adminPinValue => {
    window.sessionStorage.setItem('maep_admin_pin', adminPinValue);
    setAdminPin(adminPinValue);
    setAdminAuthenticated(true);
    loadAdminEnquiries(adminPinValue);
  }, [loadAdminEnquiries]);

  const clearSel = useCallback(() => { setSel(null); setSelD(null); setAddMode(false); }, []);
  const closeUnit = useCallback(() => { setUnit(null); setSel(null); }, []);
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return;
      if (form) setForm(false); else if (unit != null) closeUnit(); else if (closedPlot != null) setClosedPlot(null);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [form, unit, closedPlot, closeUnit]);

  const onTap = ({ id, dm, x, y }) => {
    if (admin) {
      if (addMode) { const [n, k] = addDm(ad, x, y); setAd(n); setAddMode(false); setSel(null); setSelD(k); }
      else if (dm) { setSel(null); setSelD(dm); }
      else if (id != null) { setSelD(null); setSel(id); }
      else clearSel();
      return;
    }
    if (id == null) { setSel(null); return; }
    const plotStatus = status[id] || 'a';
    if (plotStatus === 'b' || plotStatus === 's') {
      setForm(false);
      setUnit(null);
      setSel(null);
      setClosedPlot({ id, status: plotStatus });
      return;
    }
    setClosedPlot(null);
    setSel(id);
    setUnit(id);
    setForm(false);
  };

  return (
    <>
      <PlotMap ref={mapRef} ax={ax} status={status} details={plotDetails} filt={filt} setFilt={setFilt} sel={sel} selD={selD} setSel={setSel}
        onTap={onTap} admin={admin} addMode={addMode} adminEnquiries={adminEnquiries}>
        {!userMode && !checkingUserSession && <AdminPanel panel={panel} setPanel={setPanel} ax={ax} setAd={setAd} sel={sel} selD={selD} status={status} setStatus={setStatus} initialAdminPin={adminPin}
          addMode={addMode} setAddMode={setAddMode} clearSel={clearSel} onAdminAuth={handleAdminAuth} onAdminExit={() => setAdminEnquiries([])} />}
      </PlotMap>
      {closedPlot != null && <PlotStatusModal id={closedPlot.id} status={closedPlot.status} ax={ax}
        customer={plotDetails[ax.lbl(closedPlot.id)] || plotDetails[String(closedPlot.id)] || {}}
        onClose={() => setClosedPlot(null)} />}
      {unit != null && !form && (
        <UnitModal id={unit} ax={ax} status={status[unit]} setAd={setAd} admin={adminAuthenticated} onClose={closeUnit} onEnquire={() => setForm(true)}
          reservedCustomers={plotDetails[ax.lbl(unit)]?.reservedCustomers || plotDetails[String(unit)]?.reservedCustomers || []}
          onViewMap={() => { const id = unit; setUnit(null); setSel(id); mapRef.current.focusOn(id); }} />
      )}
      {form && unit != null && <EnquiryModal id={unit} ax={ax} onClose={() => setForm(false)} />}
    </>
  );
}
