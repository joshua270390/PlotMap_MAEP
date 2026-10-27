import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlotMap from './PlotMap.jsx';
import AdminPanel from './AdminPanel.jsx';
import { EnquiryModal, UnitModal, PlotStatusModal } from './Modals.jsx';
import { P as V_P, G as V_G, LB as V_LB, DM as V_DM } from './data.js';
import { P as S_P, G as S_G, LB as S_LB, DM as S_DM, bounds as S_BOUNDS, plotAreaLabels as S_PLOT_AREA_LABELS, roadLabels as S_ROAD_LABELS, dimensionLabels as S_DIMENSION_LABELS } from './saraswathiGeometry.js';
import { toStatus } from './plots.js';
import { addDm, loadAd, makeApi, saveAd } from './adminData.js';

const GEOMETRIES = {
  velavan_nagar: { key: 'velavan_nagar', P: V_P, G: V_G, LB: V_LB, DM: V_DM, bounds: { x: 369, y: 160, width: 2501, height: 3012 }, canvasWidth: 4400, canvasHeight: 3400, projectName: 'Velavan Nagar', layoutName: 'Kurayur layout' },
  saraswathi_garden: { key: 'saraswathi_garden', P: S_P, G: S_G, LB: S_LB, DM: S_DM, bounds: S_BOUNDS, plotAreaLabels: S_PLOT_AREA_LABELS, roadLabels: S_ROAD_LABELS, dimensionLabels: S_DIMENSION_LABELS, canvasWidth: 1760, canvasHeight: 2580, projectName: 'Saraswathi Gardens', layoutName: 'Saraswathi Gardens layout' },
};

export default function App({ projectSlug = 'velavan_nagar' }) {
  const geometry = GEOMETRIES[projectSlug] || GEOMETRIES.velavan_nagar;
  const P = geometry.P;
  const [status, setStatus] = useState({});          // a=Available, r=Reserved, b=Booked, s=Sold (from Supabase)
  const [plotDetails, setPlotDetails] = useState({});
  const [filt, setFilt] = useState(null);
  const [sel, setSel] = useState(null);              // selected plot (highlight / admin editor)
  const [selD, setSelD] = useState(null);            // selected dimension label (admin)
  const [unit, setUnit] = useState(null);
  const [closedPlot, setClosedPlot] = useState(null);
  const [form, setForm] = useState(false);
  const [ad, setAd] = useState(() => loadAd(geometry));              // admin edits, saved in this browser
  const [adminEnquiries, setAdminEnquiries] = useState([]);
  const [userMode, setUserMode] = useState(false);
  const [checkingUserSession, setCheckingUserSession] = useState(() => window.sessionStorage.getItem('maep_user_mode') === 'true');
  const [panel, setPanel] = useState('off');         // 'off' | 'lock' | 'tools'
  const [adminPin, setAdminPin] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const mapRef = useRef(null);
  const ax = useMemo(() => makeApi(ad, geometry), [ad, geometry]);
  const admin = panel === 'tools';

  useEffect(() => {
    // Public User login is stored by the dashboard as maep_user_mode.
    // Treat it as a read-only map session and never show Admin Studio controls.
    if (window.sessionStorage.getItem('maep_user_mode') === 'true') {
      setUserMode(true);
      setCheckingUserSession(false);
      return;
    }
    setCheckingUserSession(false);
  }, []);

  useEffect(() => { saveAd(ad, geometry); }, [ad, geometry]);
  useEffect(() => {
    // The existing plot-status endpoint is currently configured for Velavan Nagar.
    // Do not leak those statuses into a different project's plot numbers.
    if (geometry.key !== 'velavan_nagar') {
      try { setStatus(JSON.parse(window.localStorage.getItem('saraswathi-gardens-plot-status-v1') || '{}')); } catch { setStatus({}); }
      setPlotDetails({});
      return;
    }
    fetch('/api/plots').then(r => r.json()).then(j => {
      if (!j.ok) return;
      const m = {};
      P.forEach(([id]) => { const v = j.plots[String(id)]; if (v) m[id] = toStatus(v); });
      setStatus(m);
      setPlotDetails(j.details || {});
    }).catch(() => {});   // no API (plain `vite` dev): every plot shows as Available
  }, []);

  const loadAdminEnquiries = useCallback(async adminPin => {
    if (geometry.key !== 'velavan_nagar') { setAdminEnquiries([]); return; }
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
  }, [geometry]);

  // Restore the Admin Studio session when an Admin opens the map from the dashboard.
  useEffect(() => {
    if (window.sessionStorage.getItem('maep_user_mode') === 'true') return;
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
      <PlotMap ref={mapRef} geometry={geometry} projectName={geometry.projectName} layoutName={geometry.layoutName} ax={ax} status={status} details={plotDetails} filt={filt} setFilt={setFilt} sel={sel} selD={selD} setSel={setSel}
        onTap={onTap} admin={admin} addMode={addMode} adminEnquiries={adminEnquiries}>
        {!userMode && !checkingUserSession && <AdminPanel geometry={geometry} panel={panel} setPanel={setPanel} ax={ax} setAd={setAd} sel={sel} selD={selD} status={status} setStatus={setStatus} initialAdminPin={adminPin}
          addMode={addMode} setAddMode={setAddMode} clearSel={clearSel} onAdminAuth={handleAdminAuth} onAdminExit={() => setAdminEnquiries([])} />}
      </PlotMap>
      {closedPlot != null && <PlotStatusModal id={closedPlot.id} status={closedPlot.status} ax={ax}
        customer={plotDetails[ax.lbl(closedPlot.id)] || plotDetails[String(closedPlot.id)] || {}}
        onClose={() => setClosedPlot(null)} />}
      {unit != null && !form && (
        <UnitModal id={unit} ax={ax} status={status[unit]} setAd={setAd} admin={adminAuthenticated} onClose={closeUnit} onEnquire={geometry.key === 'velavan_nagar' ? () => setForm(true) : undefined}
          reservedCustomers={plotDetails[ax.lbl(unit)]?.reservedCustomers || plotDetails[String(unit)]?.reservedCustomers || []}
          onViewMap={() => { const id = unit; setUnit(null); setSel(id); mapRef.current.focusOn(id); }} />
      )}
      {form && unit != null && <EnquiryModal id={unit} ax={ax} onClose={() => setForm(false)} />}
    </>
  );
}
