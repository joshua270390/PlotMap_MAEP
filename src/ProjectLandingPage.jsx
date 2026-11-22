import React, { useEffect, useMemo, useState } from 'react';
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

export default function ProjectLandingPage({ projectSlug }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('Both');
  const [siteTab, setSiteTab] = useState('location');
  const [formMessage, setFormMessage] = useState('');
  const map = '/' + projectSlug + '/layout';

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
    const data = new FormData(event.currentTarget);
    const name = text(data.get('name')).trim();
    const phoneNumber = text(data.get('phone')).trim();
    const size = text(data.get('size')).trim();
    if (!name || !/^[0-9+\s-]{10,15}$/.test(phoneNumber)) {
      setFormMessage('Please enter your name and a valid phone number. / பெயர் மற்றும் சரியான தொலைபேசி எண்ணை உள்ளிடவும்.');
      return;
    }
    if (!whatsappHref) {
      setFormMessage('WhatsApp number is not configured yet. Please call us.');
      return;
    }
    setFormMessage('');
    const message = 'Hi, I am ' + name + '. Phone: ' + phoneNumber + (size ? '. Plot size: ' + size : '') + '. I am interested in ' + (text(content?.hero?.title) || projectSlug) + '. Please call me.';
    window.open(whatsappHref + '?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
  };

  if (loading) return <main className="lp-page"><div className="lp-state">Loading project information…</div></main>;
  if (error) return <main className="lp-page"><div className="lp-state"><h1>Unable to load this project</h1><p>{error}</p></div></main>;
  if (!content) return <main className="lp-page"><header className="lp-topbar"><img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties"/></header><div className="lp-state"><h1>Project page coming soon</h1><p>Landing page content has not been published for this project yet.</p></div></main>;

  return (
    <main className="lp-page">
      <div className="lp-topbar-wrap">
        <header className="lp-topbar">
          <a className="lp-brand" href="/" aria-label="Mary Ann Elite Properties"><img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties"/></a>
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
          <button type="submit">{enquiry.submitLabel || 'Submit on WhatsApp'} 💬</button>
          {formMessage && <p className="lp-form-message" role="status">{formMessage}</p>}
        </form>
      </section>

      <section className="lp-final-cta"><div className="lp-container"><h2>{content.footer?.ctaHeading || 'Take the next step towards your own land.'}</h2>{visible(content.footer?.ctaDescription) && <p>{content.footer.ctaDescription}</p>}<div className="lp-actions lp-actions-center">{phone && <a className="lp-button" href={'tel:' + phone}>☎ {contact.callLabel || 'Call Now'}</a>}{whatsappHref && <a className="lp-button lp-button-green" href={whatsappHref} target="_blank" rel="noreferrer">▣ {contact.whatsappLabel || 'WhatsApp Us'}</a>}</div></div></section>
      <footer className="lp-footer"><img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties"/><span>{content.footer?.footerText || '© ' + new Date().getFullYear() + ' Mary Ann Elite Properties · Madurai'}</span></footer>
    </main>
  );
}
