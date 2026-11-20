import { P as SP, G as SG, bounds as SB } from './saraswathiGeometry.js';
import { P as HP, G as HG, bounds as HB } from './shanmugaGeometry.js';
import { P as M1P, G as M1G, bounds as M1B } from './meenakshiPhase1Geometry.js';
import { P as M2P, G as M2G, bounds as M2B } from './meenakshiPhase2Geometry.js';
import './ProjectMapThumbnail.css';

const layouts = {
  saraswathi_garden: { P: SP, G: SG, bounds: SB, labelSize: 26, lineWidth: 4 },
  shanmuga_avenue: { P: HP, G: HG, bounds: HB, labelSize: 24, lineWidth: 3 },
  meenakshi_garden_phase1: { P: M1P, G: M1G, bounds: M1B, labelSize: 30, lineWidth: 3 },
  meenakshi_garden_phase2: { P: M2P, G: M2G, bounds: M2B, labelSize: 30, lineWidth: 3 },
};

export default function ProjectMapThumbnail({ project }) {
  const layout = project.geometry?.P?.length ? {
    P: project.geometry.P, G: project.geometry.G || { base: [], park: [], misc: [], dash: [] },
    bounds: project.geometry.bounds || { x: 0, y: 0, width: 2000, height: 2000 },
    labelSize: 34, lineWidth: 8,
  } : layouts[project.mapKey] || layouts[project.slug];
  if (!layout) return <div className="project-map-pending" role="img" aria-label={project.name + ' map preview unavailable'}><span className="project-visual-mark">MA</span><span className="project-visual-tag">LAYOUT MAP</span></div>;
  const { P, G, bounds: b, labelSize, lineWidth } = layout;
  return <svg className="project-map-static project-map-thumbnail" viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={'Static thumbnail of the ' + project.name + ' plot layout'}>
    <g className="preview-road">{G.base.map((d, i) => <path key={i} d={d} />)}</g>
    <g className="preview-park">{G.park.map((d, i) => <path key={i} d={d} />)}</g>
    <g className="preview-land">{G.misc.map((d, i) => <path key={i} d={d} />)}</g>
    <g className="preview-road-mark" strokeWidth="6" strokeDasharray="34 26">{G.dash.map((d, i) => <path key={i} d={d} />)}</g>
    <g className="preview-plots" strokeWidth={lineWidth}>{P.map(([id, , , points]) => <polygon key={id} points={points} />)}</g>
    <g className="preview-labels">{P.map(([id, x, y]) => <text key={id} x={x} y={y} fontSize={labelSize} strokeWidth="2">{id}</text>)}</g>
  </svg>;
}