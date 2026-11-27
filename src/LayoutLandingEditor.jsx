import { useEffect, useState } from 'react';
import './LayoutLandingEditor.css';

const PROJECTS = [
  ['velavan_nagar','Velavan Nagar'],['shanmuga_avenue','Shanmuga Avenue'],['saraswathi_garden','Saraswathi Garden'],
  ['meenakshi_garden_phase1','Sri Meenakshi Garden – Phase 1'],['meenakshi_garden_phase2','Sri Meenakshi Garden – Phase 2'],['grace_city_kalikudi_chennampatti','Grace City, Kalikudi, Chennampatti']
];
const blank = name => ({
  language:'Both',hero:{badge:'',title:name,subtitle:'',titleTa:'',subtitleTa:''},
  contact:{callLabel:'Call',callNumber:'',whatsappLabel:'WhatsApp',whatsappNumber:'',visitLabel:'Book Site Visit'},
  offer:{enabled:true,heading:'',description:''},why:{heading:'',description:'',highlights:[]},prices:[],
  audience:{heading:'',items:[]},booking:{heading:'',steps:[]},faq:[],
  site:{heading:'See the Site',location:'',photos:[],videos:[]},
  enquiry:{heading:'',nameLabel:'Name',phoneLabel:'Phone',plotSizeLabel:'Plot Size',submitLabel:'Submit Enquiry'},
  footer:{ctaHeading:'',ctaDescription:'',footerText:''}
});
const copy = value => JSON.parse(JSON.stringify(value));
function Input({label,value,onChange,multi=false}) { return <label className="ll-field"><span>{label}</span>{multi?<textarea rows="3" value={value||''} onChange={e=>onChange(e.target.value)}/>:<input value={value||''} onChange={e=>onChange(e.target.value)}/>}</label>; }
function Repeater({title,items,fields,onChange}) {
  const edit=(i,key,value)=>onChange(items.map((item,n)=>n===i?{...item,[key]:value}:item));
  return <section className="ll-section"><div className="ll-section-title"><h3>{title}</h3><button type="button" onClick={()=>onChange([...items,Object.fromEntries(fields.map(f=>[f[0],'']))])}>Add +</button></div>
    {items.map((item,i)=><div className="ll-repeat" key={i}><div className="ll-fields">{fields.map(([key,label,multi])=><Input key={key} label={label} value={item[key]} multi={multi} onChange={v=>edit(i,key,v)}/>)}</div><button type="button" className="ll-remove" onClick={()=>onChange(items.filter((_,n)=>n!==i))}>Delete</button></div>)}
    {!items.length&&<p className="ll-muted">No items added.</p>}
  </section>;
}
export default function LayoutLandingEditor({pin,employeeToken,setError,setNotice}) {
  const [slug,setSlug]=useState(PROJECTS[0][0]),[content,setContent]=useState(blank(PROJECTS[0][1]));
  const [saved,setSaved]=useState([]),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[loaded,setLoaded]=useState(false);
  const name=PROJECTS.find(p=>p[0]===slug)?.[1]||slug;
  const headers={'Content-Type':'application/json',...(employeeToken?{'x-employee-token':employeeToken}:{'x-admin-pin':pin})};
  async function load(next=slug) {
    setBusy(true);setError('');
    try {
      const [a,b]=await Promise.all([fetch('/api/layout-landing?all=1',{headers:employeeToken?{'x-employee-token':employeeToken}:{'x-admin-pin':pin},cache:'no-store'}),fetch('/api/layout-landing?slug='+encodeURIComponent(next),{cache:'no-store'})]);
      const list=await a.json().catch(()=>({})),one=await b.json().catch(()=>({}));
      if(!a.ok||!list.ok)throw new Error(list.error||'Could not load landing page list.');
      if(!b.ok||!one.ok)throw new Error(one.error||'Could not load landing page.');
      setSaved(list.pages||[]);setContent(one.page?.content?copy(one.page.content):blank(PROJECTS.find(p=>p[0]===next)?.[1]||next));setDirty(false);setLoaded(true);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  useEffect(()=>{load(slug);},[pin,employeeToken]);
  const set=(path,value)=>{setContent(current=>{const next=copy(current);const keys=path.split('.');let node=next;keys.slice(0,-1).forEach(k=>node=node[k]);node[keys[keys.length-1]]=value;return next;});setDirty(true);};
  const changeProject=next=>{setSlug(next);load(next);};
  async function save(){
    setBusy(true);setError('');setNotice('');
    try{const r=await fetch('/api/layout-landing',{method:'POST',headers,body:JSON.stringify({slug,content})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||'Save failed.');setNotice('Landing page saved successfully.');await load(slug);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function remove(){
    if(!saved.some(p=>p.slug===slug)||!window.confirm('Delete saved landing content for '+name+'?'))return;
    setBusy(true);setError('');setNotice('');
    try{const r=await fetch('/api/layout-landing?slug='+encodeURIComponent(slug),{method:'DELETE',headers,body:JSON.stringify({slug})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||'Delete failed.');setContent(blank(name));setSaved(v=>v.filter(p=>p.slug!==slug));setDirty(false);setNotice('Landing page content deleted.');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if(!loaded)return <div className="ll-loading">Loading Layout Landing…</div>;
  const get=path=>path.split('.').reduce((o,k)=>o?.[k],content);
  return <div className="ll-manager">
    <div className="ll-intro"><div><span className="ll-kicker">PUBLIC PROJECT PAGE CONTENT</span><h2>Layout Landing</h2><p>Each project has independent landing-page content. Nothing is copied from Plot List.</p></div><span className="ll-state">{saved.some(p=>p.slug===slug)?'Saved content exists':'Not published yet'}</span></div>
    <div className="ll-toolbar"><label>Project<select value={slug} onChange={e=>changeProject(e.target.value)}>{PROJECTS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><a href={'/'+slug} target="_blank" rel="noreferrer">Preview public page ↗</a></div>
    <section className="ll-section"><h3>01 · Language and Hero</h3><div className="ll-fields"><Input label="Language (English / Tamil / Both)" value={content.language} onChange={v=>set('language',v)}/><Input label="Hero badge" value={get('hero.badge')} onChange={v=>set('hero.badge',v)}/><Input label="Title · English" value={get('hero.title')} onChange={v=>set('hero.title',v)}/><Input label="Subtitle · English" multi value={get('hero.subtitle')} onChange={v=>set('hero.subtitle',v)}/><Input label="Title · Tamil" value={get('hero.titleTa')} onChange={v=>set('hero.titleTa',v)}/><Input label="Subtitle · Tamil" multi value={get('hero.subtitleTa')} onChange={v=>set('hero.subtitleTa',v)}/></div></section>
    <section className="ll-section"><h3>02 · Call, WhatsApp and Site Visit</h3><div className="ll-fields">{[['Call label','contact.callLabel'],['Call number','contact.callNumber'],['WhatsApp label','contact.whatsappLabel'],['WhatsApp number','contact.whatsappNumber'],['Site visit label','contact.visitLabel']].map(([l,p])=><Input key={p} label={l} value={get(p)} onChange={v=>set(p,v)}/>)}</div></section>
    <section className="ll-section"><h3>03 · Offer banner</h3><div className="ll-fields"><Input label="Offer heading" value={get('offer.heading')} onChange={v=>set('offer.heading',v)}/><Input label="Offer description" multi value={get('offer.description')} onChange={v=>set('offer.description',v)}/></div><label className="ll-check"><input type="checkbox" checked={get('offer.enabled')!==false} onChange={e=>set('offer.enabled',e.target.checked)}/> Display offer banner</label></section>
    <section className="ll-section"><h3>04 · Why this project</h3><div className="ll-fields"><Input label="Heading" value={get('why.heading')} onChange={v=>set('why.heading',v)}/><Input label="Description" multi value={get('why.description')} onChange={v=>set('why.description',v)}/></div><Repeater title="Highlights" items={get('why.highlights')||[]} fields={[['title','Highlight title'],['description','Description',true]]} onChange={v=>set('why.highlights',v)}/></section>
    <Repeater title="05 · Price examples" items={content.prices||[]} fields={[['label','Plot / category'],['size','Size'],['price','Price'],['note','Note']]} onChange={v=>set('prices',v)}/>
    <section className="ll-section"><h3>06 · Who is it for</h3><Input label="Section heading" value={get('audience.heading')} onChange={v=>set('audience.heading',v)}/><Repeater title="Audience items" items={get('audience.items')||[]} fields={[['title','Audience title'],['description','Description',true]]} onChange={v=>set('audience.items',v)}/></section>
    <section className="ll-section"><h3>07 · How to book</h3><Input label="Section heading" value={get('booking.heading')} onChange={v=>set('booking.heading',v)}/><Repeater title="Booking steps" items={get('booking.steps')||[]} fields={[['title','Step title'],['description','Step description',true]]} onChange={v=>set('booking.steps',v)}/></section>
    <Repeater title="08 · FAQ" items={content.faq||[]} fields={[['question','Question'],['answer','Answer',true]]} onChange={v=>set('faq',v)}/>
    <section className="ll-section"><h3>09 · See the Site</h3><div className="ll-fields"><Input label="Section heading" value={get('site.heading')} onChange={v=>set('site.heading',v)}/><Input label="Location / map URL" multi value={get('site.location')} onChange={v=>set('site.location',v)}/></div><Repeater title="Photos" items={get('site.photos')||[]} fields={[['url','Photo URL'],['alt','Description']]} onChange={v=>set('site.photos',v)}/><Repeater title="Videos" items={get('site.videos')||[]} fields={[['url','Video URL'],['title','Video title']]} onChange={v=>set('site.videos',v)}/></section>
    <section className="ll-section"><h3>10 · Enquiry form</h3><div className="ll-fields">{[['Heading','enquiry.heading'],['Name label','enquiry.nameLabel'],['Phone label','enquiry.phoneLabel'],['Plot size label','enquiry.plotSizeLabel'],['Submit button','enquiry.submitLabel']].map(([l,p])=><Input key={p} label={l} value={get(p)} onChange={v=>set(p,v)}/>)}</div></section>
    <section className="ll-section"><h3>11 · CTA and Footer</h3><div className="ll-fields"><Input label="CTA heading" value={get('footer.ctaHeading')} onChange={v=>set('footer.ctaHeading',v)}/><Input label="CTA description" multi value={get('footer.ctaDescription')} onChange={v=>set('footer.ctaDescription',v)}/><Input label="Footer text" multi value={get('footer.footerText')} onChange={v=>set('footer.footerText',v)}/></div></section>
    <div className="ll-savebar"><span>{dirty?'Unsaved changes':'Changes saved'}</span><button type="button" className="ll-delete" onClick={remove} disabled={busy||!saved.some(p=>p.slug===slug)}>Delete landing content</button><button type="button" className="ll-save" onClick={save} disabled={busy}>{busy?'Saving…':'Save landing page'}</button></div>
  </div>;
}
