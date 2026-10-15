import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlotMap from './PlotMap.jsx';
import AdminPanel from './AdminPanel.jsx';
import { EnquiryModal, UnitModal } from './Modals.jsx';
import { P } from './data.js';
import { toStatus } from './plots.js';
import { addDm, loadAd, makeApi, saveAd } from './adminData.js';

export default function App() {
  const [status, setStatus] = useState({});          // plot id -> 'a' | 'b' | 's' (from Supabase)
  const [filt, setFilt] = useState(null);
  const [sel, setSel] = useState(null);              // selected plot (highlight / admin editor)
  const [selD, setSelD] = useState(null);            // selected dimension label (admin)
  const [unit, setUnit] = useState(null);
  const [form, setForm] = useState(false);
  const [ad, setAd] = useState(loadAd);              // admin edits, saved in this browser
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
    if (id == null) setSel(null); else { setSel(id); setUnit(id); }
  };

  return (
    <>
      <PlotMap ref={mapRef} ax={ax} status={status} filt={filt} setFilt={setFilt} sel={sel} selD={selD} setSel={setSel}
        onTap={onTap} admin={admin} addMode={addMode}>
        <AdminPanel panel={panel} setPanel={setPanel} ax={ax} setAd={setAd} sel={sel} selD={selD}
          addMode={addMode} setAddMode={setAddMode} clearSel={clearSel} />
      </PlotMap>
      {unit != null && (
        <UnitModal id={unit} ax={ax} status={status[unit]} onClose={closeUnit} onEnquire={() => setForm(true)}
          onViewMap={() => { const id = unit; setUnit(null); setSel(id); mapRef.current.focusOn(id); }} />
      )}
      {form && unit != null && <EnquiryModal id={unit} ax={ax} onClose={() => setForm(false)} />}
    </>
  );
}
