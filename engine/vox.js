// News Anek "Vox-style" layer: real photos, article screenshots, paper collage, camera maps, masked transitions.
// Loaded by stage.html after the core helpers (S, el, richWords, enterStyle, E, prog, clamp, W, H).
(function () {
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const lerp = (a, b, p) => a + (b - a) * p;
// seeded jitter so hand-drawn marks look the same on every frame
function rnd(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function seedOf(str) { let h = 7; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 100000; return h; }

// small credit line above the captions; every real photo / screenshot carries one
function credit(root, text, dark) {
  if (!text) return null;
  const c = el('div', 'abs', root, { left: '54px', right: '54px', top: '1214px', textAlign: 'right', font: '600 24px var(--body)',
    color: dark ? '#3a3328' : 'rgba(255,255,255,.88)', textShadow: dark ? 'none' : '0 2px 6px rgba(0,0,0,.9)' });
  c.textContent = text; return c;
}
// hand-drawn ellipse (≈1.1 turns) as an SVG path; animate with pathLength=1 + dashoffset
function scribblePath(cx, cy, rx, ry, seed) {
  const r = rnd(seed); const pts = []; const a0 = -2.2 + r() * .6, turns = 1.12, n = 64;
  for (let i = 0; i <= n; i++) { const a = a0 + turns * 2 * Math.PI * i / n; const j = 1 + (r() - .5) * .05 + (i / n) * .06;
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
  return 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
}
// annotation layer over a box of size (bw,bh); items use fractions 0..1 of the box
function annotations(parent, bw, bh, list, seedBase) {
  const svg = sv('svg', { width: bw, height: bh, viewBox: `0 0 ${bw} ${bh}` }, parent);
  Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' });
  return (list || []).map((a, i) => {
    const col = a.color || '#E11D2E', wdt = a.width || 9;
    if (a.type === 'arrow') {
      const [x1, y1, x2, y2] = [a.x1 * bw, a.y1 * bh, a.x2 * bw, a.y2 * bh]; const mx = (x1 + x2) / 2 + (y2 - y1) * .15, my = (y1 + y2) / 2 - (x2 - x1) * .15;
      const p = sv('path', { d: `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`, fill: 'none', stroke: col, 'stroke-width': wdt, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, svg);
      const ang = Math.atan2(y2 - my, x2 - mx); const hd = sv('path', { d: `M${x2 - 34 * Math.cos(ang - .45)} ${y2 - 34 * Math.sin(ang - .45)} L${x2} ${y2} L${x2 - 34 * Math.cos(ang + .45)} ${y2 - 34 * Math.sin(ang + .45)}`, fill: 'none', stroke: col, 'stroke-width': wdt, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, svg);
      return t2 => { const p2 = E.out(prog(t2, a.at || 0, a.dur || .45)); p.setAttribute('stroke-dashoffset', 1 - p2); hd.setAttribute('opacity', p2 > .95 ? 1 : 0); };
    }
    if (a.type === 'label') {
      const l = el('div', 'abs', parent, { left: (a.x * bw) + 'px', top: (a.y * bh) + 'px', transform: 'translate(-50%,-50%)', font: `800 ${a.size || 40}px var(--body)`,
        background: a.bg || '#E11D2E', color: a.fg || '#fff', padding: '4px 16px', borderRadius: '6px', whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.35)' });
      richWords(a.text || '', l);
      return t2 => { const p2 = prog(t2, a.at || 0, .35); l.style.opacity = clamp(p2 * 3); l.style.transform = `translate(-50%,-50%) scale(${.6 + .4 * E.back(p2)})`; };
    }
    // default: hand-drawn circle around a region
    const p = sv('path', { d: scribblePath(a.x * bw, a.y * bh, (a.rx || .15) * bw, (a.ry || a.rx || .15) * bh, seedBase + i), fill: 'none', stroke: col,
      'stroke-width': wdt, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, svg);
    return t2 => p.setAttribute('stroke-dashoffset', 1 - E.inout(prog(t2, a.at || 0, a.dur || .6)));
  });
}
function textureBg(root, name) {
  const b = el('div', 'abs', root, { left: '-60px', top: '-60px', width: (W + 120) + 'px', height: (H + 120) + 'px',
    background: `url(textures/${name || 'paper_dark'}.jpg) center/cover` });
  return b;
}
function treatment(img, t) {
  if (t === 'bw') img.style.filter = 'grayscale(1) contrast(1.15) brightness(.95)';
  else if (t === 'duo') img.style.filter = 'grayscale(1) contrast(1.2) brightness(1.05)';
  else if (t === 'muted') img.style.filter = 'saturate(.55) contrast(1.05)';
}
// Ken Burns presets or explicit {from:{x,y,s},to:{x,y,s}} (x,y in px offsets)
function kb(move, p) {
  const m = typeof move === 'object' ? move : ({ in: { from: { s: 1.02 }, to: { s: 1.16 } }, out: { from: { s: 1.18 }, to: { s: 1.03 } },
    left: { from: { x: 60, s: 1.15 }, to: { x: -60, s: 1.15 } }, right: { from: { x: -60, s: 1.15 }, to: { x: 60, s: 1.15 } },
    up: { from: { y: 50, s: 1.14 }, to: { y: -50, s: 1.14 } }, down: { from: { y: -50, s: 1.14 }, to: { y: 50, s: 1.14 } } }[move || 'in']);
  const f = m.from || {}, g = m.to || {};
  return `translate(${lerp(f.x || 0, g.x || 0, p)}px,${lerp(f.y || 0, g.y || 0, p)}px) scale(${lerp(f.s || 1, g.s || 1, p)})`;
}

// ---------------------------------------------------------------- photo
// frame: full (bleed) | print (photo print on paper, tape) | sticker (cut-out shape with white border)
S.photo = (sc, root) => {
  const frame = sc.frame || 'full'; let fx = [], move = null, anim;
  if (frame === 'full') {
    const wrap = el('div', 'abs', root, { left: 0, top: 0, width: W + 'px', height: H + 'px', overflow: 'hidden', background: '#000' });
    const im = el('img', '', wrap, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: sc.pos || '50% 50%' });
    im.src = sc.src; treatment(im, sc.treatment);
    if (sc.treatment === 'duo') el('div', '', wrap, { position: 'absolute', inset: 0, background: sc.tint || 'rgba(255,212,0,.35)', mixBlendMode: 'multiply' });
    el('div', '', wrap, { position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 50%,rgba(0,0,0,.82) 80%)' });
    const ann = el('div', 'abs', wrap, { left: 0, top: 0, width: W + 'px', height: H + 'px' }); fx = annotations(ann, W, H, sc.marks, seedOf(sc.id));
    move = p => { const tr = kb(sc.move, p); im.style.transform = tr; ann.style.transform = tr; };
    anim = t2 => { wrap.style.opacity = sc.transition ? 1 : E.out(prog(t2, 0, .2)); };
  } else {
    const bg = textureBg(root, sc.texture || 'paper_dark');
    const bw = sc.w || 900; const r = sc.ratio || 0.68; const bh = bw * r; const top = sc.y ?? (720 - bh / 2);
    const card = el('div', 'abs', root, { left: ((W - bw) / 2 + (sc.dx || 0)) + 'px', top: top + 'px', width: bw + 'px', height: bh + 'px' });
    const border = frame === 'sticker' ? 14 : 20;
    const face = el('div', '', card, { position: 'absolute', inset: 0, background: '#fbfaf6', padding: border + 'px', boxShadow: '0 30px 60px rgba(0,0,0,.55)',
      borderRadius: sc.shape === 'circle' ? '50%' : '3px' });
    const inner = el('div', '', face, { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: sc.shape === 'circle' ? '50%' : '0' });
    const im = el('img', '', inner, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: sc.pos || '50% 50%' });
    im.src = sc.src; treatment(im, sc.treatment);
    if (frame === 'print' && sc.tape !== false) { const tp = el('img', '', card, { position: 'absolute', left: (bw / 2 - 130) + 'px', top: '-34px', width: '260px', transform: 'rotate(-3deg)' }); tp.src = 'textures/tape.png'; }
    const ann = el('div', 'abs', inner, { left: 0, top: 0, width: (bw - 2 * border) + 'px', height: (bh - 2 * border) + 'px' }); fx = annotations(ann, bw - 2 * border, bh - 2 * border, sc.marks, seedOf(sc.id));
    const rot = sc.rot ?? -2.5;
    move = p => { im.style.transform = kb(sc.move || 'in', p); bg.style.transform = `translate(${-20 * p}px,${-12 * p}px)`; };
    anim = t2 => { const p = E.out(prog(t2, 0, .45)); card.style.opacity = clamp(prog(t2, 0, .12));
      card.style.transform = `translateY(${(1 - p) * 90}px) rotate(${rot + (1 - p) * 4}deg) scale(${1.08 - .08 * p})`; };
  }
  let txt = null;
  if (sc.text) { txt = el('div', 'abs center disp', root, { top: (sc.text_y || (frame === 'full' ? 960 : 1060)) + 'px', fontSize: (sc.size || 84) + 'px', padding: '0 70px', color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,.85)' }); richWords(sc.text, txt); }
  let kick = null; if (sc.place) { kick = el('div', 'abs', root, { left: '70px', top: (sc.place_y || 250) + 'px', font: '800 36px var(--body)', letterSpacing: '2px', color: '#fff', background: 'var(--red)', padding: '6px 18px', borderRadius: '4px' }); kick.textContent = sc.place; }
  const cr = credit(root, sc.credit, false);
  return (t2, d) => { anim(t2); move(E.inout(prog(t2, 0, d))); fx.forEach(f => f(t2)); if (txt) enterStyle(txt, prog(t2, .25, .4), 'up'); if (kick) enterStyle(kick, prog(t2, .15, .35), 'left'); if (cr) cr.style.opacity = E.out(prog(t2, .2, .3)); };
};

// ---------------------------------------------------------------- screenshot
// Real article screenshot on a paper card. crop:{x,y,w,h} (image px) picks the region shown;
// highlights:[{x,y,w,h,at}] marker strokes (image px); zoom:{at,dur,x,y,w} camera push to a region (image px).
S.screenshot = (sc, root) => {
  const bg = textureBg(root, sc.texture || 'paper_dark');
  const c = sc.crop || { x: 0, y: 0, w: sc.img_w || 1200, h: sc.img_h || 1500 };
  const cw = sc.card_w || 960, k = cw / c.w, ch = c.h * k; const top = sc.y ?? Math.max(230, 700 - ch / 2);
  const holder = el('div', 'abs', root, { left: ((W - cw) / 2) + 'px', top: top + 'px', width: cw + 'px', height: ch + 'px', transformOrigin: '0 0' });
  const card = el('div', '', holder, { position: 'absolute', inset: '-18px', background: '#fff', boxShadow: '0 34px 70px rgba(0,0,0,.6)', borderRadius: '4px' });
  const view = el('div', '', holder, { position: 'absolute', inset: 0, overflow: 'hidden' });
  const im = el('img', '', view, { position: 'absolute', left: (-c.x * k) + 'px', top: (-c.y * k) + 'px', width: ((sc.img_w || 1200) * k) + 'px' }); im.src = sc.src;
  const marks = (sc.highlights || []).map(h => {
    const m = el('div', '', view, { position: 'absolute', left: ((h.x - c.x) * k - 6) + 'px', top: ((h.y - c.y) * k) + 'px', height: (h.h * k) + 'px', width: 0,
      background: h.color || 'rgba(255,212,0,.62)', mixBlendMode: 'multiply', borderRadius: '10px 4px 10px 4px', transform: 'skewX(-6deg)' });
    return { m, h };
  });
  const ann = el('div', 'abs', view, { left: (-c.x * k) + 'px', top: (-c.y * k) + 'px', width: ((sc.img_w || 1200) * k) + 'px', height: ((sc.img_h || 1500) * k) + 'px' });
  const fx = annotations(ann, (sc.img_w || 1200) * k, (sc.img_h || 1500) * k, sc.marks, seedOf(sc.id));
  let label = null; if (sc.outlet) { label = el('div', 'abs', root, { left: '70px', top: (top - 96) + 'px', font: '800 34px var(--body)', letterSpacing: '1.5px', color: '#111', background: 'var(--accent)', padding: '6px 18px', borderRadius: '4px', textTransform: 'uppercase' }); label.textContent = sc.outlet; }
  const cr = credit(root, sc.credit || (sc.outlet ? `स्क्रीनशॉट: ${sc.outlet}${sc.date ? ' · ' + sc.date : ''}` : ''), false);
  const rot = sc.rot ?? 1.2;
  return (t2, d) => {
    const pin = E.out(prog(t2, 0, .5));
    let s = 1, tx = 0, ty = 0, pz = 0;
    if (sc.zoom) { const z = sc.zoom; pz = E.inout(prog(t2, z.at ?? .8, z.dur ?? 1)); const s1 = cw / (z.w * k); const fx0 = (z.x - c.x) * k, fy0 = (z.y - c.y) * k;
      s = lerp(1, s1, pz); tx = lerp(0, (cw / 2) - (fx0 + z.w * k / 2) * s1, pz); ty = lerp(0, (ch / 2) - (fy0 + (z.h || z.w * .3) * k / 2) * s1, pz); }
    const drift = 1 + .03 * prog(t2, 0, d);
    holder.style.transform = `translate(${tx}px,${ty + (1 - pin) * 260}px) rotate(${rot * (1 - pin * .6)}deg) scale(${s * drift})`;
    holder.style.opacity = clamp(prog(t2, 0, .15));
    bg.style.transform = `translateY(${-30 * prog(t2, 0, d)}px)`;
    marks.forEach(({ m, h }) => { const p = E.inout(prog(t2, h.at ?? .9, h.dur ?? .5)); m.style.width = ((h.w * k + 12) * p) + 'px'; });
    fx.forEach(f => f(t2));
    if (label) { enterStyle(label, prog(t2, .2, .35), 'left'); label.style.opacity = E.out(prog(t2, .2, .35)) * (1 - pz); } if (cr) cr.style.opacity = E.out(prog(t2, .3, .3));
  };
};

// ---------------------------------------------------------------- collage
// Layered paper collage: items [{src|text, kind:'photo'|'note'|'stamp', x,y,w,h?,rot,at,z,shape,credit}]
S.collage = (sc, root) => {
  const bg = textureBg(root, sc.texture || 'paper_dark');
  const layer = el('div', 'abs', root, { left: 0, top: 0, width: W + 'px', height: H + 'px' });
  const items = (sc.items || []).map((it, i) => {
    const w = it.w || 520, h = it.h || (it.kind === 'note' ? 0 : w * (it.ratio || .7));
    const box = el('div', 'abs', layer, { left: (it.x ?? 280) + 'px', top: (it.y ?? 400) + 'px', width: w + 'px', zIndex: 10 + (it.z || i) });
    if (it.kind === 'note' || it.text) {
      const n = el('div', '', box, { background: it.bg || '#F4EEDF', color: '#111', padding: '22px 28px', font: `800 ${it.size || 54}px/1.2 var(--display)`, boxShadow: '0 16px 30px rgba(0,0,0,.45)',
        clipPath: 'polygon(0 4%,4% 0,30% 3%,55% 0,80% 4%,100% 1%,98% 50%,100% 97%,70% 100%,40% 96%,12% 100%,0 96%,2% 50%)' });
      richWords(it.text || '', n);
    } else if (it.kind === 'stamp') {
      const n = el('div', '', box, { border: '8px solid #E11D2E', color: '#E11D2E', padding: '10px 22px', font: `800 ${it.size || 64}px var(--body)`, letterSpacing: '4px', textAlign: 'center', borderRadius: '8px', opacity: .92 });
      n.textContent = it.text || '';
    } else {
      const b = it.shape === 'circle' ? 14 : 16;
      const f = el('div', '', box, { position: 'relative', width: w + 'px', height: h + 'px', background: '#fbfaf6', padding: b + 'px', boxShadow: '0 22px 44px rgba(0,0,0,.55)', borderRadius: it.shape === 'circle' ? '50%' : '3px' });
      const inner = el('div', '', f, { position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: it.shape === 'circle' ? '50%' : '0' });
      const im = el('img', '', inner, { width: '100%', height: '100%', objectFit: 'cover', objectPosition: it.pos || '50% 50%' }); im.src = it.src; treatment(im, it.treatment);
      if (it.tape) { const tp = el('img', '', box, { position: 'absolute', left: (w / 2 - 110) + 'px', top: '-30px', width: '220px', transform: `rotate(${(i % 2 ? 4 : -4)}deg)` }); tp.src = 'textures/tape.png'; }
      if (it.caption) { const cpt = el('div', '', box, { marginTop: '10px', display: 'inline-block', background: '#111', color: '#fff', font: '800 34px var(--body)', padding: '4px 14px', borderRadius: '4px' }); richWords(it.caption, cpt); }
    }
    return { box, it, rot: it.rot ?? (i % 2 ? 3 : -3), z: it.z ?? (i + 1) };
  });
  const cr = credit(root, sc.credit, false);
  let title = null; if (sc.title) { title = el('div', 'abs center disp', root, { top: (sc.title_y || 1060) + 'px', fontSize: (sc.size || 80) + 'px', padding: '0 70px', color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,.9)', zIndex: 99 }); richWords(sc.title, title); }
  return (t2, d) => {
    const pd = prog(t2, 0, d);
    layer.style.transform = `scale(${1 + .06 * E.inout(pd)})`; layer.style.transformOrigin = '50% 40%';
    bg.style.transform = `translate(${-14 * pd}px,${-10 * pd}px)`;
    items.forEach(({ box, it, rot, z }) => { const p = prog(t2, it.at ?? 0, .4); const e = E.out(p);
      box.style.opacity = clamp(p * 4);
      const par = -18 * z * pd; // nearer layers drift further: parallax
      box.style.transform = `translate(${(it.from === 'left' ? -1 : it.from === 'right' ? 1 : 0) * (1 - e) * 400}px,${par + (it.from ? 0 : (1 - e) * -40)}px) rotate(${rot}deg) scale(${it.from ? 1 : 1.25 - .25 * e})`; });
    if (title) enterStyle(title, prog(t2, sc.title_at ?? .5, .4), 'up'); if (cr) cr.style.opacity = E.out(prog(t2, .3, .3));
  };
};

// ---------------------------------------------------------------- mapcam
// Real-geography map with a moving camera. cam:[{at, center:[lon,lat], zoom}] (zoom 1 = 2160 px wide world).
// pins, labels, routes (animated lines), highlight countries; optional raster basemap (equirectangular image).
S.mapcam = (sc, root) => {
  const topo = window.__WORLD; const fc = topojson.feature(topo, topo.objects.countries);
  const rast = !!(sc.basemap || sc.basemaps); const BASEW = 2160;
  const proj = (rast ? d3.geoEquirectangular() : d3.geoMercator()).scale(BASEW / (2 * Math.PI)).translate([BASEW / 2, rast ? BASEW / 4 : BASEW / 2]);
  const gp = d3.geoPath(proj);
  const ocean = sc.ocean || '#16222E', land = sc.land || '#E8DFCB', border = sc.border || '#9C8E70';
  const wrap = el('div', 'abs', root, { left: 0, top: 0, width: W + 'px', height: H + 'px', overflow: 'hidden', background: ocean });
  const svg = sv('svg', { width: W, height: H }, wrap); Object.assign(svg.style, { position: 'absolute', left: 0, top: 0 });
  const defs = sv('defs', {}, svg);
  const flt = sv('filter', { id: 'glow' + sc.id }, defs); sv('feGaussianBlur', { stdDeviation: 6, result: 'b' }, flt); const fm = sv('feMerge', {}, flt); sv('feMergeNode', { in: 'b' }, fm); sv('feMergeNode', { in: 'SourceGraphic' }, fm);
  const g = sv('g', {}, svg);
  // basemap: whole-world equirectangular image; basemaps: [{src, bbox:[lon0,lat0,lon1,lat1]}] sharper regional tiles on top
  if (sc.basemap) { const bm = sv('image', { href: sc.basemap, x: 0, y: 0, width: BASEW, height: BASEW / 2, preserveAspectRatio: 'none' }, g); if (sc.basemap_opacity) bm.setAttribute('opacity', sc.basemap_opacity); }
  (sc.basemaps || []).forEach(b => { const [x0, y0] = proj([b.bbox[0], b.bbox[3]]), [x1, y1] = proj([b.bbox[2], b.bbox[1]]);
    sv('image', { href: b.src, x: x0, y: y0, width: x1 - x0, height: y1 - y0, preserveAspectRatio: 'none', opacity: b.opacity ?? sc.basemap_opacity ?? 1 }, g); });
  const hi = {}; (sc.highlight || []).forEach(h => { const o = typeof h === 'string' ? { name: h } : h; hi[o.name.toLowerCase()] = o; });
  const hiPaths = [];
  fc.features.forEach(f => { const nm = f.properties.name.toLowerCase(); const h = hi[nm];
    const p = sv('path', { d: gp(f) || '', fill: rast ? 'none' : land, stroke: rast ? 'rgba(255,255,255,.55)' : border, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }, g);
    if (h) { const q = sv('path', { d: gp(f) || '', fill: h.color || 'var(--accent)', stroke: '#111', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', opacity: 0 }, g); hiPaths.push({ q, h }); } });
  // routes
  const routes = (sc.routes || []).map(r => {
    const pts = r.points.map(pt => proj(pt));
    let d = 'M' + pts[0].join(' ');
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const mx = (x0 + x1) / 2 - (y1 - y0) * (r.bend ?? .18), my = (y0 + y1) / 2 + (x1 - x0) * (r.bend ?? .18); d += ` Q${mx} ${my} ${x1} ${y1}`; }
    const p = sv('path', { d, fill: 'none', stroke: r.color || '#E11D2E', 'stroke-width': r.width || 7, 'stroke-linecap': 'round', filter: `url(#glow${sc.id})` }, g); // width set per frame (dash maths needs user units)
    const len = p.getTotalLength(); p.setAttribute('stroke-dasharray', r.dash ? r.dash : len); p.setAttribute('stroke-dashoffset', len);
    const head = el('div', 'abs', wrap, { width: '26px', height: '26px', borderRadius: '50%', background: r.color || '#E11D2E', border: '5px solid #fff', marginLeft: '-13px', marginTop: '-13px', opacity: 0 });
    return { r, p, len, head };
  });
  // HTML overlays (don't scale with the camera)
  const pins = (sc.pins || []).map(pn => {
    const c = el('div', 'abs', wrap, { width: '40px', height: '40px', marginLeft: '-20px', marginTop: '-20px', borderRadius: '50%', background: pn.color || 'var(--red)', border: '6px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,.5)' });
    const ring = el('div', 'abs', wrap, { width: '40px', height: '40px', marginLeft: '-20px', marginTop: '-20px', borderRadius: '50%', border: `5px solid ${pn.color || '#E11D2E'}` });
    const l = el('div', 'abs', wrap, { font: '800 42px var(--body)', background: 'rgba(10,10,10,.82)', color: '#fff', padding: '2px 14px', borderRadius: '8px', whiteSpace: 'nowrap' }); richWords(pn.label || '', l);
    return { pn, c, ring, l, xy: proj([pn.lon, pn.lat]) };
  });
  const labels = (sc.labels || []).map(lb => {
    const st = lb.style || 'country';
    const l = el('div', 'abs', wrap, { whiteSpace: 'nowrap', transform: 'translate(-50%,-50%)',
      font: st === 'sea' ? 'italic 600 40px var(--body)' : st === 'big' ? '800 64px var(--display)' : '800 40px var(--body)',
      color: st === 'sea' ? '#9EC3E6' : (rast ? '#fff' : '#2a2418'), letterSpacing: st === 'sea' ? '3px' : '1px',
      textShadow: rast || st === 'sea' ? '0 2px 8px rgba(0,0,0,.9)' : '0 0 8px rgba(255,255,255,.7)' });
    richWords(lb.text, l); return { lb, l, xy: proj([lb.lon, lb.lat]) };
  });
  let title = null; if (sc.title) { title = el('div', 'abs center disp', root, { top: (sc.title_y || 240) + 'px', fontSize: '68px', padding: '0 70px', color: '#fff', textShadow: '0 4px 18px rgba(0,0,0,.95),0 0 30px rgba(0,0,0,.6)' }); richWords(sc.title, title); }
  const cr = credit(root, sc.credit || (rast ? 'Map: NASA Blue Marble / Natural Earth' : 'Map: Natural Earth'), false);
  const cam = (sc.cam && sc.cam.length ? sc.cam : [{ at: 0, center: [60, 20], zoom: 1 }]).map(k => ({ ...k, p: proj(k.center) }));
  const cy = sc.cam_y || 760; // screen y of the camera centre (content zone 220..1260)
  function camAt(t2) {
    if (t2 <= cam[0].at || cam.length === 1) return cam[0];
    for (let i = 1; i < cam.length; i++) if (t2 < cam[i].at) { const a = cam[i - 1], b = cam[i]; const q = E.inout((t2 - a.at) / (b.at - a.at));
      const z = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), q)); return { p: [lerp(a.p[0], b.p[0], q), lerp(a.p[1], b.p[1], q)], zoom: z }; }
    return cam[cam.length - 1];
  }
  return (t2, d) => {
    const c = camAt(t2); const k = c.zoom; const tx = W / 2 - c.p[0] * k;
    const mapH = rast ? BASEW / 2 * k : BASEW * k; const ty0 = cy - c.p[1] * k, ty = mapH > H ? Math.min(0, Math.max(H - mapH, ty0)) : ty0; // never show past the poles
    g.setAttribute('transform', `translate(${tx},${ty}) scale(${k})`);
    const S2 = xy => [xy[0] * k + tx, xy[1] * k + ty];
    wrap.style.opacity = sc.transition ? 1 : E.out(prog(t2, 0, .2));
    hiPaths.forEach(({ q, h }) => { const p = prog(t2, h.at ?? .3, .4); q.setAttribute('opacity', (h.opacity ?? .85) * E.out(p) * (h.pulse ? (.8 + .2 * Math.sin(t2 * 5)) : 1)); });
    routes.forEach(({ r, p, len, head }) => { p.setAttribute('stroke-width', (r.width || 7) / k); const q = E.inout(prog(t2, r.at ?? .5, r.dur ?? 1.2)); if (!r.dash) p.setAttribute('stroke-dashoffset', len * (1 - q));
      else { p.setAttribute('stroke-dasharray', r.dash.split(/[ ,]+/).map(v => v / k).join(' ')); p.setAttribute('stroke-dashoffset', -t2 * 60 / k); p.style.opacity = q > 0 ? 1 : 0; }
      if (q > 0 && q < 1 && r.head !== false) { const pt = p.getPointAtLength(len * q); const [x, y] = S2([pt.x, pt.y]); head.style.left = x + 'px'; head.style.top = y + 'px'; head.style.opacity = 1; }
      else head.style.opacity = r.keep_head && q >= 1 ? 1 : 0; });
    pins.forEach(({ pn, c: dot, ring, l, xy }) => { const [x, y] = S2(xy); const p = prog(t2, pn.at ?? .4, .35);
      dot.style.left = ring.style.left = x + 'px'; dot.style.top = ring.style.top = y + 'px'; dot.style.opacity = clamp(p * 3); dot.style.transform = `scale(${.3 + .7 * E.back(p)})`;
      const rp = ((t2 - (pn.at ?? .4)) % 1.4) / 1.4; ring.style.opacity = p >= 1 ? (1 - rp) * .9 : 0; ring.style.transform = `scale(${1 + rp * 2.2})`;
      const side = pn.side || 'right'; l.style.left = (side === 'left' ? x - 30 : x + 34) + 'px'; l.style.top = (y - 30) + 'px'; l.style.transform = side === 'left' ? 'translateX(-100%)' : 'none';
      l.style.opacity = E.out(prog(t2, (pn.at ?? .4) + .12, .3)); });
    labels.forEach(({ lb, l, xy }) => { const [x, y] = S2(xy); l.style.left = x + 'px'; l.style.top = y + 'px'; l.style.opacity = E.out(prog(t2, lb.at ?? .2, .4)) * (lb.until && t2 > lb.until ? 0 : 1); });
    if (title) enterStyle(title, prog(t2, .15, .4), 'up'); if (cr) cr.style.opacity = E.out(prog(t2, .2, .3));
  };
};

// ---------------------------------------------------------------- headline over texture (kinetic, paper look)
S.paperhead = (sc, root) => {
  textureBg(root, sc.texture || 'paper_light');
  const box = el('div', 'abs center', root, { top: (sc.y || 560) + 'px' });
  if (sc.kicker) { const k = el('div', '', box, { marginBottom: '26px' }); el('span', 'kicker', k).textContent = sc.kicker; }
  const t = el('div', 'disp', box, { fontSize: (sc.size || 110) + 'px', color: sc.ink || '#15120d', padding: '0 70px' });
  const words = []; (Array.isArray(sc.text) ? sc.text : [sc.text]).forEach(ln => { const d = el('div', '', t); words.push(...richWords(ln, d)); });
  let sub = null; if (sc.sub) { sub = el('div', '', box, { font: '700 44px/1.3 var(--body)', color: '#4a4232', marginTop: '26px', padding: '0 90px' }); richWords(sc.sub, sub); }
  return (t2) => { words.forEach((w, i) => enterStyle(w, prog(t2, i * (sc.stagger || .07), .35), sc.anim || 'up')); if (sub) enterStyle(sub, prog(t2, .4, .4), 'up'); };
};

// ---------------------------------------------------------------- masked transitions (applied in renderAt)
window.VOX_TRANSITION = function (kind, p) { // p 0..1 of the transition; returns clip-path for the incoming scene
  const e = E.inout(p);
  switch (kind) {
    case 'wipe-left': return `inset(0 0 0 ${(1 - e) * 100}%)`;
    case 'wipe-right': return `inset(0 ${(1 - e) * 100}% 0 0)`;
    case 'wipe-up': return `inset(${(1 - e) * 100}% 0 0 0)`;
    case 'circle': return `circle(${e * 120}% at ${50}% 45%)`;
    case 'diagonal': { const x = e * 220 - 60; return `polygon(0 0, ${x}% 0, ${x - 60}% 100%, 0 100%)`; }
    case 'blinds': { const n = 6; let s = 'polygon('; const pts = []; for (let i = 0; i < n; i++) { const y0 = i / n * 100, y1 = y0 + 100 / n * e; pts.push(`0 ${y0}%`, `100% ${y0}%`, `100% ${y1}%`, `0 ${y1}%`); } return s + pts.join(',') + ')'; }
    default: return 'none';
  }
};
})();
