import React, { useEffect, useState } from 'react';
import './LandingPage.css';
import { P, G } from './data.js';
import ProjectMapThumbnail from './ProjectMapThumbnail.jsx';

export default function LandingPage() {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/projects', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || !Array.isArray(data.projects)) {
          throw new Error(data.error || 'Project information is temporarily unavailable.');
        }
        if (!cancelled) setProjects(data.projects);
      })
      .catch(error => {
        if (!cancelled) setProjectsError(error.message || 'Could not load projects.');
      })
      .finally(() => { if (!cancelled) setProjectsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openProject = project => {
    window.location.href = project.route || ('/' + project.slug);
  };

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
          <p>Explore our communities through detailed plot maps. Choose a project to view its location, layout and plot availability.</p>
        </div>
        {projectsLoading ? (
          <div className="ma-project-state" role="status">Loading our projects…</div>
        ) : projectsError ? (
          <div className="ma-project-state" role="alert"><strong>Projects are temporarily unavailable.</strong><span>{projectsError}</span><button type="button" onClick={() => window.location.reload()}>Try again</button></div>
        ) : projects.length ? (
          <div className="ma-project-grid ma-plot-list-cards">
            {projects.map(project => (
              <article className="ma-plot-list-card" key={project.id || project.slug} role="link" tabIndex={0}
                onClick={() => openProject(project)}
                onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openProject(project); } }}
                aria-label={'Open ' + project.name + ' interactive plot map'}>
                <div className="ma-plot-card-visual">
                  {project.mapKey === 'velavan_nagar' ? (
                    <svg className="ma-plot-map-static" viewBox="0 0 4400 3400" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Static thumbnail of the Velavan Nagar plot layout">
                      <rect width="4400" height="3400" fill="#e8e4dc" />
                      <g fill="#363e4c">{G.base.map((d, i) => <path key={'road-' + i} d={d} />)}</g>
                      <g fill="#cdd3c3">{G.park.map((d, i) => <path key={'park-' + i} d={d} />)}</g>
                      <g fill="#ded6c6">{G.misc.map((d, i) => <path key={'misc-' + i} d={d} />)}</g>
                      <g fill="none" stroke="#e9e4d6" strokeWidth="6" strokeDasharray="34 26">{G.dash.map((d, i) => <path key={'road-mark-' + i} d={d} />)}</g>
                      <g stroke="#aab0ba" strokeWidth="8" strokeLinejoin="round">{P.map(([id, x, y, points, area, pm]) => <polygon key={id} points={points} fill={pm ? '#dcdfe5' : '#ffffff'} />)}</g>
                      <g fill="#1b2433" stroke="#ffffff" strokeWidth="10" paintOrder="stroke" fontSize="44" fontWeight="700" textAnchor="middle" dominantBaseline="central">{P.map(([id, x, y]) => <text key={'number-' + id} x={x} y={y}>{id}</text>)}</g>
                    </svg>
                  ) : <ProjectMapThumbnail project={project} />}
                  <div className="ma-plot-preview-overlay" aria-hidden="true">
                    <span className="ma-plot-visual-mark">MA</span>
                    <span className="ma-plot-visual-tag">INTERACTIVE PLOT MAP</span>
                  </div>
                </div>
                <div className="ma-plot-card-content">
                  <div className="ma-plot-card-heading">
                    <div><span className="ma-plot-card-kicker">MARY ANN ELITE PROPERTIES</span><h3>{project.name}</h3></div>
                    <span className="ma-plot-card-arrow" aria-hidden="true">↗</span>
                  </div>
                  <p className="ma-plot-card-location"><span aria-hidden="true">⌖</span> {project.location}</p>
                  <p className="ma-plot-card-description">{project.description}</p>
                  <div className="ma-plot-card-footer">
                    <span className="ma-plot-type"><span aria-hidden="true">▦</span> Interactive Plot Layout</span>
                    <span className="ma-plot-view-link">{project.mapReady ? 'View project' : 'Map coming soon'} <span aria-hidden="true">{project.mapReady ? '→' : '…'}</span></span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="ma-project-state">New projects will appear here soon.</div>}
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
