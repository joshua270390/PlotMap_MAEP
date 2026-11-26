import React from 'react';
import './LandingPage.css';

const projects = [
  { name: 'Velavan Nagar', place: 'Kurayur, Madurai', slug: 'velavan_nagar', tag: 'Madurai' },
  { name: 'Saraswathi Garden', place: 'Madurai, Tamil Nadu', slug: 'saraswathi_garden', tag: 'Madurai' },
  { name: 'Shanmuga Avenue', place: 'Arasanur, Sivagangai', slug: 'shanmuga_avenue', tag: 'Sivagangai' },
  { name: 'Sri Meenakshi Garden – Phase 1', place: 'Poonchuthi, Melur, Madurai', slug: 'meenakshi_garden_phase1', tag: 'Melur' },
  { name: 'Sri Meenakshi Garden – Phase 2', place: 'Poonchuthi, Melur, Madurai', slug: 'meenakshi_garden_phase2', tag: 'Melur' },
];

export default function LandingPage() {
  return (
    <main className="ma-landing">
      <header className="ma-nav">
        <a className="ma-brand" href="/" aria-label="Mary Ann Elite Properties home">
          <img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties" />
        </a>
        <nav aria-label="Main navigation">
          <a href="#projects">Our Projects</a>
          <a href="#why-us">Why Mary Ann</a>
          <a className="ma-nav-cta" href="#projects">Explore Plots <span>↗</span></a>
        </nav>
      </header>

      <section className="ma-hero">
        <div className="ma-hero-copy">
          <span className="ma-eyebrow"><i /> YOUR LAND. YOUR FUTURE.</span>
          <h1>Find a place to<br /><em>grow your future.</em></h1>
          <p>Discover thoughtfully planned residential plots and land opportunities across Madurai and nearby locations with Mary Ann Elite Properties.</p>
          <div className="ma-hero-actions">
            <a className="ma-primary" href="#projects">Explore Our Projects <span>↗</span></a>
            <a className="ma-text-link" href="#why-us">Why choose us <span>↓</span></a>
          </div>
          <div className="ma-proof">
            <div><strong>10+</strong><span>Projects</span></div>
            <b className="ma-proof-line" />
            <div><strong>500+</strong><span>Happy families</span></div>
            <b className="ma-proof-line" />
            <div><strong>2+</strong><span>Years of experience</span></div>
          </div>
        </div>
        <div className="ma-hero-art" aria-label="Illustration of a plotted land community">
          <div className="ma-art-glow" />
          <div className="ma-art-label"><span>01 / LAND & LIFESTYLE</span><b>Make room for<br />what matters.</b></div>
          <div className="ma-land-card">
            <div className="ma-road ma-road-one" /><div className="ma-road ma-road-two" />
            <div className="ma-plot p1">01</div><div className="ma-plot p2">02</div><div className="ma-plot p3">03</div><div className="ma-plot p4">04</div><div className="ma-plot p5">05</div><div className="ma-plot p6">06</div>
            <div className="ma-park"><span>GREEN<br />SPACE</span></div>
            <div className="ma-compass">N <span>↑</span></div>
          </div>
          <div className="ma-floating-note"><span>⌖</span><div><b>Find your plot</b><small>Explore layouts online</small></div></div>
        </div>
        <div className="ma-hero-bottom"><span>MARY ANN ELITE PROPERTIES</span><span>LAND WITH A PLAN. FUTURE WITH CONFIDENCE.</span></div>
      </section>

      <section className="ma-projects" id="projects">
        <div className="ma-section-head">
          <div><span className="ma-kicker">EXPLORE OUR PORTFOLIO</span><h2>Projects made for<br /><em>your next chapter.</em></h2></div>
          <p>Browse our project locations and open the interactive plot layout to explore individual plots.</p>
        </div>
        <div className="ma-project-grid">
          {projects.map((project, index) => (
            <article className="ma-project-card" key={project.slug}>
              <div className={'ma-project-visual visual-' + (index + 1)}>
                <span className="ma-project-number">0{index + 1}</span>
                <div className="ma-mini-layout"><i /><i /><i /><i /><i /><i /><i /><i /><b>OPEN<br />LAND</b></div>
                <span className="ma-project-tag">{project.tag}</span>
              </div>
              <div className="ma-project-info">
                <div><h3>{project.name}</h3><p><span>⌖</span> {project.place}</p></div>
                <a href={'/' + project.slug} aria-label={'Explore ' + project.name}>↗</a>
              </div>
              <a className="ma-card-link" href={'/' + project.slug}>Explore project <span>→</span></a>
            </article>
          ))}
        </div>
      </section>

      <section className="ma-why" id="why-us">
        <div className="ma-why-intro"><span className="ma-kicker">THE MARY ANN APPROACH</span><h2>A clearer path<br />to <em>your own land.</em></h2><p>We make it easier to discover a project, understand its layout and take the next step with confidence.</p></div>
        <div className="ma-benefits">
          <div><span>01</span><section><h3>Planned communities</h3><p>Explore plotted developments designed with clear layouts and easy-to-understand plot details.</p></section></div>
          <div><span>02</span><section><h3>Explore before you visit</h3><p>View interactive project maps online and check plot-level information from your device.</p></section></div>
          <div><span>03</span><section><h3>Local project knowledge</h3><p>Discover land opportunities across Madurai and surrounding locations.</p></section></div>
        </div>
      </section>

      <section className="ma-contact" id="contact">
        <div><span className="ma-kicker">TAKE THE NEXT STEP</span><h2>Your future starts<br />with <em>one good decision.</em></h2><p>Choose a project above and explore its layout. Our team can help you with project and plot details.</p></div>
        <a href="#projects" className="ma-primary">Browse Projects <span>↗</span></a>
      </section>

      <footer className="ma-footer">
        <img src="/mary-ann-plotmap-logo.png" alt="Mary Ann Elite Properties" />
        <span>© {new Date().getFullYear()} Mary Ann Elite Properties. All rights reserved.</span>
        <a href="/dashboard">Admin sign in <span>↗</span></a>
      </footer>
    </main>
  );
}
