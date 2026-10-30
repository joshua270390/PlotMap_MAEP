// Canva-style selection box + floating toolbar for the admin map editor.
// Works for every project because it only relies on data-tk (text), data-sk (road/ground) and data-id (plot).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BG_PRESETS, FONTS, patchText, resetText, setPlotFill, setShapeFill, snapAngle, tWrap, toHex } from './canvasStyle.js';

const sel = (kind, key) => kind === 'text' ? `[data-tk="${key}"]` : kind === 'plot' ? `path[data-id="${key}"]` : `[data-sk="${key}"]`;

export default function CanvasEditor({ cv, ax, setAd, vpRef, ovRef, onClose }) {
  const boxRef = useRef(null), barRef = useRef(null), geo = useRef(null), act = useRef(null);
  const [base, setBase] = useState(null);
  const kind = cv?.kind, key = cv ? (cv.kind === 'plot' ? cv.id : cv.key) : null;
  const s = kind === 'text' ? (ax.ad.textStyles?.[key] || {}) : {};

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
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [kind, key]);

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
    setAd(ad => patchText(ad, key, a.mode === 'size' ? { fontSize: a.val } : { rot: a.val || undefined }));
  };
  const hp = mode => ({ onPointerDown: startHandle(mode), onPointerMove: moveHandle, onPointerUp: endHandle, onPointerCancel: endHandle });

  const t = patch => setAd(ad => patchText(ad, key, patch));
  const size = s.fontSize || base?.size || 20;
  const bold = s.bold ?? ((base?.weight || 400) >= 600);
  const italic = s.italic ?? !!base?.italic;
  const underline = s.underline ?? !!base?.underline;

  const fill = kind === 'plot' ? ax.ad.colors?.[key] : kind === 'shape' ? ax.ad.shapeFills?.[key] : null;
  const setFill = c => setAd(ad => kind === 'plot' ? setPlotFill(ad, key, c) : setShapeFill(ad, key, c));
  const shapeName = kind === 'plot' ? 'Plot ' + ax.lbl(key) : String(key).startsWith('rd') ? 'Road' : String(key).startsWith('pk') ? 'Empty ground' : 'Ground';

  return (
    <>
      <div ref={boxRef} className={'cv-box cv-ui' + (kind === 'text' ? ' txt' : '')} style={{ display: 'none' }}>
        {kind === 'text' && <>
          {['nw', 'ne', 'sw', 'se'].map(c => <span key={c} className={'cv-h ' + c} title="Drag to resize" {...hp('size')} />)}
          <span className="cv-stem" />
          <span className="cv-rot" title="Drag to rotate" {...hp('rot')}>⟳</span>
        </>}
      </div>
      <div ref={barRef} className="cv-bar cv-ui" role="toolbar" aria-label={kind === 'text' ? 'Text options' : 'Background colour options'}>
        {kind === 'text' ? <>
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
          <button type="button" className="cv-txt" onClick={() => setAd(ad => resetText(ad, key))}>Reset</button>
        </> : <>
          <span className="cv-lbl">{shapeName} · BG</span>
          {BG_PRESETS.map(c => <button key={c} type="button" className={'cv-sw' + (fill && fill.toLowerCase() === c ? ' on' : '')} style={{ background: c }} onClick={() => setFill(c)} aria-label={'Background ' + c} />)}
          <label className="cv-col" title="Custom colour"><input type="color" value={fill || '#c7dfc7'} onChange={e => setFill(e.target.value)} aria-label="Custom background colour" /></label>
          <span className="cv-sep" />
          <button type="button" className="cv-txt" onClick={() => setFill(null)}>Reset</button>
          {kind === 'plot' && <button type="button" className="cv-txt cv-link" onClick={() => window.dispatchEvent(new CustomEvent('maep-advanced'))}>Advance options</button>}
        </>}
        <button type="button" className="cv-x" onClick={onClose} aria-label="Close selection">×</button>
      </div>
    </>
  );
}
