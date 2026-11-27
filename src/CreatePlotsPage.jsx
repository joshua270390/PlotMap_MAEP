import { useMemo, useState } from "react";

const blank = { name: "", description: "", location: "", route: "", file: null, contextFiles: [], prompt: "", geometry: null, notes: "", plots: [] };
const routeFromName = name => "/" + String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 55);
const fileTypes = ".pdf,.png,.jpg,.jpeg,.webp";

function GeometryPreview({ geometry }) {
  if (!geometry?.P?.length) return null;
  const { P, G = {} } = geometry;
  return <div className="create-map-preview">
    <svg viewBox={`0 0 ${geometry.canvasWidth || 2000} ${geometry.canvasHeight || 2000}`} role="img" aria-label="AI extracted draft plot map">
      <rect width={geometry.canvasWidth || 2000} height={geometry.canvasHeight || 2000} fill="#f0f2ed" />
      {(G.base || []).map((d,i)=><path key={"r"+i} d={d} fill="#c9ced0" stroke="#fff" strokeWidth="12" />)}
      {(G.park || []).map((d,i)=><path key={"p"+i} d={d} fill="#c9dec6" stroke="#fff" strokeWidth="8" />)}
      {P.map(([id,x,y,points])=><g key={id}><polygon points={points} fill="#fff" stroke="#668276" strokeWidth="8" /><text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="700" fill="#263b4d">{geometry.plotLabels?.[id] ?? id}</text></g>)}
    </svg>
  </div>;
}

export default function CreatePlotsPage({ editingProject = null, authHeaders = {}, onSaved, onCancel }) {
  const initial = useMemo(() => editingProject ? ({
    ...blank, name: editingProject.name || "", description: editingProject.description || "",
    location: editingProject.location || "", route: editingProject.route || ("/" + editingProject.slug),
  }) : blank, [editingProject]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [analysed, setAnalysed] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState("");
  const set = key => event => setForm(value => ({ ...value, [key]: event.target.value }));
  const chooseFile = event => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setForm(value => ({ ...value, file, ...(editingProject ? {} : { geometry: null }) }));
    setAnalysed(false); setAnalysisJobId(""); setError(""); setNotice("");
  };
  const chooseContextFiles = event => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const allowed = files.filter(file => file.size > 0 && file.size <= 4 * 1024 * 1024 &&
      (file.type === "application/pdf" || ["image/png", "image/jpeg", "image/webp"].includes(file.type)));
    if (allowed.length !== files.length) setError("Prompt attachments must be PDF, PNG, JPG or WEBP files up to 4 MB each.");
    setForm(value => ({ ...value, contextFiles: [...value.contextFiles, ...allowed].slice(0, 5) }));
  };
  async function waitForAnalysis(jobId, attempts = 180) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const response = await fetch("/api/create-project?action=analysis-status&job_id=" + encodeURIComponent(jobId), {
        headers: authHeaders, cache: "no-store",
      });
      const status = await response.json().catch(() => ({}));
      if (!response.ok || !status.ok) throw new Error(status.error || "Could not check AI analysis status.");
      if (status.status === "completed" && status.result?.geometry?.P?.length) return status.result;
      if (status.status === "failed") throw new Error(status.error || "AI analysis failed. Please try another source file.");
      setNotice("AI is analysing your plan in the background. Please keep this page open… (" + Math.round((attempt + 1) * 2) + "s)");
    }
    return null;
  }
  function applyAnalysis(result) {
    setForm(value => ({ ...value, geometry: result.geometry, notes: result.notes || "", plots: result.plots || [] }));
    setAnalysed(true); setAnalysisJobId("");
    setNotice("AI draft ready. Review the extracted plot map before saving.");
  }
  async function analyse() {
    if (!form.file) { setError("Please choose a PDF or image first."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const data = new FormData(); data.append("file", form.file);
      data.append("prompt", form.prompt.trim());
      form.contextFiles.forEach(file => data.append("context_files", file));
      const response = await fetch("/api/create-project?action=analyze", { method: "POST", headers: authHeaders, body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || !result.job_id) throw new Error(result.error || "Could not start AI analysis.");
      setAnalysisJobId(result.job_id);
      const completed = await waitForAnalysis(result.job_id);
      if (completed) applyAnalysis(completed);
      else setNotice("AI analysis is still running. Use Check Status to continue without uploading the file again.");
    } catch (e) { setError(e.message || "AI analysis failed."); }
    finally { setBusy(false); }
  }
  async function checkAnalysisStatus() {
    if (!analysisJobId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const completed = await waitForAnalysis(analysisJobId, 60);
      if (completed) applyAnalysis(completed);
      else setNotice("AI analysis is still running. You can check its status again shortly.");
    } catch (e) { setError(e.message || "Could not check AI analysis status."); }
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
      const response = await fetch(url, { method: editingProject ? "PATCH" : "POST", headers: authHeaders, body: data });
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
        <div className="create-upload-icon">⇧</div><div><strong>{editingProject ? "Replace source PDF / Image (optional)" : "Upload source PDF / Image"}</strong><p>{editingProject ? "Replacing this file updates the source only; it will not regenerate plot boundaries." : "Main layout source · PDF, PNG, JPG or WEBP · Maximum 4 MB"}</p><input type="file" accept={fileTypes} onChange={chooseFile} /></div>
        {form.file && <span className="create-file-name">{form.file.name}</span>}
        {!form.file && editingProject?.source_file_name && <span className="create-file-name">Current: {editingProject.source_file_name}</span>}
      </div>
      {!editingProject && <section className="create-prompt-panel" aria-label="AI plot map prompt">
        <div className="create-prompt-heading"><div><span className="create-prompt-kicker">CLAUDE AI INSTRUCTIONS</span><label htmlFor="create-project-prompt">Prompt</label><p>Describe exactly how you want the plot geometry, map details and project thumbnail prepared.</p></div><span className="create-prompt-ai">✦ AI</span></div>
        <textarea id="create-project-prompt" className="create-prompt-input" value={form.prompt} onChange={e => setForm(value => ({ ...value, prompt: e.target.value }))} rows={5} maxLength={6000} placeholder="Example: Extract every clearly visible plot boundary and plot number. Keep roads and parks separate. Preserve the original layout proportions. Read dimensions and area labels where legible. Create a clean plot map geometry and use that geometry for the project-list thumbnail. Do not invent missing details." />
        <div className="create-prompt-composer"><label className="create-prompt-attach">＋ Attach files / images<input type="file" accept={fileTypes} multiple onChange={chooseContextFiles} /></label><span>{form.prompt.length}/6000 · Up to 5 reference files · 16 MB combined limit</span></div>
        {form.contextFiles.length > 0 && <div className="create-prompt-attachments">{form.contextFiles.map((file,index) => <span className="create-prompt-file" key={file.name + "-" + file.size + "-" + index}>{file.name}<button type="button" aria-label={"Remove " + file.name} onClick={() => setForm(value => ({ ...value, contextFiles: value.contextFiles.filter((_,i) => i !== index) }))}>×</button></span>)}</div>}
      </section>}
      {!editingProject && <div className="create-analysis-row"><button type="button" className="primary-btn" onClick={analyse} disabled={busy || !form.file || Boolean(analysisJobId)}>{busy ? "Analysing…" : "Analyse layout with AI"}</button>{analysisJobId && !form.geometry && <button type="button" className="cancel-btn" onClick={checkAnalysisStatus} disabled={busy}>{busy ? "Checking…" : "Check Status"}</button>}<span>AI extraction runs in the background. Please verify plot numbers and boundaries against the original plan.</span></div>}
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
