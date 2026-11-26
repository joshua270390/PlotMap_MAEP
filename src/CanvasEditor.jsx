// Canva-style selection box + floating toolbar for the admin map editor.
// Works for every project because it only relies on data-tk (text), data-sk (road/ground) and data-id (plot).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FONTS, constrainMove, plotOfText, patchText, resetText, setPlotFill, setShapeFill, snapAngle, tWrap, toHex } from './canvasStyle.js';

const sel = (kind, key) => kind === 'text' ? `[data-tk="${key}"]` : kind === 'plot' ? `path[data-id="${key}"]` : `[data-sk="${key}"]`;

export default function CanvasEditor({ cv, ax, setAd, vpRef, ovRef, onClose }) {
  const boxRef = useRef(null), barRef = useRef(null), geo = useRef(null), act = useRef(null);
  const [base, setBase] = useState(null);
  const [fx, setFx] = useState(false);
  const items = cv ? (cv.items || [cv]) : [];
  const kOf = o => o.kind === 'plot' ? o.id : o.key;
  const texts = items.filter(o => o.kind === 'text').map(kOf);
  const fills = items.filter(o => o.kind !== 'text');
  const multi = items.length > 1;
  const pText = cv?.kind === 'text' ? cv.key : texts[texts.length - 1];
  // Primary item drives toolbar values / handles.
  const kind = pText != null ? 'text' : cv?.kind, key = pText != null ? pText : cv ? kOf(cv) : null;
  const sig = items.map(o => o.kind + kOf(o)).join('|');
  const s = kind === 'text' ? (ax.ad.textStyles?.[key] || {}) : {};
  const extraRefs = useRef([]);

  const find = () => ovRef.current?.querySelector(sel(kind, key));

  // Read the current (computed) look of the selected text so the toolbar shows real values.
  useLayoutEffect(() => {
    if (kind !== 'text') { setBase(null); return; }
    const el = find(); if (!el) { setBase(null); return; }
    const cs = getComputedStyle(el);
    setBase({ fill: toHex(cs.fill), size: Math.round(parseFloat(cs.fontSize) * 10) / 10, weight: parseInt(cs.fontWeight, 10) || 400, italic: cs.fontStyle === 'italic', underline: /underline/.test(cs.textDecorationLine || cs.textDecoration) });
  }, [kind, key, ax.ad]);

  // Keep the box glued to the element while panning / zooming.
  useEffect(() => {
    if (!cv) return;
    let raf;
    const tick = () => {
      const el = find(), box = boxRef.current, bar = barRef.current, vp = vpRef.current;
      if (el && box && vp) {
        const vr = vp.getBoundingClientRect();
        let cx, cy, w, h, ang = 0, halfH;
        if (kind === 'text') {
          const bb = el.getBBox(), m = el.getScreenCTM();
          const c = new DOMPoint(bb.x + bb.width / 2, bb.y + bb.height / 2).matrixTransform(m);
          const sc = Math.hypot(m.a, m.b);
          ang = Math.atan2(m.b, m.a) * 180 / Math.PI;
          cx = c.x - vr.left; cy = c.y - vr.top; w = bb.width * sc + 14; h = bb.height * sc + 10;
          const rad = ang * Math.PI / 180;
          halfH = (Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))) / 2;
        } else {
          const r = el.getBoundingClientRect();
          cx = r.left + r.width / 2 - vr.left; cy = r.top + r.height / 2 - vr.top; w = r.width + 8; h = r.height + 8; halfH = h / 2;
        }
        geo.current = { cx: cx + vr.left, cy: cy + vr.top };
        box.style.display = 'block';
        box.style.left = cx + 'px'; box.style.top = cy + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px';
        box.style.transform = `translate(-50%,-50%) rotate(${ang}deg)`;
        if (bar) {
          const bw = bar.offsetWidth, bh = bar.offsetHeight, th = parseFloat(getComputedStyle(vp).getPropertyValue('--th')) || 70;
          let top = cy - halfH - bh - (kind === 'text' ? 40 : 14);
          if (top < th) top = Math.min(vr.height - bh - 8, cy + halfH + 16);
          const left = Math.max(8, Math.min(vr.width - bw - 8, cx - bw / 2));
          bar.style.transform = `translate(${left}px,${Math.max(8, top)}px)`;
        }
      } else if (box) box.style.display = 'none';
      if (vp) {
        const vr = vp.getBoundingClientRect();
        items.forEach((o, i) => {
          const b = extraRefs.current[i]; if (!b) return;
          const e2 = ovRef.current?.querySelector(sel(o.kind, kOf(o)));
          if (!e2 || !multi) { b.style.display = 'none'; return; }
          const r = e2.getBoundingClientRect();
          b.style.display = 'block';
          b.style.left = (r.left + r.width / 2 - vr.left) + 'px'; b.style.top = (r.top + r.height / 2 - vr.top) + 'px';
          b.style.width = (r.width + 8) + 'px'; b.style.height = (r.height + 8) + 'px'; b.style.transform = 'translate(-50%,-50%)';
        });
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [kind, key, sig]);

  // Keyboard arrows move the selected text(s); Shift = bigger steps. Plot texts stay inside their plot.
  const keyRef = useRef(null);
  keyRef.current = { texts, ad: ax.ad, setAd, root: ovRef.current };
  useEffect(() => {
    const onKey = e => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || e.ctrlKey || e.metaKey || e.altKey) return;
      const ae = document.activeElement; if (ae && (/^(TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable || (ae.tagName === 'INPUT' && !/^(checkbox|color|button|radio)$/.test(ae.type)))) return;
      const { texts: ks, ad, setAd: sa, root } = keyRef.current;
      if (!ks.length || !root) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1, out = {};
      ks.forEach(k => {
        const text = root.querySelector(`[data-tk="${k}"]`), wrap = text?.closest('[data-tw]'); if (!wrap) return;
        const st = ad.textStyles?.[k] || {}, x = +st.dx || 0, y = +st.dy || 0;
        const [nx, ny] = constrainMove(wrap, text, plotOfText(text), st, x + d[0] * step, y + d[1] * step, [x, y]);
        if (nx !== x || ny !== y) out[k] = { dx: Math.round(nx * 10) / 10, dy: Math.round(ny * 10) / 10 };
      });
      if (Object.keys(out).length) sa(a => Object.keys(out).reduce((n, k) => patchText(n, k, out[k]), a));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (!cv) return null;

  // ---- handles: resize (corners) and rotate (top) for text ----
  const startHandle = mode => e => {
    e.preventDefault(); e.stopPropagation();
    const el = find(); if (!el || !geo.current) return;
    const wrap = el.closest('[data-tw]');
    const { cx, cy } = geo.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    act.current = {
      mode, el, wrap, cx, cy,
      d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
      a0: Math.atan2(e.clientY - cy, e.clientX - cx),
      size0: parseFloat(getComputedStyle(el).fontSize) || 20,
      rot0: +s.rot || 0, val: null,
    };
  };
  const moveHandle = e => {
    const a = act.current; if (!a) return;
    if (a.mode === 'size') {
      const v = Math.max(4, Math.min(400, Math.round(a.size0 * Math.hypot(e.clientX - a.cx, e.clientY - a.cy) / a.d0 * 10) / 10));
      a.val = v; a.el.style.fontSize = v + 'px';
    } else {
      const v = snapAngle(a.rot0 + (Math.atan2(e.clientY - a.cy, e.clientX - a.cx) - a.a0) * 180 / Math.PI);
      a.val = v;
      const t = tWrap({ ...s, rot: v }, a.wrap.dataset.cx, a.wrap.dataset.cy);
      if (t) a.wrap.setAttribute('transform', t); else a.wrap.removeAttribute('transform');
    }
  };
  const endHandle = () => {
    const a = act.current; act.current = null;
    if (!a || a.val == null) return;
    setAd(ad => texts.reduce((n, k) => patchText(n, k, a.mode === 'size' ? { fontSize: a.val } : { rot: a.val || undefined }), ad));
  };
  const hp = mode => ({ onPointerDown: startHandle(mode), onPointerMove: moveHandle, onPointerUp: endHandle, onPointerCancel: endHandle });

  const t = patch => setAd(ad => texts.reduce((n, k) => patchText(n, k, patch), ad));
  const size = s.fontSize || base?.size || 20;
  const bold = s.bold ?? ((base?.weight || 400) >= 600);
  const italic = s.italic ?? !!base?.italic;
  const underline = s.underline ?? !!base?.underline;

  const f0 = fills[fills.length - 1];
  const fill = !f0 ? null : f0.kind === 'plot' ? ax.ad.colors?.[f0.id] : ax.ad.shapeFills?.[f0.key];
  const setFill = c => setAd(ad => fills.reduce((n, o) => o.kind === 'plot' ? setPlotFill(n, o.id, c) : setShapeFill(n, o.key, c), ad));
  const nameOf = o => o.kind === 'plot' ? 'Plot No: ' + ax.lbl(o.id) : String(o.key).startsWith('rd') ? 'Road' : String(o.key).startsWith('pk') ? 'Empty Land' : 'Ground';
  const fillLbl = !fills.length ? '' : fills.length === 1 ? nameOf(fills[0]) : fills.slice(0, 3).map(nameOf).join(', ') + (fills.length > 3 ? ' +' + (fills.length - 3) : '');


  return (
    <>
      <div ref={boxRef} className={'cv-box cv-ui' + (kind === 'text' ? ' txt' : '')} style={{ display: 'none' }}>
        {kind === 'text' && !multi && <>
          {['nw', 'ne', 'sw', 'se'].map(c => <span key={c} className={'cv-h ' + c} title="Drag to resize" {...hp('size')} />)}
          <span className="cv-stem" />
          <span className="cv-rot" title="Drag to rotate" {...hp('rot')}>⟳</span>
        </>}
      </div>
      {multi && items.map((o, i) => <div key={o.kind + kOf(o)} ref={el => { extraRefs.current[i] = el; }} className="cv-box cv-ui" style={{ display: 'none' }} />)}
      <div ref={barRef} className="cv-bar cv-ui" role="toolbar" aria-label={kind === 'text' ? 'Text options' : 'Background colour options'}>
        {multi && <span className="cv-lbl">{items.length} selected</span>}
        {texts.length > 0 && <>
          <label className="cv-col" title="Text colour"><input type="color" value={s.fill || base?.fill || '#000000'} onChange={e => t({ fill: e.target.value })} aria-label="Text colour" /></label>
          <span className="cv-sep" />
          <button type="button" className="cv-b" onClick={() => t({ fontSize: Math.max(4, Math.round((size - 1) * 10) / 10) })} aria-label="Smaller text">−</button>
          <input className="cv-num" type="number" min="4" max="400" step="1" value={size} onChange={e => { const v = parseFloat(e.target.value); if (v >= 4 && v <= 400) t({ fontSize: v }); }} aria-label="Font size" />
          <button type="button" className="cv-b" onClick={() => t({ fontSize: Math.min(400, Math.round((size + 1) * 10) / 10) })} aria-label="Bigger text">+</button>
          <span className="cv-sep" />
          <select className="cv-font" value={s.fontFamily || ''} onChange={e => t({ fontFamily: e.target.value || undefined })} aria-label="Font family">
            {FONTS.map(([v, l]) => <option key={l} value={v} style={v ? { fontFamily: v } : undefined}>{l}</option>)}
          </select>
          <span className="cv-sep" />
          <button type="button" className={'cv-b' + (bold ? ' on' : '')} aria-pressed={bold} onClick={() => t({ bold: !bold })} aria-label="Bold"><b>B</b></button>
          <button type="button" className={'cv-b' + (italic ? ' on' : '')} aria-pressed={italic} onClick={() => t({ italic: !italic || undefined })} aria-label="Italic"><i>I</i></button>
          <button type="button" className={'cv-b' + (underline ? ' on' : '')} aria-pressed={underline} onClick={() => t({ underline: !underline || undefined })} aria-label="Underline"><u>U</u></button>
          <span className="cv-sep" />
          <button type="button" className={'cv-txt' + (fx ? ' on' : '')} aria-pressed={fx} onClick={() => setFx(v => !v)}>Effects</button>
          <button type="button" className="cv-txt" onClick={() => setAd(ad => texts.reduce((n, k) => resetText(n, k), ad))}>Reset</button>
          {fx && <div className="cv-fx">
            <div className="cv-fx-row">
              <label className="cv-chk"><input type="checkbox" checked={!!s.shColor} onChange={e => t(e.target.checked ? { shColor: '#000000', shOp: 50, shX: Math.round(size * 0.08 * 10) / 10 || 1, shY: Math.round(size * 0.08 * 10) / 10 || 1, shBlur: Math.round(size * 0.06 * 10) / 10 || 0.5 } : { shColor: undefined, shOp: undefined, shX: undefined, shY: undefined, shBlur: undefined })} /> Text shadow</label>
              {s.shColor && <>
                <label className="cv-col" title="Shadow colour"><input type="color" value={toHex(s.shColor)} onChange={e => t({ shColor: e.target.value })} aria-label="Shadow colour" /></label>
                <Rng lbl="Transparency" v={100 - (s.shOp ?? 100)} min={0} max={100} step={1} unit="%" on={v => t({ shOp: 100 - v })} />
              </>}
            </div>
            {s.shColor && <div className="cv-fx-row">
              <span className="cv-sub">Position</span>
              <Rng lbl="X" v={+s.shX || 0} min={-20} max={20} step={0.5} on={v => t({ shX: v })} />
              <Rng lbl="Y" v={+s.shY || 0} min={-20} max={20} step={0.5} on={v => t({ shY: v })} />
              <Rng lbl="Blur" v={+s.shBlur || 0} min={0} max={10} step={0.5} on={v => t({ shBlur: v })} />
            </div>}
            <div className="cv-fx-row">
              <label className="cv-chk"><input type="checkbox" checked={!!s.stColor} onChange={e => t(e.target.checked ? { stColor: '#000000', stOp: 100, stW: Math.round(size * 0.12 * 10) / 10 || 1 } : { stColor: undefined, stOp: undefined, stW: undefined })} /> Text stroke</label>
              {s.stColor && <>
                <label className="cv-col" title="Stroke colour"><input type="color" value={toHex(s.stColor)} onChange={e => t({ stColor: e.target.value })} aria-label="Stroke colour" /></label>
                <Rng lbl="Width" v={+s.stW || 0} min={0} max={20} step={0.5} on={v => t({ stW: v })} />
                <Rng lbl="Transparency" v={100 - (s.stOp ?? 100)} min={0} max={100} step={1} unit="%" on={v => t({ stOp: 100 - v })} />
              </>}
            </div>
            <div className="cv-fx-row">
              <label className="cv-chk"><input type="checkbox" checked={!!s.bgColor} onChange={e => t(e.target.checked ? { bgColor: '#ffffff', bgOp: 80 } : { bgColor: undefined, bgOp: undefined })} /> Text BG colour</label>
              {s.bgColor && <>
                <label className="cv-col" title="Text background colour"><input type="color" value={toHex(s.bgColor)} onChange={e => t({ bgColor: e.target.value })} aria-label="Text background colour" /></label>
                <Rng lbl="Transparency" v={100 - (s.bgOp ?? 100)} min={0} max={100} step={1} unit="%" on={v => t({ bgOp: 100 - v })} />
              </>}
            </div>
            <div className="cv-fx-hint">Arrow keys move text · Shift + arrow = faster</div>
          </div>}
        </>}
        {fills.length > 0 && <>
          {texts.length > 0 && <span className="cv-sep" />}
          {fillLbl && <span className="cv-lbl" title={fillLbl}>{fillLbl}</span>}
          <label className="cv-col" title="Background colour"><input type="color" value={fill || '#c7dfc7'} onChange={e => setFill(e.target.value)} aria-label="Background colour" /></label>
          <button type="button" className="cv-txt" onClick={() => setFill(null)}>Reset</button>
        </>}

        <button type="button" className="cv-x" onClick={onClose} aria-label="Close selection">×</button>
      </div>
    </>
  );
}

function Rng({ lbl, v, min, max, step, unit = '', on }) {
  return <label className="cv-rng"><span>{lbl}</span><input type="range" min={min} max={max} step={step} value={v} onChange={e => on(+e.target.value)} aria-label={lbl} /><em>{v}{unit}</em></label>;
}
