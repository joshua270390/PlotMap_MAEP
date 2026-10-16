import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlotMap from './PlotMap.jsx';
import AdminPanel from './AdminPanel.jsx';
import { EnquiryModal, UnitModal } from './Modals.jsx';
import { P } from './data.js';
import { toStatus } from './plots.js';
import { addDm, loadAd, makeApi, saveAd } from './adminData.js';

export default function App() {
  const [status, setStatus] = useState({});          // a=Available, r=Reserved, b=Booked, s=Sold (from Supabase)
  const [filt, setFilt] = useState(null);
  const [sel, setSel] = useState(null);              // selected plot (highlight / admin editor)
  const [selD, setSelD] = useState(null);            // selected dimension label (admin)
  const [unit, setUnit] = useState(null);
  const [form, setForm] = useState(false);
  const [ad, setAd] = useState(loadAd);              // admin edits, saved in this browser
  const [adminEnquiries, setAdminEnquiries] = useState([]);
  const [panel, setPanel] = useState('off');         // 'off' | 'lock' | 'tools'
  const [addMode, setAddMode] = useState(false);
  const mapRef = useRef(null);
  const ax = useMemo(() => makeApi(ad), [ad]);
  const admin = panel === 'tools';

  useEffect(() => { saveAd(ad); }, [ad]);
  useEffect(() => {
    fetch('/api/plots').then(r => r.json()).then(j => {
      if (!j.ok) return;
      const m = {};
      P.forEach(([id]) => { const v = j.plots[String(id)]; if (v) m[id] = toStatus(v); });
      setStatus(m);
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

  const clearSel = useCallback(() => { setSel(null); setSelD(null); setAddMode(false); }, []);
  const closeUnit = useCallback(() => { setUnit(null); setSel(null); }, []);
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return;
      if (form) setForm(false); else if (unit != null) closeUnit();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [form, unit, closeUnit]);

  const onTap = ({ id, dm, x, y }) => {
    if (admin) {
      if (addMode) { const [n, k] = addDm(ad, x, y); setAd(n); setAddMode(false); setSel(null); setSelD(k); }
      else if (dm) { setSel(null); setSelD(dm); }
      else if (id != null) { setSelD(null); setSel(id); }
      else clearSel();
      return;
    }
    if (id == null) { setSel(null); return; }
    setSel(id);
    const plotStatus = status[id] || 'a';
    setUnit(id);
    setForm(false);
  };

  return (
    <>
      <PlotMap ref={mapRef} ax={ax} status={status} filt={filt} setFilt={setFilt} sel={sel} selD={selD} setSel={setSel}
        onTap={onTap} admin={admin} addMode={addMode} adminEnquiries={adminEnquiries}>
        <AdminPanel panel={panel} setPanel={setPanel} ax={ax} setAd={setAd} sel={sel} selD={selD} status={status} setStatus={setStatus}
          addMode={addMode} setAddMode={setAddMode} clearSel={clearSel} onAdminAuth={loadAdminEnquiries} onAdminExit={() => setAdminEnquiries([])} />
      </PlotMap>
      {unit != null && !form && (
        <UnitModal id={unit} ax={ax} status={status[unit]} onClose={closeUnit} onEnquire={() => setForm(true)}
          onViewMap={() => { const id = unit; setUnit(null); setSel(id); mapRef.current.focusOn(id); }} />
      )}
      {form && unit != null && <EnquiryModal id={unit} ax={ax} onClose={() => { setForm(false); setUnit(null); setSel(null); }} />}
    </>
  );
}
