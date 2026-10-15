import { useRef, useState } from 'react';
import { PIN } from './config.js';
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

export default function AdminPanel({ panel, setPanel, ax, setAd, sel, selD, addMode, setAddMode, clearSel }) {
  const [pin, setPin] = useState(''), [pm, setPm] = useState(''), [note, setNote] = useState(null), [rst, setRst] = useState(false);
  const [rate, setRate] = useState(ax.ad.rate || '');
  const file = useRef(null), rt = useRef(0);

  if (panel === 'off') return <button id="admbtn" className="fl" type="button" onClick={() => setPanel('lock')}>Admin</button>;

  const unlock = () => { if (pin === PIN) { setPm(''); setPin(''); setPanel('tools'); } else setPm('Wrong PIN.'); };
  const exit = () => { setPanel('off'); setPin(''); setPm(''); setNote(null); clearSel(); };
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

  return (
    <div id="adm" className="apn fl">
      <div className="ah">
        <div className="at">
          <span className="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z" /><path d="m9 12 2 2 4-4" /></svg></span>
          <div><b>Admin studio</b><small>Plots, labels and rates</small></div>
        </div>
        <button className="ghost" type="button" onClick={exit}>Exit</button>
      </div>
      <div className="abody">
        {panel === 'lock' ? (
          <div className="lockc">
            <div className="lk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></div>
            <p className="lt2">Enter your PIN to edit the plot map</p>
            <label><span>Admin PIN</span><input autoFocus type="password" inputMode="numeric" autoComplete="off" placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && unlock()} /></label>
            <div className="arow"><button className="pri" type="button" onClick={unlock}>Unlock</button></div>
            <p className="hint" style={{ color: 'var(--sd)' }}>{pm}</p>
          </div>
        ) : (
          <div>
            <div className="sec">Selected</div>
            <div className="card">
              {addMode ? <p className="hint">Click on the map where the new dimension label should go.</p>
                : sel != null ? <PlotEditor key={sel} id={sel} ax={ax} setAd={setAd} />
                : selD && ax.dmList().some(d => d.k === selD) ? <DmEditor key={selD} k={selD} ax={ax} setAd={setAd} onGone={clearSel} />
                : <p className="hint">Click a plot or a dimension label on the map to edit it.</p>}
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
  );
}
