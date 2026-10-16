import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { P, G, LB } from './data.js';
import { COMPANY, LAYOUT, PROJECT } from './config.js';
import { NAMES, PM, cents, inr } from './plots.js';

const TREE = `<symbol id="tr1" viewBox="0 0 100 120"><ellipse cx="50" cy="111" rx="30" ry="7" fill="rgba(0,0,0,.24)"/><path class="tk" d="M44 112 L47 66 L53 66 L56 112Z"/><path class="tk" d="M50 88 L36 72 L40 70 L50 80Z"/><circle class="g1" cx="50" cy="46" r="34"/><circle class="g1" cx="25" cy="62" r="22"/><circle class="g1" cx="75" cy="62" r="22"/><circle class="g2" cx="48" cy="42" r="28"/><circle class="g2" cx="28" cy="57" r="16"/><circle class="g2" cx="72" cy="57" r="16"/><circle class="g3" cx="40" cy="32" r="13"/><circle class="g3" cx="63" cy="44" r="9"/><circle class="g3" cx="25" cy="52" r="7"/></symbol>`;

// Static drawing: never re-renders.
const Ground = memo(() => (
  <>
    {G.base.map((d, i) => <path key={'b' + i} d={d} className="rd" />)}
    {G.park.map((d, i) => <path key={'p' + i} d={d} className="pk" />)}
    {G.misc.map((d, i) => <path key={'m' + i} d={d} className="ms" />)}
    {G.dash.map((d, i) => <path key={'d' + i} d={d} className="dash" />)}
  </>
));
const Trees = memo(() => {
  const uses = useMemo(() => [...G.trees].sort((a, b) => a[1] - b[1]).map(([x, y, r], i) => {
    const h = Math.abs(Math.round(x * 3 + y * 5)) % 5, w = r * 2.9 * (0.94 + h * 0.03), hh = w * 1.2;
    return <use key={i} href="#tr1" x={x - w / 2} y={y - hh * 0.62} width={w} height={hh} />;
  }), []);
  return <><defs dangerouslySetInnerHTML={{ __html: TREE }} /><g className="trees">{uses}</g></>;
});
const Dims = memo(() => LB.map(([s, x, y, r], i) => (
  <text key={i} className="r" transform={`translate(${x} ${y}) rotate(${r}) translate(0 -17)`}>{s}</text>
)));

const Measures = memo(({ ax, selD }) => ax.dmList().map(d => (
  <text key={d.k} data-dm={d.k} className={'dm' + (selD === d.k ? ' dsel' : '')} transform={`translate(${d.x} ${d.y}) rotate(${d.r})`}>{d.t}</text>
)));

const Plots = memo(({ status, filt, sel, ax, colors = {} }) => (
  <>
    {P.map(([id, , , pt]) => {
      const v = status[id] || 'a';
      return (
        <path key={id} data-id={id} d={'M' + pt.replace(/ /g, 'L') + 'Z'}
          className={'p ' + v + (sel === id ? ' sel' : '')} style={colors[id] ? { fill: colors[id] } : undefined}>
          <title>Plot {ax.lbl(id)}</title>
        </path>
      );
    })}
  </>
));
const EnquiryPins = memo(({ enquiries, ax }) => {
  const pins = enquiries.map(item => {
    const id = ax.findId(item.plotNumber);
    if (id == null) return null;
    const plot = P.find(row => row[0] === id);
    if (!plot) return null;
    const points = plot[3].split(' ').map(pair => pair.split(',').map(Number));
    const topRight = points.reduce((best, point) => point[0] - point[1] > best[0] - best[1] ? point : best, points[0]);
    const x = topRight[0];
    const y = topRight[1] - 31;
    const names = (item.names || []).filter(Boolean);
    if (!names.length) return null;
    return <g key={String(item.plotNumber)} data-enquiry-pin="true" className="enquiry-map-pin" transform={`translate(${x} ${y}) rotate(16)`}>
      <title>{`Enquiry for Unit ${item.plotNumber}: ${names.join(', ')}`}</title>
      <path d="M0 -38 C-21 -38 -31 -24 -31 -9 C-31 8 0 31 0 31 C0 31 31 8 31 -9 C31 -24 21 -38 0 -38Z" />
      <circle cx="0" cy="-10" r="10" />
      <path className="enquiry-pin-spark" d="M-4 -10h8M0 -14v8" />
    </g>;
  });
  return <g className="admin-enquiry-pins" aria-label="Customer enquiry pins">{pins}</g>;
});

const PlotNumbers = memo(({ status, filt, ax }) => (
  <>
    {P.map(([id]) => {
      const v = status[id] || 'a', [x, y] = ax.posOf(id);
      return <text key={id} x={x} y={y} className={'n ' + v}>{ax.lbl(id)}</text>;
    })}
  </>
));

const Tooltip = forwardRef(({ status, vpRef, ax }, ref) => {
  const [t, setT] = useState(null);
  const el = useRef(null);
  useImperativeHandle(ref, () => ({ show: (id, cx, cy) => setT({ id, cx, cy }), hide: () => setT(null) }), []);
  useLayoutEffect(() => {
    if (!t || !el.current) return;
    const r = vpRef.current.getBoundingClientRect(), w = el.current.offsetWidth, h = el.current.offsetHeight;
    let x = t.cx - r.left - w / 2, y = t.cy - r.top - h - 18;
    if (y < 8) y = t.cy - r.top + 22;
    x = Math.max(8, Math.min(r.width - w - 8, x));
    el.current.style.transform = `translate(${x}px,${y}px)`;
  });
  const s = t ? status[t.id] || 'a' : 'a', a = t ? ax.areaOf(t.id) : 0, [c, rem] = cents(a);
  return (
    <div id="tip" role="tooltip" hidden={!t} ref={el}>
      {t && <>
        <div className="chips"><span className="ch u">Unit: {ax.lbl(t.id)}</span><span className={'ch ' + s}>Status: {NAMES[s]}</span></div>
        <div className="ar"><b>{a} Sq.ft.</b><span> &middot; {c} cent {rem} sqft <small>approx.</small></span></div>
        {ax.rate > 0 && <><hr /><div className="pr"><i>Actual Price</i><b>{inr(a * ax.rate)}</b></div></>}
      </>}
    </div>
  );
});

const PlotMap = forwardRef(function PlotMap({ status, filt, setFilt, sel, selD, setSel, onTap, ax, admin, addMode, adminEnquiries = [], children }, ref) {
  const vpRef = useRef(null), stageRef = useRef(null), ovRef = useRef(null), topRef = useRef(null), tipRef = useRef(null), qRef = useRef(null);
  const view = useRef({}), cb = useRef({});
  const [msg, setMsg] = useState('');
  cb.current = { onTap, ax, admin };

  useImperativeHandle(ref, () => ({ focusOn: id => view.current.focusOn(id) }), []);

  useEffect(() => {
    const vp = vpRef.current, stage = stageRef.current, ov = ovRef.current, v = view.current;
    Object.assign(v, { s: 0.2, tx: 0, ty: 0, fitS: 0.2, z: null });
    const hideTip = () => tipRef.current && tipRef.current.hide();
    const apply = () => {
      stage.style.transform = `translate(${v.tx}px,${v.ty}px) scale(${v.s})`;
      ov.classList.toggle('zm', v.s > v.fitS * 1.6);
      const z = v.s < 0.25 ? '1' : v.s < 0.5 ? '2' : '3';
      if (z !== v.z) { v.z = z; ov.setAttribute('data-z', z); }
    };
    const go = anim => { if (anim) { stage.classList.add('anim'); setTimeout(() => stage.classList.remove('anim'), 420); } apply(); };
    v.fit = anim => {
      const r = vp.getBoundingClientRect(), tp = topRef.current, th = Math.round(tp.offsetTop + tp.offsetHeight + 12), bx = 369, by = 160, bw = 2501, bh = 3012;
      vp.style.setProperty('--th', th + 'px');
      v.fitS = Math.min(r.width / bw, (r.height - th) / bh) * 0.98; v.s = v.fitS;
      v.tx = (r.width - bw * v.s) / 2 - bx * v.s; v.ty = th + (r.height - th - bh * v.s) / 2 - by * v.s; go(anim);
    };
    v.zoomAt = (cx, cy, f, anim) => {
      const ns = Math.min(1.6, Math.max(v.fitS * 0.8, v.s * f));
      v.tx = cx - (cx - v.tx) * ns / v.s; v.ty = cy - (cy - v.ty) * ns / v.s; v.s = ns; go(anim);
    };
    v.focusOn = id => {
      const r = vp.getBoundingClientRect(), q = cb.current.ax.posOf(id);
      v.s = Math.max(v.s, Math.min(1.2, v.fitS * 4)); v.tx = r.width / 2 - q[0] * v.s; v.ty = r.height * 0.4 - q[1] * v.s; go(true);
    };
    v.fit(false);

    const skip = '.zoom,.top,.legend,.apn,#admbtn';
    const ptr = new Map(); let moved = 0, tgt = null, tgtD = null, pd = 0;
    const onWheel = e => {
      if (e.target.closest(skip)) return;
      e.preventDefault(); hideTip();
      const r = vp.getBoundingClientRect(); v.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    const onDown = e => {
      if (e.target.closest(skip) || e.target.closest('[data-enquiry-pin]')) return;
      vp.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptr.size === 1) { moved = 0; tgt = e.target.closest('[data-id]'); tgtD = e.target.closest('[data-dm]'); }
      else { const a = [...ptr.values()]; pd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); moved = 99; }
    };
    const onMove = e => {
      const p = ptr.get(e.pointerId);
      if (!p) {
        if (e.pointerType !== 'mouse' || ptr.size || cb.current.admin) return;
        const t = e.target.closest('[data-id]');
        if (t) tipRef.current.show(+t.dataset.id, e.clientX, e.clientY); else hideTip();
        return;
      }
      const r = vp.getBoundingClientRect();
      if (ptr.size === 1) {
        if (moved > 6) hideTip();
        const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy); v.tx += dx; v.ty += dy; apply();
      } else if (ptr.size === 2) {
        const o = [...ptr.entries()].find(([k]) => k !== e.pointerId)[1], d = Math.hypot(e.clientX - o.x, e.clientY - o.y);
        if (pd) v.zoomAt((e.clientX + o.x) / 2 - r.left, (e.clientY + o.y) / 2 - r.top, d / pd);
        pd = d;
      }
      p.x = e.clientX; p.y = e.clientY;
    };
    const onUp = e => {
      const was = ptr.size; ptr.delete(e.pointerId);
      if (was === 1 && moved < 6 && e.type === 'pointerup') {
        hideTip();
        const r = vp.getBoundingClientRect();
        cb.current.onTap({ id: tgt ? +tgt.dataset.id : null, dm: tgtD ? tgtD.dataset.dm : null, x: (e.clientX - r.left - v.tx) / v.s, y: (e.clientY - r.top - v.ty) / v.s });
      }
    };
    const onKey = e => { if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); qRef.current.focus(); } };
    const onResize = () => v.fit(false);
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('pointerdown', onDown); vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp); vp.addEventListener('pointercancel', onUp); vp.addEventListener('pointerleave', hideTip);
    addEventListener('resize', onResize); addEventListener('keydown', onKey);
    return () => {
      vp.removeEventListener('wheel', onWheel); vp.removeEventListener('pointerdown', onDown); vp.removeEventListener('pointermove', onMove);
      vp.removeEventListener('pointerup', onUp); vp.removeEventListener('pointercancel', onUp); vp.removeEventListener('pointerleave', hideTip);
      removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => { ovRef.current.classList.toggle('adm', !!admin); }, [admin]);
  useEffect(() => { vpRef.current.classList.toggle('addm', !!addMode); }, [addMode]);

  const n = { a: 0, r: 0, b: 0, s: 0 };
  P.forEach(([id]) => { n[status[id] || 'a']++; });
  const center = f => { const r = vpRef.current.getBoundingClientRect(); view.current.zoomAt(r.width / 2, r.height / 2, f, true); };
  const search = e => {
    if (e.key !== 'Enter') return;
    const val = e.target.value.trim(), fid = ax.findId(val), hit = fid != null ? [fid] : null;
    if (!hit) { setMsg('Plot ' + (val || '?') + ' is not on this layout. Try a number from the drawing.'); return; }
    const id = hit[0]; setMsg(''); setSel(id); view.current.focusOn(id);
    setTimeout(() => { const r = vpRef.current.getBoundingClientRect(); tipRef.current.show(id, r.left + r.width / 2, r.top + r.height * 0.4); }, 450);
  };
  const chips = [['a', 'var(--av)'], ['b', 'var(--bk)'], ['s', 'var(--sd)']];

  return (
    <main id="vp" ref={vpRef}>
      <div className="top" ref={topRef}>
        <div className="brand fl" aria-label={COMPANY}>
          <div className="brand-copy">
            <b>{PROJECT}</b>
            <span className="sub">{LAYOUT}</span>
          </div>
        </div>
        <div className="legend fl" title="Hover a plot for a quick look. Click it for details and booking enquiry.">
          <div className="lrow">
            <div className="chip status-chip"><i style={{ background: 'var(--av)' }} /><span className="l">Availability</span><span className="c">{n.a}</span></div>
            <div className="chip status-chip"><i style={{ background: 'var(--reserved)' }} /><span className="l">Reserved</span><span className="c">{n.r}</span></div>
            <div className="chip status-chip"><i style={{ background: 'var(--bk)' }} /><span className="l">Booked</span><span className="c">{n.b}</span></div>
            <div className="chip status-chip"><i style={{ background: 'var(--sd)' }} /><span className="l">Sold</span><span className="c">{n.s}</span></div>
          </div>
        </div>
        <div className="sw">
          <label className="search fl">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input id="q" ref={qRef} type="search" inputMode="numeric" placeholder="Search plot number" aria-label="Search plot number" onKeyDown={search} onChange={() => setMsg('')} />
          </label>
          <p id="msg" role="alert">{msg}</p>
        </div>
      </div>
      <div id="stage" ref={stageRef}>
        <svg id="ov" ref={ovRef} viewBox="0 0 4400 3400">
          <Ground /><Plots status={status} filt={filt} sel={sel} ax={ax} colors={ax.ad.colors || {}} />{admin && <EnquiryPins enquiries={adminEnquiries} ax={ax} />}<Trees /><PlotNumbers status={status} filt={filt} ax={ax} /><Measures ax={ax} selD={selD} /><Dims /><image href="/mary-ann-sidebar-logo.svg" x="470" y="440" width="900" height="240" preserveAspectRatio="xMidYMid meet" opacity="0.88" pointerEvents="none" />
          <g className="map-compass" transform="translate(2590 440) scale(2.4)" aria-label="North compass">
            <title>North compass</title>
            <text x="50" y="11" className="compass-direction">N</text>
            <text x="91" y="55" className="compass-direction">E</text>
            <text x="50" y="98" className="compass-direction">S</text>
            <text x="9" y="55" className="compass-direction">W</text>
            <circle cx="50" cy="54" r="30" className="compass-ring" />
            <path d="M50 26 L60 56 L50 50 L40 56 Z" className="compass-north" />
            <path d="M50 82 L40 52 L50 58 L60 52 Z" className="compass-south" />
            <circle cx="50" cy="54" r="3.5" className="compass-center" />
          </g>
          <image href="https://approvalguru.in/wp-content/uploads/2025/10/dtcp_approved-1-1024x752-1.jpg" x="2570" y="790" width="360" height="271" preserveAspectRatio="xMidYMid meet" opacity="1" pointerEvents="none">
            <title>DTCP approved layout</title>
          </image>
        </svg>
      </div>
      <div className="zoom fl">
        <button id="zi" aria-label="Zoom in" onClick={() => center(1.5)}>+</button>
        <button id="zo" aria-label="Zoom out" onClick={() => center(1 / 1.5)}>&minus;</button>
        <button id="zf" aria-label="Fit to screen" style={{ fontSize: 13 }} onClick={() => view.current.fit(true)}>Fit</button>
      </div>
      <Tooltip ref={tipRef} status={status} vpRef={vpRef} ax={ax} />
      {children}
    </main>
  );
});
export default PlotMap;
