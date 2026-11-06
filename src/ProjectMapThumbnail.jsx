import { P as SP, G as SG, bounds as SB } from './saraswathiGeometry.js';
import { P as HP, G as HG, bounds as HB } from './shanmugaGeometry.js';
import './ProjectMapThumbnail.css';

const layouts = {
  saraswathi_garden: { P: SP, G: SG, bounds: SB, labelSize: 26, lineWidth: 4 },
  shanmuga_avenue: { P: HP, G: HG, bounds: HB, labelSize: 24, lineWidth: 3 },
};

export default function ProjectMapThumbnail({ project }) {
  const layout = layouts[project.mapKey] || layouts[project.slug];
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