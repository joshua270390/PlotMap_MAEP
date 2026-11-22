import React,{useEffect,useState} from 'react';
import './ProjectLandingPage.css';

const text=value=>value==null?'':String(value);
const safeUrl=value=>/^https?:\/\//i.test(text(value).trim())?text(value).trim():'#';
const visible=value=>text(value).trim().length>0;
function ListCards({items=[]}){return <div className="cards">{items.map((item,i)=><article key={i}><b>{String(i+1).padStart(2,'0')}</b><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>;}
export default function ProjectLandingPage({projectSlug}) {
  const [content,setContent]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[lang,setLang]=useState('English');
  const map='/'+projectSlug+'/layout';
  useEffect(()=>{let active=true;setLoading(true);fetch('/api/layout-landing?slug='+encodeURIComponent(projectSlug),{cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||'Could not load this project page.');if(active)setContent(d.page?.content||null);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[projectSlug]);
  const tamil=lang==='Tamil',both=lang==='Both';
  const title=tamil&&visible(content?.hero?.titleTa)?content.hero.titleTa:content?.hero?.title;
  const subtitle=tamil&&visible(content?.hero?.subtitleTa)?content.hero.subtitleTa:content?.hero?.subtitle;
  const call=text(content?.contact?.callNumber).replace(/[^+\d]/g,'');
  const whatsapp=text(content?.contact?.whatsappNumber||content?.contact?.callNumber).replace(/\D/g,'');
  const whatsappHref=whatsapp?'https://wa.me/'+whatsapp:'#';
  const enquiry=content?.enquiry||{};
  const submitEnquiry=e=>{e.preventDefault();const data=new FormData(e.currentTarget);const message=['Project: '+projectSlug,'Name: '+data.get('name'),'Phone: '+data.get('phone'),'Plot size: '+data.get('size')].join('\n');if(whatsapp)window.open(whatsappHref+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');};
  if(loading)return <main className="project-page"><div className="project-state">Loading project information…</div></main>;
  if(error)return <main className="project-page"><div className="project-state"><h1>Unable to load this project</h1><p>{error}</p><a href="/">Back to projects</a></div></main>;
  if(!content)return <main className="project-page"><header><a href="/"><img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties"/></a><a href="/">All projects</a></header><section className="project-state"><h1>Project page coming soon</h1><p>Landing page content has not been published for this project yet.</p><a className="view-layout" href={map}>Open Plot Layout ↗</a></section></main>;
  return <main className="project-page">
    <header><a href="/"><img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties"/></a><nav><a href="#why">Why this project</a><a href="#prices">Prices</a><a href="#site">See the Site</a><a href="#faq">FAQ</a></nav><div className="lang">{['English','Tamil','Both'].map(x=><button type="button" className={lang===x?'active':''} onClick={()=>setLang(x)} key={x}>{x}</button>)}</div></header>
    <section className="project-hero"><div className="copy">{visible(content.hero?.badge)&&<small>{content.hero.badge}</small>}<h1>{title}</h1>{visible(subtitle)&&<p>{subtitle}</p>}{(both||tamil)&&visible(content.hero?.titleTa)&&lang==='Both'&&<h2 className="ta-title">{content.hero.titleTa}</h2>}{(both||tamil)&&visible(content.hero?.subtitleTa)&&lang==='Both'&&<p>{content.hero.subtitleTa}</p>}
      <div className="landing-actions">{visible(call)&&<a className="view-layout" href={'tel:'+call}>{content.contact?.callLabel||'Call'}</a>}{whatsapp&&<a className="view-layout secondary-action" href={whatsappHref} target="_blank" rel="noreferrer">{content.contact?.whatsappLabel||'WhatsApp'}</a>}<a className="view-layout" href="#enquiry">{content.contact?.visitLabel||'Book Site Visit'}</a></div>
      </div><div className="landing-hero-media">{content.site?.photos?.[0]?.url?<img src={safeUrl(content.site.photos[0].url)} alt={content.site.photos[0].alt||title||'Project image'}/>:<div className="landing-hero-placeholder">MARY ANN ELITE PROPERTIES</div>}</div></section>
    {content.offer?.enabled!==false&&(visible(content.offer?.heading)||visible(content.offer?.description))&&<section className="landing-offer"><strong>{content.offer.heading}</strong><span>{content.offer.description}</span></section>}
    {(visible(content.why?.heading)||visible(content.why?.description)||(content.why?.highlights||[]).length>0)&&<section className="highlights" id="why"><small>WHY THIS PROJECT</small><h2>{content.why?.heading}</h2><p>{content.why?.description}</p><ListCards items={content.why?.highlights}/></section>}
    {(content.prices||[]).length>0&&<section className="landing-prices" id="prices"><small>PRICE EXAMPLES</small><h2>Price examples</h2><div className="table-scroll"><table><thead><tr><th>Plot / Category</th><th>Size</th><th>Price</th><th>Note</th></tr></thead><tbody>{content.prices.map((r,i)=><tr key={i}><td>{r.label}</td><td>{r.size}</td><td>{r.price}</td><td>{r.note}</td></tr>)}</tbody></table></div></section>}
    {(content.audience?.items||[]).length>0&&<section className="highlights"><small>WHO IS IT FOR</small><h2>{content.audience?.heading}</h2><ListCards items={content.audience.items}/></section>}
    {(content.booking?.steps||[]).length>0&&<section className="steps"><small>HOW TO BOOK</small><h2>{content.booking?.heading}</h2><div>{content.booking.steps.map((r,i)=><article key={i}><b>{String(i+1).padStart(2,'0')}</b><h3>{r.title}</h3><p>{r.description}</p></article>)}</div></section>}
    {(content.faq||[]).length>0&&<section className="landing-faq" id="faq"><small>FREQUENTLY ASKED QUESTIONS</small><h2>FAQ</h2>{content.faq.map((r,i)=><details key={i}><summary>{r.question}</summary><p>{r.answer}</p></details>)}</section>}
    {(visible(content.site?.location)||(content.site?.photos||[]).length>0||(content.site?.videos||[]).length>0)&&<section className="landing-site" id="site"><small>SEE THE SITE</small><h2>{content.site?.heading||'See the Site'}</h2>{visible(content.site?.location)&&<p>{content.site.location}</p>}{(content.site?.photos||[]).length>0&&<div className="landing-gallery">{content.site.photos.map((p,i)=><img key={i} src={safeUrl(p.url)} alt={p.alt||'Project photo '+(i+1)}/>)}</div>}{(content.site?.videos||[]).map((v,i)=><p key={i}><a href={safeUrl(v.url)} target="_blank" rel="noreferrer">{v.title||'Watch project video'} ↗</a></p>)}</section>}
    <section className="landing-enquiry" id="enquiry"><div><small>GET IN TOUCH</small><h2>{enquiry.heading||'Enquire about this project'}</h2><p>{content.footer?.ctaDescription}</p></div><form onSubmit={submitEnquiry}><label>{enquiry.nameLabel||'Name'}<input name="name" required/></label><label>{enquiry.phoneLabel||'Phone'}<input name="phone" type="tel" required/></label><label>{enquiry.plotSizeLabel||'Plot Size'}<input name="size"/></label><button type="submit">{enquiry.submitLabel||'Submit Enquiry'}</button>{!whatsapp&&<small>Add a WhatsApp number in Layout Landing to enable enquiry submission.</small>}</form></section>
    <section className="landing-cta"><h2>{content.footer?.ctaHeading}</h2><p>{content.footer?.ctaDescription}</p><a className="view-layout" href={map}>View Interactive Layout ↗</a></section>
    <footer><a href="/"><img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties"/></a><span>{content.footer?.footerText||'© '+new Date().getFullYear()+' Mary Ann Elite Properties'}</span><a href={map}>View Layout ↗</a></footer>
  </main>;
}
