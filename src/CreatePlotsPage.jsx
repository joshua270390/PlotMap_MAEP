import { useMemo, useState } from "react";

const blank = { name: "", description: "", location: "", route: "", file: null, geometry: null, notes: "", plots: [] };
const routeFromName = name => "/" + String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 55);
const fileTypes = ".pdf,.png,.jpg,.jpeg,.webp";

function GeometryPreview({ geometry }) {
  if (!geometry?.P?.length) return null;
  const { P, G = {} } = geometry;
  return <div className="create-map-preview">
    <svg viewBox="0 0 2000 2000" role="img" aria-label="AI extracted draft plot map">
      <rect width="2000" height="2000" fill="#f0f2ed" />
      {(G.base || []).map((d,i)=><path key={"r"+i} d={d} fill="#c9ced0" stroke="#fff" strokeWidth="12" />)}
      {(G.park || []).map((d,i)=><path key={"p"+i} d={d} fill="#c9dec6" stroke="#fff" strokeWidth="8" />)}
      {P.map(([id,x,y,points])=><g key={id}><polygon points={points} fill="#fff" stroke="#668276" strokeWidth="8" /><text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="700" fill="#263b4d">{id}</text></g>)}
    </svg>
  </div>;
}

export default function CreatePlotsPage({ editingProject = null, onSaved, onCancel }) {
  const initial = useMemo(() => editingProject ? ({
    ...blank, name: editingProject.name || "", description: editingProject.description || "",
    location: editingProject.location || "", route: editingProject.route || ("/" + editingProject.slug),
  }) : blank, [editingProject]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [analysed, setAnalysed] = useState(false);
  const set = key => event => setForm(value => ({ ...value, [key]: event.target.value }));
  const chooseFile = event => {
    const file = event.target.files?.[0] || null;
    setForm(value => ({ ...value, file, ...(editingProject ? {} : { geometry: null }) }));
    setAnalysed(false); setError(""); setNotice("");
  };
  async function analyse() {
    if (!form.file) { setError("Please choose a PDF or image first."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const data = new FormData(); data.append("file", form.file);
      const response = await fetch("/api/create-project?action=analyze", { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not analyse the layout.");
      setForm(value => ({ ...value, geometry: result.geometry, notes: result.notes || "", plots: result.plots || [] }));
      setAnalysed(true);
      setNotice("AI draft ready. Review the extracted plot map before saving.");
    } catch (e) { setError(e.message || "AI analysis failed."); }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!editingProject && (!form.file || !form.geometry)) { setError("Upload and analyse a PDF/image before creating the project."); return; }
    if (editingProject && form.file && !form.geometry && !editingProject.geometry) { setError("The existing map geometry is unavailable."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const data = new FormData();
      data.append("name", form.name.trim()); data.append("description", form.description.trim());
      data.append("location", form.location.trim()); data.append("route", form.route.trim());
      if (editingProject) data.append("id", String(editingProject.customProjectId));
      else data.append("geometry", JSON.stringify(form.geometry));
      if (form.file) data.append("file", form.file);
      const url = editingProject ? "/api/create-project?action=update" : "/api/create-project?action=create";
      const response = await fetch(url, { method: editingProject ? "PATCH" : "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not save project.");
      setNotice(editingProject ? "Project details updated. Existing plot geometry was preserved." : "Project created successfully.");
      await onSaved?.();
    } catch (e) { setError(e.message || "Could not save project."); }
    finally { setBusy(false); }
  }
  return <section className="create-plots-page">
    <div className="create-plots-heading"><div><span className="dashboard-kicker">MARY ANN ELITE PROPERTIES</span><h2>{editingProject ? "Edit project details" : "Create a new plot project"}</h2><p>{editingProject ? "Update project information or replace the source file. The saved plot boundaries and map geometry will not change." : "Upload a layout plan and let AI prepare a draft interactive plot map."}</p></div><span className="create-plots-step">PROJECT MANAGEMENT</span></div>
    <form className="create-plots-form" onSubmit={save}>
      <div className="create-plots-fields">
        <label>Plot Name<input value={form.name} onChange={e => { set("name")(e); if (!editingProject) setForm(v => ({ ...v, route: routeFromName(e.target.value) })); }} required maxLength={120} placeholder="e.g. Green Valley Phase 1" /></label>
        <label>Description<textarea value={form.description} onChange={set("description")} rows={3} maxLength={600} placeholder="Short project description" /></label>
        <label>Location<input value={form.location} onChange={set("location")} maxLength={180} placeholder="e.g. Madurai, Tamil Nadu" /></label>
        <label>Route<input value={form.route} onChange={set("route")} required pattern="/[a-z0-9_-]{2,55}" placeholder="/green_valley_phase1" /><small>Must start with / and use lowercase letters, numbers, _ or -.</small></label>
      </div>
      <div className="create-upload-panel">
        <div className="create-upload-icon">⇧</div><div><strong>{editingProject ? "Replace source PDF / Image (optional)" : "Upload source PDF / Image"}</strong><p>{editingProject ? "Replacing this file updates the source only; it will not regenerate plot boundaries." : "Supported: PDF, PNG, JPG, WEBP · Maximum 15 MB"}</p><input type="file" accept={fileTypes} onChange={chooseFile} /></div>
        {form.file && <span className="create-file-name">{form.file.name}</span>}
        {!form.file && editingProject?.source_file_name && <span className="create-file-name">Current: {editingProject.source_file_name}</span>}
      </div>
      {!editingProject && <div className="create-analysis-row"><button type="button" className="primary-btn" onClick={analyse} disabled={busy || !form.file}>{busy ? "Analysing…" : "Analyse layout with AI"}</button><span>AI extraction is a draft. Please verify plot numbers and boundaries against the original plan.</span></div>}
      {!editingProject && form.geometry && <div className="create-analysis-result">
        <div className="create-result-heading"><div><strong>AI layout preview</strong><p>{form.geometry.P.length} plots extracted · {form.plots.filter(p => Number(p.confidence) < 0.75).length} low-confidence plots</p></div><span className="create-result-status">Draft ready</span></div>
        <GeometryPreview geometry={form.geometry} />
        {form.notes && <p className="create-ai-notes"><strong>AI notes:</strong> {form.notes}</p>}
        <p className="create-warning">Important: AI-extracted plot boundaries may need manual verification. Do not use this draft as a legal survey or registration document.</p>
      </div>}
      {editingProject && <div className="create-edit-note"><strong>Geometry protection enabled</strong><span>Plot numbers, boundaries, dimensions, and existing map edits are preserved when saving project details.</span></div>}
      {error && <p className="dash-error" role="alert">{error}</p>}
      {notice && <p className="dash-notice" role="status">{notice}</p>}
      <div className="create-plots-actions"><button type="button" className="cancel-btn" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="primary-btn" disabled={busy || (!editingProject && !form.geometry)}>{busy ? "Saving…" : editingProject ? "Save project details" : "Create project"}</button></div>
    </form>
  </section>;
}
