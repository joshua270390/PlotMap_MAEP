import React, { useEffect, useState } from 'react';
import './ProjectLandingPage.css';

const text = value => value == null ? '' : String(value);
const visible = value => text(value).trim().length > 0;
const safeUrl = value => /^https?:\/\//i.test(text(value).trim()) ? text(value).trim() : '';
const cleanPhone = value => text(value).replace(/[^+\d]/g, '');
const cleanWhatsApp = value => text(value).replace(/\D/g, '');

function LanguageText({ english, tamil, language, as: Tag = 'span', className = '' }) {
  const en = text(english), ta = text(tamil);
  if (language === 'Tamil') return <Tag className={className}>{visible(ta) ? ta : en}</Tag>;
  if (language === 'Both') return <Tag className={className}>{en}{visible(ta) && <span className="ta-line">{ta}</span>}</Tag>;
  return <Tag className={className}>{en}</Tag>;
}

function SectionHeading({ eyebrow, title, tamil, language }) {
  return <div className="lp-section-heading"><span className="lp-eyebrow">{eyebrow}</span><h2><LanguageText english={title} tamil={tamil} language={language}/></h2></div>;
}


const LEGACY_PROJECTS = {
  velavan_nagar: { name: 'Velavan Nagar', location: 'Kallikudi – Kurayur, Madurai', layout: 'Kurayur layout', price: '₹299 / sq.ft.', plots: '180 plots', intro: 'Explore Velavan Nagar, a plotted land opportunity at Kallikudi–Kurayur.', tamil: 'கள்ளிக்குடி–குராயூர் பகுதியில் அமைந்துள்ள வேலவன் நகர் மனைப்பிரிவை அறிந்துகொள்ளுங்கள்.' },
  shanmuga_avenue: { name: 'Shanmuga Avenue', location: 'Arasanur, Sivagangai', layout: 'Arasanur layout', intro: 'Discover Shanmuga Avenue and explore its interactive plot layout online.', tamil: 'சிவகங்கை மாவட்டம் அரசனூர் பகுதியில் உள்ள சண்முகா அவென்யூ மனைப்பிரிவை அறிந்துகொள்ளுங்கள்.' },
  saraswathi_garden: { name: 'Saraswathi Garden', location: 'Madurai, Tamil Nadu', layout: 'Saraswathi Garden layout', intro: 'Discover Saraswathi Garden and explore its project layout online.', tamil: 'மதுரையில் உள்ள சரஸ்வதி கார்டன் மனைப்பிரிவை அறிந்துகொள்ளுங்கள்.' },
  meenakshi_garden_phase1: { name: 'Sri Meenakshi Garden – Phase 1', location: 'Poonchuthi, Melur, Madurai', layout: 'Poonchuthi layout', intro: 'Explore Sri Meenakshi Garden Phase 1 and view its plot layout.', tamil: 'பூஞ்சுத்தி, மேலூர் பகுதியில் உள்ள ஸ்ரீ மீனாட்சி கார்டன் முதல் கட்ட மனைப்பிரிவை பார்வையிடுங்கள்.' },
  meenakshi_garden_phase2: { name: 'Sri Meenakshi Garden – Phase 2', location: 'Poonchuthi, Melur, Madurai', layout: 'Poonchuthi layout', intro: 'Explore Sri Meenakshi Garden Phase 2 and view its plot layout.', tamil: 'பூஞ்சுத்தி, மேலூர் பகுதியில் உள்ள ஸ்ரீ மீனாட்சி கார்டன் இரண்டாம் கட்ட மனைப்பிரிவை பார்வையிடுங்கள்.' },
};

function LegacyProjectLandingPage({ projectSlug }) {
  const project = LEGACY_PROJECTS[projectSlug] || {
    name: projectSlug.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()),
    location: 'Madurai, Tamil Nadu',
    layout: 'Project layout',
    intro: 'Discover this project and explore its interactive plot layout online.',
    tamil: 'இந்த மனைப்பிரிவை அறிந்துகொண்டு அதன் வரைபடத்தை ஆன்லைனில் பார்வையிடுங்கள்.',
  };
  const layoutUrl = '/' + projectSlug + '/layout';
  return (
    <main className="lp-legacy-page">
      <header className="lp-legacy-header">
        <a href="/" aria-label="Mary Ann Elite Properties home">
          <img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties" />
        </a>
      </header>
      <section className="lp-legacy-hero">
        <div className="lp-legacy-copy">
          <span className="lp-legacy-kicker">MARY ANN ELITE PROPERTIES · {project.layout.toUpperCase()}</span>
          <h1>{project.name}</h1>
          <p>{project.intro}</p>
          <p className="lp-legacy-tamil">{project.tamil}</p>
          <a className="lp-legacy-button" href={layoutUrl}>View Layout <span>↗</span></a>
          <div className="lp-legacy-facts">
            <div><small>LOCATION</small><strong>{project.location}</strong></div>
            {project.price && <div><small>INDICATIVE PRICE</small><strong>{project.price}</strong></div>}
            {project.plots && <div><small>PROJECT SIZE</small><strong>{project.plots}</strong></div>}
          </div>
        </div>
        <div className="lp-legacy-art" aria-label={project.name + ' layout illustration'}>
          <div className="lp-legacy-road" />
          <div className="lp-legacy-road lp-legacy-road-vertical" />
          {Array.from({ length: 12 }, (_, index) => <i key={index}>{String(index + 1).padStart(2, '0')}</i>)}
          <b>GREEN<br />SPACE</b>
        </div>
      </section>
      <section className="lp-legacy-highlights">
        <span className="lp-legacy-kicker">DISCOVER THE PROJECT</span>
        <h2>A closer look at <em>{project.name}.</em></h2>
        <div className="lp-legacy-cards">
          <article><b>01</b><h3>Explore the layout</h3><p>View the interactive plot map and check individual plot details online.</p></article>
          <article><b>02</b><h3>Check plot availability</h3><p>See the latest plot status displayed on the interactive layout.</p></article>
          <article><b>03</b><h3>Plan your next step</h3><p>Contact our team for verified pricing, approvals and site-visit details.</p></article>
        </div>
      </section>
      <section className="lp-legacy-location">
        <div><span className="lp-legacy-kicker">PROJECT LOCATION</span><h2>{project.location}</h2><p>Confirm current pricing, directions and approval documents with our team.</p></div>
        <a className="lp-legacy-button" href={layoutUrl}>View Layout <span>↗</span></a>
      </section>
      <section className="lp-legacy-steps">
        <span className="lp-legacy-kicker">HOW TO GET STARTED</span>
        <h2>Your plot search starts with a closer look.</h2>
        <div className="lp-legacy-cards">
          <article><b>01</b><h3>Open the layout</h3><p>Explore the interactive project map.</p></article>
          <article><b>02</b><h3>Select a plot</h3><p>Tap a plot to see its current details and status.</p></article>
          <article><b>03</b><h3>Make an enquiry</h3><p>Use the enquiry option on the map to request information.</p></article>
        </div>
      </section>
      <footer className="lp-legacy-footer">
        <img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties" />
        <span>© {new Date().getFullYear()} Mary Ann Elite Properties.</span>
        <a href={layoutUrl}>View Layout ↗</a>
      </footer>
    </main>
  );
}

export default function ProjectLandingPage({ projectSlug }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('Both');
  const [siteTab, setSiteTab] = useState('location');
  const [formMessage, setFormMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.classList.add('lp-scroll-enabled');
    return () => document.body.classList.remove('lp-scroll-enabled');
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch('/api/layout-landing?slug=' + encodeURIComponent(projectSlug), { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load this project page.');
        if (active) setContent(data.page?.content || null);
      })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectSlug]);

  const contact = content?.contact || {};
  const site = content?.site || {};
  const enquiry = content?.enquiry || {};
  const phone = cleanPhone(contact.callNumber);
  const whatsapp = cleanWhatsApp(contact.whatsappNumber || contact.callNumber);
  const whatsappHref = whatsapp ? 'https://wa.me/' + whatsapp : '';
  const photos = Array.isArray(site.photos) ? site.photos.filter(item => safeUrl(item?.url)) : [];
  const videos = Array.isArray(site.videos) ? site.videos.filter(item => safeUrl(item?.url)) : [];
  const locationUrl = safeUrl(site.mapUrl) || safeUrl(site.location);
  const locationText = locationUrl && site.location === locationUrl ? '' : text(site.location);
  const heroImage = photos[0];
  const title = language === 'Tamil' && visible(content?.hero?.titleTa) ? content.hero.titleTa : content?.hero?.title;
  const subtitle = language === 'Tamil' && visible(content?.hero?.subtitleTa) ? content.hero.subtitleTa : content?.hero?.subtitle;
  const priceRows = Array.isArray(content?.prices) ? content.prices : [];
  const highlights = Array.isArray(content?.why?.highlights) ? content.why.highlights : [];
  const audience = Array.isArray(content?.audience?.items) ? content.audience.items : [];
  const steps = Array.isArray(content?.booking?.steps) ? content.booking.steps : [];
  const faqs = Array.isArray(content?.faq) ? content.faq : [];
  const hasSiteMedia = photos.length > 0 || videos.length > 0;

  useEffect(() => {
    document.title = (text(content?.hero?.title) || projectSlug.replaceAll('_', ' ')) + ' | Mary Ann Elite Properties';
  }, [content, projectSlug]);

  const submitEnquiry = event => {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = text(data.get('name')).trim();
    const phoneNumber = text(data.get('phone')).trim();
    const size = text(data.get('size')).trim();
    if (!name || !/^[0-9+\s-]{10,15}$/.test(phoneNumber)) {
      setFormMessage('Please enter your name and a valid phone number. / பெயர் மற்றும் சரியான தொலைபேசி எண்ணை உள்ளிடவும்.');
      return;
    }
    const whatsappWindow = whatsappHref ? window.open('', '_blank') : null;
    const whatsappMessage = 'Hi, I am ' + name + '. Phone: ' + phoneNumber + (size ? '. Plot size: ' + size : '') + '. I am interested in ' + (text(content?.hero?.title) || projectSlug) + '. Please call me.';
    setFormMessage(whatsappHref
      ? 'Your enquiry is ready. Please send the message in WhatsApp to reach our team.'
      : 'Thank you. Please call our team to share your enquiry.');
    form.reset();
    if (whatsappHref) {
      const whatsappUrl = whatsappHref + '?text=' + encodeURIComponent(whatsappMessage);
      if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
      else window.location.href = whatsappUrl;
    }
  };

  if (loading) return (
    <main className="lp-loading-screen" role="status" aria-live="polite" aria-label="Loading project">
      <div className="lp-loader-content">
        <img className="lp-loader-logo" src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties" />
        <div className="lp-loader-orbit" aria-hidden="true"><span /><span /><span /></div>
        <p className="lp-loader-title">Preparing your project</p>
        <p className="lp-loader-caption">A better way to explore your next plot.</p>
        <div className="lp-loader-track" aria-hidden="true"><span /></div>
      </div>
    </main>
  );
  if (error) return <main className="lp-page"><div className="lp-state"><h1>Unable to load this project</h1><p>{error}</p></div></main>;
  if (!content) return <LegacyProjectLandingPage projectSlug={projectSlug} />;

  return (
    <main className="lp-page">
      <div className="lp-topbar-wrap">
        <header className="lp-topbar">
          <div className="lp-brand"><img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties"/></div>
          <div className="lp-language" aria-label="Choose language">
            {['English', 'Tamil', 'Both'].map(item => <button key={item} type="button" className={language === item ? 'active' : ''} onClick={() => setLanguage(item)}>{item === 'Tamil' ? 'தமிழ்' : item}</button>)}
          </div>
        </header>
      </div>

      <section className="lp-hero">
        <div className="lp-container lp-hero-inner">
          <div className="lp-hero-copy">
            {visible(content.hero?.badge) && <span className="lp-badge">{content.hero.badge}</span>}
            <h1><LanguageText english={title} tamil={content.hero?.titleTa} language={language}/></h1>
            {visible(subtitle) && <p className="lp-hero-sub"><LanguageText english={subtitle} tamil={content.hero?.subtitleTa} language={language}/></p>}
            <div className="lp-actions">
              {phone && <a className="lp-button" href={'tel:' + phone}>☎ {contact.callLabel || 'Call Now'}</a>}
              {whatsappHref && <a className="lp-button lp-button-green" href={whatsappHref} target="_blank" rel="noreferrer">▣ {contact.whatsappLabel || 'WhatsApp Us'}</a>}
              <a className="lp-button lp-button-orange" href="#enquiry">⌖ {contact.visitLabel || 'Book Site Visit'}</a>
              <a className="lp-button" href={'/' + projectSlug + '/layout'}>▦ View Layout</a>
            </div>
          </div>
          <div className="lp-hero-image">
            {heroImage ? <img src={safeUrl(heroImage.url)} alt={heroImage.alt || title || 'Project site'}/> : <div className="lp-image-placeholder"><span>MARY ANN ELITE PROPERTIES</span><strong>{text(content.hero?.title)}</strong></div>}
          </div>
        </div>
      </section>

      {content.offer?.enabled !== false && (visible(content.offer?.heading) || visible(content.offer?.description)) && (
        <div className="lp-offer-strip"><div className="lp-container"><strong>{content.offer.heading}</strong><span>{content.offer.description}</span></div></div>
      )}

      {(visible(content.why?.heading) || visible(content.why?.description) || highlights.length > 0) && (
        <section className="lp-section lp-container" id="why">
          <SectionHeading eyebrow="WHY THIS PROJECT" title={content.why?.heading || 'Why choose this project?'} tamil={content.why?.headingTa} language={language}/>
          {visible(content.why?.description) && <p className="lp-section-intro"><LanguageText english={content.why.description} tamil={content.why.descriptionTa} language={language}/></p>}
          <ul className="lp-tick-list">{highlights.map((item, index) => <li key={index}><span className="lp-check">✓</span><div><strong><LanguageText english={item.title} tamil={item.titleTa} language={language}/></strong>{visible(item.description) && <p><LanguageText english={item.description} tamil={item.descriptionTa} language={language}/></p>}</div></li>)}</ul>
        </section>
      )}

      {priceRows.length > 0 && (
        <section className="lp-section lp-soft-section" id="prices"><div className="lp-container">
          <SectionHeading eyebrow="PRICE DETAILS" title="Price Examples" tamil="விலை உதாரணம்" language={language}/>
          <div className="lp-table-wrap"><table><thead><tr><th>Plot size / மனை அளவு</th><th>Price / விலை</th><th>Note / குறிப்பு</th></tr></thead><tbody>
            {priceRows.map((row, index) => <tr key={index}><td>{row.label || row.size}</td><td className="lp-price">{row.price}</td><td>{row.note}</td></tr>)}
          </tbody></table></div>
          <p className="lp-note">Registration and other charges may be extra. / பத்திரப் பதிவு மற்றும் பிற கட்டணங்கள் தனியாக இருக்கலாம்.</p>
        </div></section>
      )}

      {audience.length > 0 && <section className="lp-section lp-container"><SectionHeading eyebrow="WHO IS IT FOR?" title={content.audience?.heading || 'Who is it for?'} tamil={content.audience?.headingTa} language={language}/><div className="lp-card-grid">{audience.map((item, index) => <article className="lp-info-card" key={index}><span>0{index + 1}</span><h3><LanguageText english={item.title} tamil={item.titleTa} language={language}/></h3><p><LanguageText english={item.description} tamil={item.descriptionTa} language={language}/></p></article>)}</div></section>}

      {steps.length > 0 && <section className="lp-section lp-dark-section"><div className="lp-container"><SectionHeading eyebrow="SIMPLE BOOKING PROCESS" title={content.booking?.heading || 'How to Book'} tamil={content.booking?.headingTa || 'முன்பதிவு செய்வது எப்படி?'} language={language}/><div className="lp-step-grid">{steps.map((step, index) => <article key={index}><b>{String(index + 1).padStart(2, '0')}</b><h3><LanguageText english={step.title} tamil={step.titleTa} language={language}/></h3><p><LanguageText english={step.description} tamil={step.descriptionTa} language={language}/></p></article>)}</div></div></section>}

      {faqs.length > 0 && <section className="lp-section lp-container" id="faq"><SectionHeading eyebrow="FREQUENTLY ASKED QUESTIONS" title="Frequently Asked Questions" tamil="அடிக்கடி கேட்கப்படும் கேள்விகள்" language={language}/><div className="lp-faq-list">{faqs.map((item, index) => <details key={index}><summary><LanguageText english={item.question} tamil={item.questionTa} language={language}/></summary><p><LanguageText english={item.answer} tamil={item.answerTa} language={language}/></p></details>)}</div></section>}

      {(visible(site.location) || locationUrl || hasSiteMedia) && <section className="lp-section lp-soft-section" id="site"><div className="lp-container">
        <SectionHeading eyebrow="VISIT THE PROJECT" title={site.heading || 'See the Site'} tamil={site.headingTa || 'இடத்தைப் பாருங்கள்'} language={language}/>
        <div className="lp-tabs" role="tablist" aria-label="Project information">
          <button type="button" role="tab" aria-selected={siteTab === 'location'} className={siteTab === 'location' ? 'active' : ''} onClick={() => setSiteTab('location')}>⌖ Site Location</button>
          <button type="button" role="tab" aria-selected={siteTab === 'photos'} className={siteTab === 'photos' ? 'active' : ''} onClick={() => setSiteTab('photos')}>▧ Site Photos</button>
          <button type="button" role="tab" aria-selected={siteTab === 'videos'} className={siteTab === 'videos' ? 'active' : ''} onClick={() => setSiteTab('videos')}>▷ Videos</button>
        </div>
        {siteTab === 'location' && <div className="lp-tab-panel"><h3>{content.hero?.title || projectSlug.replaceAll('_', ' ')}</h3>{locationText && <p>{locationText}</p>}{locationUrl && <a className="lp-button lp-button-orange" href={locationUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>}{!locationText && !locationUrl && <p>Contact us for the exact site location and directions.</p>}</div>}
        {siteTab === 'photos' && <div className="lp-tab-panel">{photos.length ? <div className="lp-gallery">{photos.map((photo, index) => <img key={index} src={safeUrl(photo.url)} alt={photo.alt || 'Project photo ' + (index + 1)}/>)}</div> : <p className="lp-empty">Site photos will be added soon. Contact us to arrange a site visit.</p>}</div>}
        {siteTab === 'videos' && <div className="lp-tab-panel">{videos.length ? <div className="lp-video-list">{videos.map((video, index) => <a key={index} href={safeUrl(video.url)} target="_blank" rel="noreferrer">▶ {video.title || 'Watch project video'} ↗</a>)}</div> : <p className="lp-empty">Site videos will be added soon.</p>}</div>}
      </div></section>}

      <section className="lp-section lp-container" id="enquiry"><SectionHeading eyebrow="GET IN TOUCH" title={enquiry.heading || 'Book Your Plot / Site Visit'} tamil={enquiry.headingTa || 'உங்கள் மனை / இடப் பார்வையைப் பதிவு செய்யுங்கள்'} language={language}/>
        <form className="lp-enquiry-form" onSubmit={submitEnquiry} noValidate>
          <label><LanguageText english={enquiry.nameLabel || 'Your Name'} tamil={enquiry.nameLabelTa || 'உங்கள் பெயர்'} language={language}/><input name="name" type="text" autoComplete="name" required/></label>
          <label><LanguageText english={enquiry.phoneLabel || 'Phone / WhatsApp Number'} tamil={enquiry.phoneLabelTa || 'தொலைபேசி / WhatsApp எண்'} language={language}/><input name="phone" type="tel" inputMode="tel" autoComplete="tel" required/></label>
          <label><LanguageText english={enquiry.plotSizeLabel || 'Plot size needed'} tamil={enquiry.plotSizeLabelTa || 'தேவையான மனை அளவு'} language={language}/><select name="size" defaultValue=""><option value="">Select / தேர்வு செய்யவும்</option><option>600 sq.ft</option><option>800 sq.ft</option><option>1000 sq.ft</option><option>1200 sq.ft</option><option>1200+ sq.ft</option></select></label>
          <input type="text" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" className="lp-honeypot" />
          <button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : (enquiry.submitLabel || 'Submit Enquiry') } 💬</button>
          {formMessage && <p className="lp-form-message" role="status">{formMessage}</p>}
        </form>
      </section>

      <section className="lp-final-cta"><div className="lp-container"><h2>{content.footer?.ctaHeading || 'Take the next step towards your own land.'}</h2>{visible(content.footer?.ctaDescription) && <p>{content.footer.ctaDescription}</p>}<div className="lp-actions lp-actions-center">{phone && <a className="lp-button" href={'tel:' + phone}>☎ {contact.callLabel || 'Call Now'}</a>}{whatsappHref && <a className="lp-button lp-button-green" href={whatsappHref} target="_blank" rel="noreferrer">▣ {contact.whatsappLabel || 'WhatsApp Us'}</a>}</div></div></section>
      <footer className="lp-footer"><img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties"/><span>{content.footer?.footerText || '© ' + new Date().getFullYear() + ' Mary Ann Elite Properties · Madurai'}</span></footer>
    </main>
  );
}
  grace_city_kalikudi_chennampatti: { name: 'Grace City, Kalikudi, Chennampatti', location: 'Kalikudi, Chennampatti, Tamil Nadu', layout: 'Grace City layout', intro: 'Explore Grace City at Kalikudi, Chennampatti and check the availability of all 187 plots through the interactive layout.', tamil: 'காளிகுடி, சென்னம்பட்டியில் அமைந்துள்ள Grace City மனைப்பிரிவின் 187 மனைகளையும் ஆன்லைனில் பார்வையிடுங்கள்.', plots: '187 plots' },
