// Download the plot map SVG as a PNG image.
// plain = true -> every plot is drawn as Available (no Reserved/Booked/Sold colours).
const PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linejoin', 'stroke-linecap',
  'opacity', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-anchor', 'dominant-baseline',
  'paint-order', 'letter-spacing', 'display', 'visibility', 'filter'];
const STATUS = ['r', 'b', 's'];

const toDataUrl = (url) => fetch(url).then((r) => r.blob()).then((b) => new Promise((res) => {
  const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(url); fr.readAsDataURL(b);
})).catch(() => url);

export async function downloadMap(svg, { plain = false, name = 'plotmap' } = {}) {
  if (!svg) return;
  const live = [svg, ...svg.querySelectorAll('*')];
  const swapped = [];
  // temporarily clear selection / dimming / status so computed styles are clean
  live.forEach((el) => {
    const isP = el.tagName === 'path' && el.classList.contains('p'), isN = el.tagName === 'text' && el.classList.contains('n');
    if (!isP && !isN) return;
    const rm = ['sel', 'dim', 'hit', ...(plain ? STATUS : [])].filter((c) => el.classList.contains(c));
    if (plain && rm.some((c) => STATUS.includes(c)) && !el.classList.contains('a')) { el.classList.add('a'); rm.push('__a'); }
    if (rm.length) { rm.forEach((c) => c !== '__a' && el.classList.remove(c)); swapped.push([el, rm]); }
  });
  const styles = live.map((el) => { const cs = getComputedStyle(el); return PROPS.map((p) => [p, cs.getPropertyValue(p)]); });
  swapped.forEach(([el, rm]) => rm.forEach((c) => c === '__a' ? el.classList.remove('a') : el.classList.add(c)));

  const clone = svg.cloneNode(true);
  const cl = [clone, ...clone.querySelectorAll('*')];
  cl.forEach((el, i) => {
    const css = styles[i].filter(([, v]) => v && v !== 'normal' && v !== 'none' || false).map(([p, v]) => `${p}:${v}`).join(';');
    const keep = el.getAttribute('style') || '';
    el.setAttribute('style', css + (keep ? ';' + keep : ''));
    if (el.tagName !== 'path' || !el.classList.contains('p')) return;
    if (plain && !el.classList.contains('cc')) {
      el.style.removeProperty('fill');
      el.style.fill = styles[i].find(([p]) => p === 'fill')[1];
    }
  });
  clone.querySelectorAll('[data-enquiry-pin], title').forEach((n) => n.remove());
  await Promise.all([...clone.querySelectorAll('image')].map(async (im) => {
    const h = im.getAttribute('href') || im.getAttribute('xlink:href');
    if (h && !h.startsWith('data:')) im.setAttribute('href', await toDataUrl(h));
  }));

  const vb = (svg.getAttribute('viewBox') || '0 0 1000 1000').split(/[ ,]+/).map(Number);
  const scale = Math.min(4, Math.max(1, 5000 / vb[2]));
  const W = Math.round(vb[2] * scale), H = Math.round(vb[3] * scale);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', W); clone.setAttribute('height', H);
  clone.style.width = W + 'px'; clone.style.height = H + 'px';
  const src = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.drawImage(img, 0, 0, W, H);
  URL.revokeObjectURL(url);
  const jpg = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95))).arrayBuffer());
  const blob = jpegToPdf(jpg, W, H);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${name}${plain ? '-plain' : ''}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// Build a one-page PDF holding the map picture (no extra library needed).
function jpegToPdf(jpg, W, H) {
  const M = 24, max = 1190 - M * 2; // A3-size long side
  const k = max / Math.max(W, H), iw = +(W * k).toFixed(2), ih = +(H * k).toFixed(2);
  const pw = iw + M * 2, ph = ih + M * 2;
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const content = `q ${iw} 0 0 ${ih} ${M} ${M} cm /Im0 Do Q`;
  put('%PDF-1.4\n');
  const obj = (n, body, stream) => { offs[n] = len; put(`${n} 0 obj\n${body}\n`); if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); } put('endobj\n'); };
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
  obj(5, `<< /Length ${content.length} >>`, content);
  const x = len;
  put(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
