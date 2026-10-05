/* ===================== scenery: everything that goes by the window, drawn on a canvas ===================== */
// Plain drawing functions, so cockpit.js can schedule and move them. Each draws around (0, 0) at a given size.
// Written for older TV browsers too: no ?. or ?? here.

/* ---------- noise ---------- */
function noiseHash(ix, iy, seed){
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise, repeating every `period` units across x, so a strip of sky can wrap round seamlessly. */
function vnoise(x, y, period, seed){
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period, x1 = (x0 + 1) % period;
  const a = noiseHash(x0, yi, seed), b = noiseHash(x1, yi, seed), c = noiseHash(x0, yi + 1, seed), d = noiseHash(x1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, period, seed, octaves){
  let s = 0, amp = .5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++){ s += amp * vnoise(x * f, y * f, period * f, seed + i * 17); norm += amp; amp *= .5; f *= 2; }
  return s / norm;
}
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
function sprite(w, h, draw){ const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); draw(c.getContext('2d'), c.width, c.height); return c; }
function glowSprite(size, rgb, core){
  return sprite(size, size, (c, s) => {
    const m = s / 2, g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, `rgba(255,255,255,${core == null ? 1 : core})`); g.addColorStop(.12, `rgba(${rgb},.9)`); g.addColorStop(.38, `rgba(${rgb},.2)`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  });
}

/* ---------- planets: lit spheres with weather, oceans or bands, rendered once as they come into view ---------- */
const PLANETS = {
  gas:   { bands: [[244, 230, 205], [214, 166, 112], [168, 98, 62], [236, 206, 160]], atm: [255, 214, 170], rings: .7 },
  ice:   { bands: [[232, 246, 255], [176, 222, 246], [120, 178, 226], [208, 236, 252]], atm: [170, 220, 255], rings: .6 },
  rock:  { bands: [[188, 112, 84], [128, 70, 56], [214, 156, 112], [92, 52, 46]], atm: [255, 170, 140], rings: 0 },
  ocean: { bands: [[18, 52, 128], [44, 118, 190], [74, 130, 80], [196, 176, 128]], atm: [120, 190, 255], rings: 0 }
};
/** Returns a half-resolution canvas of the planet and its glow; draw it at twice the size. */
function renderPlanet(kind, R, seed){
  const P = PLANETS[kind], r = Math.max(24, Math.round(R / 2)), pad = Math.round(r * .22), size = 2 * (r + pad);
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
  const c = cv.getContext('2d'), img = c.createImageData(size, size), px = img.data, L = [-.58, -.42, .7], ln = Math.hypot(L[0], L[1], L[2]);
  L[0] /= ln; L[1] /= ln; L[2] /= ln;
  const spotU = 1 + noiseHash(seed, 1, 3) * 2, spotV = (noiseHash(seed, 2, 3) - .5) * .5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
    const dx = (x + .5 - size / 2) / r, dy = (y + .5 - size / 2) / r, d2 = dx * dx + dy * dy, i = (y * size + x) * 4;
    const edge = clamp((1 - Math.sqrt(d2)) * r + .5, 0, 1);   // anti-aliased limb
    // the atmosphere's glow around the edge, brightest on the sunlit side
    const hh = Math.sqrt(d2), glow = hh > .97 && hh < 1.2 ? Math.pow(1 - Math.max(0, hh - 1) / .2, 2.2) * (.25 + .75 * smoothstep(-.6, .6, dx * L[0] + dy * L[1])) * .7 : 0;
    if (edge <= 0){
      if (glow > 0){ px[i] = P.atm[0]; px[i + 1] = P.atm[1]; px[i + 2] = P.atm[2]; px[i + 3] = glow * 255; }
      continue;
    }
    const dd = Math.sqrt(d2), k0 = dd > .985 ? .985 / dd : 1, sx = dx * k0, sy = dy * k0;
    const dz = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy)), lon = Math.atan2(sx, dz), lat = Math.asin(sy), u = (lon / Math.PI + 1) * 2, v = lat / (Math.PI / 2);
    let col, city = 0;
    if (kind === 'gas' || kind === 'ice'){
      const turb = fbm(u * 1.6, v * 5, 64, seed, 4), b = v * (kind === 'gas' ? 7 : 4) + turb * (kind === 'gas' ? 2.4 : 1.2), t = .5 + .5 * Math.sin(b * Math.PI);
      col = t < .5 ? lerp3(P.bands[0], P.bands[1], t * 2) : lerp3(P.bands[1], P.bands[2], (t - .5) * 2);
      col = lerp3(col, P.bands[3], smoothstep(.55, .8, fbm(u * 3, v * 9, 64, seed + 5, 3)) * .5);
      const sd = Math.pow((u - spotU) / .32, 2) + Math.pow((v - spotV) / .12, 2);
      if (kind === 'gas' && sd < 1) col = lerp3(col, [196, 92, 64], (1 - sd) * .8);
    } else if (kind === 'rock'){
      const n = fbm(u * 3, v * 3, 64, seed, 5), cr = fbm(u * 9, v * 9, 64, seed + 9, 3);
      col = lerp3(P.bands[1], P.bands[0], n); col = lerp3(col, P.bands[2], smoothstep(.62, .75, n) * .6);
      if (cr > .64) col = lerp3(col, P.bands[3], smoothstep(.64, .72, cr) * .7); else if (cr > .6) col = lerp3(col, P.bands[2], .35);
    } else {
      const h = fbm(u * 2.2, v * 2.2, 64, seed, 6), land = h > .56;
      col = land ? lerp3(P.bands[2], P.bands[3], smoothstep(.56, .7, h)) : lerp3(P.bands[0], P.bands[1], smoothstep(.35, .56, h));
      if (Math.abs(v) > .8) col = lerp3(col, [240, 248, 255], smoothstep(.8, .9, Math.abs(v)));
      const cl = fbm(u * 3 + 7, v * 6, 64, seed + 3, 5);
      col = lerp3(col, [248, 250, 255], smoothstep(.52, .72, cl) * .9);
      city = land && cl < .5 ? smoothstep(.62, .7, fbm(u * 14, v * 14, 64, seed + 21, 2)) * .7 : 0;
    }
    const ndl = sx * L[0] + sy * L[1] + dz * L[2], lit = smoothstep(-.2, .35, ndl) * .94 + .03;
    const rim = Math.pow(1 - dz, 3) * smoothstep(-.35, .4, ndl) * .5;
    let rr = col[0] * lit + P.atm[0] * rim, gg = col[1] * lit + P.atm[1] * rim, bb = col[2] * lit + P.atm[2] * rim;
    if (kind === 'ocean' && city > 0 && ndl < -.05){ const k = city * smoothstep(-.05, -.3, ndl) * smoothstep(.15, .45, dz); rr += 255 * k; gg += 190 * k; bb += 110 * k; }
    // blend the edge pixels over the glow, so the limb has no dark seam
    const ga = edge < 1 ? glow * (1 - edge) : 0, a = edge + ga;
    rr = (Math.min(255, rr) * edge + P.atm[0] * ga) / a; gg = (Math.min(255, gg) * edge + P.atm[1] * ga) / a; bb = (Math.min(255, bb) * edge + P.atm[2] * ga) / a;
    px[i] = rr; px[i + 1] = gg; px[i + 2] = bb; px[i + 3] = 255 * a;
  }
  c.putImageData(img, 0, 0);
  return { canvas: cv, r, pad };
}
/** A planet's rings, as a back half (behind the planet) and a front half (in front of it). */
function renderRings(kind, R, seed){
  const P = PLANETS[kind], w = R * 4.6, h = R * 1.3, cx = w / 2, cy = h / 2, tilt = -.16;
  const full = sprite(w, h, c => {
    c.translate(cx, cy); c.rotate(tilt); c.scale(1, .26);
    for (let k = 0; k < 70; k++){
      const rr = R * (1.25 + k / 70 * 1.0), a = .05 + .5 * Math.pow(noiseHash(k, seed, 7), 2) * (k > 20 && k < 26 ? .1 : 1);
      const col = lerp3(P.bands[0], P.bands[1], noiseHash(k, seed, 11));
      c.strokeStyle = rgba(col, a); c.lineWidth = R * 1.0 / 70 * 1.2; c.beginPath(); c.arc(0, 0, rr, 0, Math.PI * 2); c.stroke();
    }
  });
  const half = top => sprite(w, h, c => { c.beginPath(); c.save(); c.translate(cx, cy); c.rotate(tilt); c.rect(-w, top ? -h : 0, w * 2, h); c.restore(); c.clip(); c.drawImage(full, 0, 0); });
  return { back: half(true), front: half(false), w, h };
}

/* ---------- the moon, in its real phase ---------- */
function drawMoon(c, x, y, r, phase){
  const g = c.createRadialGradient(x, y, r, x, y, r * 3.2); g.addColorStop(0, `rgba(220,226,255,${.1 + .1 * phase.illum})`); g.addColorStop(1, 'rgba(220,226,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3.2, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
  c.fillStyle = '#1c1f30'; c.fillRect(x - r, y - r, r * 2, r * 2);                          // the dark limb, faintly lit by earthshine
  const lit = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r * 1.1); lit.addColorStop(0, '#f4f2ea'); lit.addColorStop(1, '#a9acbd');
  c.fillStyle = lit; c.beginPath();
  // The lit part: a half disc on the sunward side, plus or minus an ellipse for the terminator.
  const k = Math.cos(phase.f * 2 * Math.PI), side = phase.waxing ? 1 : -1;
  c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, side < 0);
  c.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === (side > 0));
  c.fill();
  c.fillStyle = 'rgba(80,84,110,.28)';
  [[-.3, -.1, .22], [.25, .3, .16], [.1, -.42, .1], [-.18, .42, .12], [.42, -.12, .08]].forEach(m => { c.beginPath(); c.arc(x + m[0] * r, y + m[1] * r, m[2] * r, 0, 7); c.fill(); });
  c.restore();
}

/* ---------- traffic ---------- */
const SHIPS = {
  satellite(c, s, a, near, t){
    c.rotate(a * .3);
    c.fillStyle = `rgb(${Math.round(70 + 110 * near)},${Math.round(76 + 104 * near)},${Math.round(110 + 100 * near)})`; c.fillRect(-s * .35, -s * .25, s * .7, s * .5);
    c.fillStyle = `rgba(50,110,210,${.55 + .4 * near})`; c.strokeStyle = 'rgba(170,215,255,.55)'; c.lineWidth = Math.max(.5, s * .03);
    [-1, 1].forEach(d => { const x0 = d > 0 ? s * .45 : -s * 1.75; c.fillRect(x0, -s * .22, s * 1.3, s * .44); c.strokeRect(x0, -s * .22, s * 1.3, s * .44);
      for (let k = 1; k < 4; k++){ c.beginPath(); c.moveTo(x0 + k * s * .325, -s * .22); c.lineTo(x0 + k * s * .325, s * .22); c.stroke(); } });
    c.fillStyle = Math.sin(t / 400) > 0 ? '#ff6b7d' : 'rgba(255,107,125,.2)'; c.beginPath(); c.arc(0, -s * .3, Math.max(1, s * .07), 0, 7); c.fill();
  },
  freighter(c, s, a, near, t){
    const L = s * 3.4, h = s * .55;
    const e = c.createLinearGradient(L / 2, 0, L / 2 + s * 4, 0); e.addColorStop(0, 'rgba(120,230,255,.55)'); e.addColorStop(1, 'rgba(79,214,255,0)');
    c.fillStyle = e; c.fillRect(L / 2, -h * .35, s * 4, h * .7);                                // engine trail behind
    const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, `rgb(${Math.round(80 + 110 * near)},${Math.round(84 + 104 * near)},${Math.round(118 + 90 * near)})`); g.addColorStop(1, '#141728');
    c.fillStyle = g; c.beginPath(); c.moveTo(L / 2, -h * .6); c.lineTo(-L / 2 + h, -h); c.quadraticCurveTo(-L / 2 - h * .5, 0, -L / 2 + h, h); c.lineTo(L / 2, h * .6); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,214,140,.9)'; for (let k = 0; k < 8; k++) c.fillRect(-L / 2 + L * (.18 + k * .085), -h * .25, Math.max(1, s * .08), Math.max(1, s * .07));
    c.fillStyle = Math.sin(t / 300) > .3 ? '#46e6a1' : 'rgba(70,230,161,.2)'; c.beginPath(); c.arc(-L / 2 + h * .6, -h * .9, Math.max(1, s * .06), 0, 7); c.fill();
  },
  station(c, s, a, near){
    const R = s * 2.2, col = `rgba(${Math.round(150 + 100 * near)},${Math.round(160 + 90 * near)},${Math.round(200 + 55 * near)},`;
    c.save(); c.scale(1, .42); c.lineWidth = Math.max(1, s * .3); c.strokeStyle = col + '.9)'; c.beginPath(); c.arc(0, 0, R, 0, 7); c.stroke();
    c.lineWidth = Math.max(.5, s * .06); c.strokeStyle = col + '.5)';
    for (let k = 0; k < 4; k++){ const an = a + k * Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an) * R, Math.sin(an) * R); c.stroke(); }
    c.fillStyle = 'rgba(255,214,140,.85)';
    for (let k = 0; k < 18; k++){ const an = a + k * Math.PI / 9; c.beginPath(); c.arc(Math.cos(an) * R, Math.sin(an) * R, Math.max(.8, s * .07), 0, 7); c.fill(); }
    c.restore(); c.fillStyle = col + '1)'; c.beginPath(); c.arc(0, 0, s * .45, 0, 7); c.fill();
  },
  asteroid(c, s, a, near){
    c.rotate(a); const r = s * 1.1, g = c.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r);
    g.addColorStop(0, `rgb(${Math.round(110 + 70 * near)},${Math.round(98 + 62 * near)},${Math.round(112 + 52 * near)})`); g.addColorStop(1, '#14111c');
    c.fillStyle = g; c.beginPath(); for (let i = 0; i < 11; i++){ const an = i / 11 * 6.283, rr = r * (.75 + .25 * Math.sin(i * 2.3 + 1)); c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; [[.3, .2, .2], [-.25, .35, .14], [.05, -.35, .12]].forEach(k => { c.beginPath(); c.arc(k[0] * r, k[1] * r, k[2] * r, 0, 7); c.fill(); });
  }
};

/* ---------- the real International Space Station ---------- */
function drawISS(c, s, t){
  c.strokeStyle = '#c9d2e8'; c.lineWidth = Math.max(1, s * .05);
  c.beginPath(); c.moveTo(-s * 2.2, 0); c.lineTo(s * 2.2, 0); c.stroke();                            // the main truss
  for (let k = -3; k <= 3; k++){ if (!k) continue;
    const x = k * s * .62, g = c.createLinearGradient(x, -s, x, s); g.addColorStop(0, '#d6a54a'); g.addColorStop(.5, '#7a5a26'); g.addColorStop(1, '#d6a54a');
    c.fillStyle = g; c.fillRect(x - s * .12, -s * 1.15, s * .24, s * .95); c.fillRect(x - s * .12, s * .2, s * .24, s * .95); }
  c.fillStyle = '#e8ecf6'; c.fillRect(-s * .55, -s * .16, s * 1.1, s * .32); c.fillRect(-s * .12, -s * .6, s * .24, s * 1.2);
  c.fillStyle = '#9fb4d8'; c.fillRect(s * .2, -s * .4, s * .5, s * .16);
  c.fillStyle = Math.sin(t / 500) > 0 ? '#ffffff' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(s * .6, 0, Math.max(1.2, s * .08), 0, 7); c.fill();
}

/* ---------- your house: a Harold Street terrace on its own asteroid ---------- */
const BIN_RGB = { black: [42, 45, 58], blue: [47, 123, 255], brown: [138, 90, 50], green: [47, 179, 107], grey: [138, 144, 168], purple: [143, 107, 255], red: [229, 72, 77], yellow: [255, 209, 102] };
const LANTERN = { neg: [184, 146, 255], good: [70, 230, 161], warn: [255, 209, 102], bad: [255, 107, 125] };
/** u is one unit of the drawing; the house is about 100 units wide. h is the house's state from worldFor. */
function drawHouse(c, u, h, t, smoke, amb){
  // the rock
  const rock = c.createRadialGradient(-30 * u, 10 * u, 10 * u, 0, 30 * u, 140 * u); rock.addColorStop(0, '#5a5068'); rock.addColorStop(1, '#16131f');
  c.fillStyle = rock; c.beginPath(); c.moveTo(-120 * u, 0);
  [[-112, 30], [-90, 58], [-60, 80], [-30, 104], [0, 116], [26, 98], [58, 84], [88, 60], [112, 30], [122, 0]].forEach(p => c.lineTo(p[0] * u, p[1] * u));
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,.25)'; [[-60, 40, 10], [20, 70, 13], [70, 34, 8], [-20, 86, 7]].forEach(p => { c.beginPath(); c.arc(p[0] * u, p[1] * u, p[2] * u, 0, 7); c.fill(); });
  c.strokeStyle = rgba(amb || [150, 166, 255], .45); c.lineWidth = Math.max(1, u * 1.4); c.beginPath(); c.moveTo(-120 * u, 0);
  [[-112, 30], [-90, 58], [-60, 80], [-30, 104], [0, 116]].forEach(p => c.lineTo(p[0] * u, p[1] * u)); c.stroke();
  c.fillStyle = '#3f8a52'; c.fillRect(-120 * u, -4 * u, 242 * u, 6 * u);                             // the lawn
  c.fillStyle = '#7d7a86'; c.fillRect(-14 * u, -2 * u, 18 * u, 4 * u);                               // the path
  // the terrace: brick front, slate roof, chimney, bay window downstairs
  const brick = c.createLinearGradient(0, -100 * u, 0, 0); brick.addColorStop(0, '#9c4a36'); brick.addColorStop(1, '#6e3024');
  c.fillStyle = brick; c.fillRect(-50 * u, -92 * u, 100 * u, 90 * u);
  c.strokeStyle = 'rgba(40,14,10,.35)'; c.lineWidth = Math.max(.5, u * .6);
  for (let y = -88; y < -2; y += 6){ c.beginPath(); c.moveTo(-50 * u, y * u); c.lineTo(50 * u, y * u); c.stroke(); }
  c.fillStyle = '#3a3f55'; c.beginPath(); c.moveTo(-56 * u, -92 * u); c.lineTo(-40 * u, -122 * u); c.lineTo(40 * u, -122 * u); c.lineTo(56 * u, -92 * u); c.closePath(); c.fill();
  c.fillStyle = '#7c3a2a'; c.fillRect(22 * u, -138 * u, 14 * u, 22 * u); c.fillStyle = '#5a2a20'; c.fillRect(20 * u, -140 * u, 18 * u, 4 * u);
  c.fillStyle = '#b3664a'; c.fillRect(24 * u, -146 * u, 4 * u, 6 * u); c.fillRect(30 * u, -146 * u, 4 * u, 6 * u);
  // windows: they glow with how much power the house is drawing
  const glow = h.glow, warm = [255, 196, 110];
  const win = (x, y, w, hh) => {
    c.fillStyle = rgba(lerp3([30, 34, 52], warm, glow), 1); c.fillRect(x * u, y * u, w * u, hh * u);
    if (glow > .25){ const g = c.createRadialGradient((x + w / 2) * u, (y + hh / 2) * u, 0, (x + w / 2) * u, (y + hh / 2) * u, w * 1.4 * u);
      g.addColorStop(0, `rgba(255,190,100,${.35 * glow})`); g.addColorStop(1, 'rgba(255,190,100,0)'); c.fillStyle = g; c.fillRect((x - w) * u, (y - hh) * u, w * 3 * u, hh * 3 * u); }
    c.strokeStyle = '#e8e2d6'; c.lineWidth = Math.max(.6, u * 1.2); c.strokeRect(x * u, y * u, w * u, hh * u);
    c.beginPath(); c.moveTo((x + w / 2) * u, y * u); c.lineTo((x + w / 2) * u, (y + hh) * u); c.moveTo(x * u, (y + hh / 2) * u); c.lineTo((x + w) * u, (y + hh / 2) * u); c.stroke();
  };
  win(-38, -80, 22, 26); win(14, -80, 22, 26);
  c.fillStyle = '#5a2a20'; c.fillRect(-44 * u, -44 * u, 40 * u, 42 * u); win(-40, -40, 32, 30);    // the bay window
  // a television flickers blue in the bay on a dark evening
  if (h.dark && glow > .35){ c.fillStyle = `rgba(110,160,255,${.12 + .1 * Math.sin(t / 170) * Math.sin(t / 61)})`; c.fillRect(-40 * u, -40 * u, 32 * u, 30 * u); }
  c.fillStyle = '#1f3b6b'; c.fillRect(10 * u, -40 * u, 18 * u, 38 * u); c.fillStyle = rgba(lerp3([40, 40, 60], warm, glow * .8), 1); c.fillRect(12 * u, -46 * u, 14 * u, 5 * u);
  c.fillStyle = '#d6b45a'; c.beginPath(); c.arc(24 * u, -20 * u, 1.4 * u, 0, 7); c.fill();
  // the lantern by the door shows the power price
  const lc = LANTERN[h.lantern] || LANTERN.warn, lg = c.createRadialGradient(36 * u, -36 * u, 0, 36 * u, -36 * u, 14 * u);
  lg.addColorStop(0, rgba(lc, .9)); lg.addColorStop(1, rgba(lc, 0)); c.fillStyle = lg; c.fillRect(22 * u, -50 * u, 28 * u, 28 * u);
  c.fillStyle = rgba(lc, 1); c.fillRect(34 * u, -39 * u, 4 * u, 6 * u);
  // the bins, out when they're due
  (h.bins || []).forEach((b, i) => {
    const x = (60 + i * 16) * u, col = BIN_RGB[b] || BIN_RGB.grey;
    c.fillStyle = rgba(col, 1); c.fillRect(x, -22 * u, 12 * u, 20 * u); c.fillStyle = rgba(lerp3(col, [0, 0, 0], .3), 1); c.fillRect(x - 1 * u, -24 * u, 14 * u, 3 * u);
    c.fillStyle = '#111'; c.beginPath(); c.arc(x + 2 * u, -2 * u, 2 * u, 0, 7); c.fill();
  });
  // light from the upper left: the right of the house falls into shade
  const sh = c.createLinearGradient(-50 * u, 0, 56 * u, 0); sh.addColorStop(0, 'rgba(255,240,220,.06)'); sh.addColorStop(.55, 'rgba(6,8,24,0)'); sh.addColorStop(1, 'rgba(6,8,24,.4)');
  c.fillStyle = sh; c.fillRect(-50 * u, -92 * u, 100 * u, 90 * u);
  c.beginPath(); c.moveTo(-56 * u, -92 * u); c.lineTo(-40 * u, -122 * u); c.lineTo(40 * u, -122 * u); c.lineTo(56 * u, -92 * u); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = Math.max(.6, u); c.beginPath(); c.moveTo(-56 * u, -92 * u); c.lineTo(-40 * u, -122 * u); c.lineTo(40 * u, -122 * u); c.stroke();
  // the lamp post, and the street sign
  c.fillStyle = '#2a2d3d'; c.fillRect(-92 * u, -60 * u, 3 * u, 58 * u);
  const sg = c.createRadialGradient(-90 * u, -62 * u, 0, -90 * u, -62 * u, 22 * u); sg.addColorStop(0, 'rgba(255,220,150,.75)'); sg.addColorStop(1, 'rgba(255,220,150,0)');
  c.fillStyle = sg; c.fillRect(-112 * u, -84 * u, 44 * u, 44 * u);
  c.fillStyle = '#f2efe6'; c.fillRect(-84 * u, -26 * u, 28 * u, 9 * u); c.fillStyle = '#1b1b1b'; c.font = `bold ${Math.max(4, 5 * u)}px sans-serif`; c.textAlign = 'center';
  c.fillText('HAROLD ST', -70 * u, -19.5 * u);
  // chimney smoke, drifting back as we pass
  if (smoke) smoke.forEach(p => { const g = c.createRadialGradient(p.x * u, p.y * u, 0, p.x * u, p.y * u, p.r * u); g.addColorStop(0, `rgba(205,210,225,${p.a})`); g.addColorStop(1, 'rgba(205,210,225,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x * u, p.y * u, p.r * u, 0, 7); c.fill(); });
}

/* ---------- wildlife ---------- */
/** A space whale, swimming left. u is one unit; it's about 260 units long. */
function drawWhale(c, u, t, hue){
  const sw = Math.sin(t / 900), tail = sw * 16;
  const body = c.createLinearGradient(0, -40 * u, 0, 40 * u);
  body.addColorStop(0, `hsla(${hue},70%,62%,.85)`); body.addColorStop(.6, `hsla(${hue + 20},60%,32%,.85)`); body.addColorStop(1, `hsla(${hue + 30},60%,18%,.8)`);
  c.fillStyle = body; c.beginPath(); c.moveTo(-130 * u, 0);
  c.bezierCurveTo(-130 * u, -36 * u, -60 * u, -46 * u, 0, -36 * u);
  c.bezierCurveTo(60 * u, -26 * u, 100 * u, -12 * u + tail * u * .3, 130 * u, tail * u * .5);
  c.bezierCurveTo(100 * u, 14 * u + tail * u * .3, 50 * u, 30 * u, -20 * u, 34 * u);
  c.bezierCurveTo(-90 * u, 38 * u, -130 * u, 26 * u, -130 * u, 0); c.fill();
  c.beginPath(); c.moveTo(126 * u, tail * u * .5);                                                     // tail flukes
  c.quadraticCurveTo(150 * u, (tail - 34) * u, 168 * u, (tail - 30) * u); c.quadraticCurveTo(150 * u, tail * u * .6, 168 * u, (tail + 30) * u);
  c.quadraticCurveTo(150 * u, (tail + 34) * u, 126 * u, tail * u * .5); c.fill();
  c.beginPath(); c.moveTo(-50 * u, 20 * u); c.quadraticCurveTo(-30 * u, (52 + sw * 8) * u, 0, (48 + sw * 10) * u); c.quadraticCurveTo(-20 * u, 30 * u, -26 * u, 24 * u); c.fill();
  c.strokeStyle = `hsla(${hue + 160},90%,80%,.35)`; c.lineWidth = Math.max(.6, u * 1.5);              // throat grooves
  for (let k = 0; k < 4; k++){ c.beginPath(); c.moveTo(-118 * u, (12 + k * 5) * u); c.quadraticCurveTo(-70 * u, (24 + k * 5) * u, -30 * u, (26 + k * 3) * u); c.stroke(); }
  for (let k = 0; k < 12; k++){                                                                         // bioluminescent spots
    const x = (-100 + k * 18) * u, y = (-14 + Math.sin(k * 1.7) * 8) * u, a = .5 + .4 * Math.sin(t / 600 + k);
    const g = c.createRadialGradient(x, y, 0, x, y, 6 * u); g.addColorStop(0, `hsla(${hue + 150},100%,85%,${a})`); g.addColorStop(1, `hsla(${hue + 150},100%,70%,0)`);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 6 * u, 0, 7); c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(-102 * u, -6 * u, 2.2 * u, 0, 7); c.fill();
}
/** A drifting jellyfish: a pulsing bell and slow tentacles. u is one unit; it's about 60 units across. */
function drawJelly(c, u, t, hue, seed){
  const pulse = 1 + .12 * Math.sin(t / 700 + seed), w = 30 * u * pulse, h = 24 * u / pulse;
  c.strokeStyle = `hsla(${hue},90%,75%,.45)`; c.lineWidth = Math.max(.6, u * 1.4);
  for (let k = 0; k < 7; k++){
    const x0 = (-22 + k * 7.3) * u; c.beginPath(); c.moveTo(x0, 0);
    for (let s = 1; s <= 6; s++) c.lineTo(x0 + Math.sin(t / 800 + k + s * .7 + seed) * 5 * u * s / 3, s * 14 * u);
    c.stroke();
  }
  const g = c.createRadialGradient(0, -h * .4, 0, 0, 0, w * 1.4); g.addColorStop(0, `hsla(${hue},100%,88%,.9)`); g.addColorStop(.5, `hsla(${hue},90%,62%,.55)`); g.addColorStop(1, `hsla(${hue},90%,50%,0)`);
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, w * 1.4, h * 1.6, 0, Math.PI, 0); c.fill();
  c.fillStyle = `hsla(${hue},90%,72%,.7)`; c.beginPath(); c.ellipse(0, 0, w, h, 0, Math.PI, 0); c.closePath(); c.fill();
  c.strokeStyle = `hsla(${hue + 30},100%,90%,.8)`; c.lineWidth = Math.max(.6, u); c.beginPath(); c.ellipse(0, 0, w, h * .25, 0, 0, Math.PI); c.stroke();
}
/** One light-bird: a glowing chevron, wings beating. */
function drawBird(c, u, t, seed){
  const flap = Math.sin(t / 140 + seed) * 7 * u;
  const tr = c.createLinearGradient(0, 0, 46 * u, 0); tr.addColorStop(0, 'rgba(255,190,120,.45)'); tr.addColorStop(1, 'rgba(255,150,120,0)');   // a trail of light
  c.fillStyle = tr; c.beginPath(); c.moveTo(0, -1.6 * u); c.lineTo(46 * u, 0); c.lineTo(0, 1.6 * u); c.fill();
  c.strokeStyle = 'rgba(255,226,170,.85)'; c.lineWidth = Math.max(1, u * 1.3); c.lineCap = 'round';
  c.beginPath(); c.moveTo(-12 * u, -flap); c.quadraticCurveTo(-5 * u, -flap * .3, 0, 0); c.quadraticCurveTo(5 * u, -flap * .3, 12 * u, -flap); c.stroke();
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 10 * u); g.addColorStop(0, 'rgba(255,220,150,.6)'); g.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 10 * u, 0, 7); c.fill();
}

/* ---------- a comet, its tail in the colours of the bins going out ---------- */
function drawComet(c, x, y, len, ang, colours, t){
  const tint = k => k === 'black' ? [205, 212, 230] : BIN_RGB[k] || BIN_RGB.grey;
  const cols = colours.length ? colours.map(tint) : [[200, 230, 255]];
  c.save(); c.translate(x, y); c.rotate(ang); c.globalCompositeOperation = 'lighter';
  const halo = c.createLinearGradient(0, 0, len * 1.1, 0); halo.addColorStop(0, 'rgba(190,220,255,.35)'); halo.addColorStop(1, 'rgba(190,220,255,0)');
  c.fillStyle = halo; c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(len * .55, -len * .1, len * 1.1, -len * .16); c.lineTo(len * 1.1, len * .12); c.quadraticCurveTo(len * .55, len * .08, 0, 10); c.fill();
  c.restore();
  c.save(); c.translate(x, y); c.rotate(ang); c.globalCompositeOperation = 'lighter';
  cols.forEach((col, i) => {
    const off = (i - (cols.length - 1) / 2) * 7, wob = Math.sin(t / 300 + i) * 3, light = lerp3(col, [255, 255, 255], .35);
    const g = c.createLinearGradient(0, 0, len, 0); g.addColorStop(0, rgba(light, .85)); g.addColorStop(.3, rgba(light, .35)); g.addColorStop(1, rgba(light, 0));
    const spread = len * .05 + 10;
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -5); c.quadraticCurveTo(len * .5, off * 4 - spread * .6 + wob, len, off * 9 - spread + wob); c.lineTo(len, off * 9 + spread + wob); c.quadraticCurveTo(len * .5, off * 4 + spread * .6 + wob, 0, 5); c.fill();
  });
  for (let k = 0; k < 14; k++){ const d = (k * 53 + t / 12) % len, yy = Math.sin(k * 2.3 + t / 400) * (d * .08); c.fillStyle = `rgba(230,240,255,${.5 * (1 - d / len)})`; c.beginPath(); c.arc(d, yy, 1.6, 0, 7); c.fill(); }
  const h = c.createRadialGradient(0, 0, 0, 0, 0, 34); h.addColorStop(0, 'rgba(255,255,255,1)'); h.addColorStop(.18, 'rgba(225,242,255,.85)'); h.addColorStop(1, 'rgba(160,210,255,0)');
  c.fillStyle = h; c.beginPath(); c.arc(0, 0, 34, 0, 7); c.fill(); c.restore();
}

/* ---------- foreground flybys: huge and close, gone in seconds ---------- */
function drawTruss(c, len, h, rim, t){
  c.fillStyle = '#0a0c18'; c.strokeStyle = '#0a0c18'; c.lineWidth = h * .12;
  c.fillRect(0, -h / 2, len, h * .14); c.fillRect(0, h / 2 - h * .14, len, h * .14);
  c.beginPath(); for (let x = 0; x < len; x += h){ c.moveTo(x, -h / 2); c.lineTo(x + h / 2, h / 2); c.lineTo(x + h, -h / 2); } c.stroke();
  c.strokeStyle = rgba(rim, .55); c.lineWidth = 2; c.beginPath(); c.moveTo(0, -h / 2); c.lineTo(len, -h / 2); c.stroke();
  for (let x = h * .5; x < len; x += h * 3){ const on = Math.sin(t / 250 + x) > .2; c.fillStyle = on ? '#ff5d6c' : 'rgba(255,93,108,.15)'; c.beginPath(); c.arc(x, -h / 2, 4, 0, 7); c.fill(); }
  for (let x = h * 2; x < len; x += h * 7){ c.fillStyle = '#10142a'; c.fillRect(x, -h * 1.2, h * 1.6, h * .8); c.fillStyle = 'rgba(255,214,140,.85)'; for (let k = 0; k < 5; k++) c.fillRect(x + h * (.15 + k * .28), -h * .95, h * .12, h * .12); }
}
function drawBigRock(c, r, rim, a){
  // the outline turns with the rock; the light stays where the sun is (upper left)
  c.save(); c.rotate(a); c.beginPath();
  for (let i = 0; i < 22; i++){ const an = i / 22 * 6.283, rr = r * (.8 + .14 * Math.sin(i * 2.1 + 1.3) * Math.cos(i * .7) + .06 * Math.sin(i * 5.3)); c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); }
  c.closePath(); c.restore();
  c.save(); c.clip();
  const g = c.createRadialGradient(-r * .45, -r * .45, r * .05, -r * .1, -r * .1, r * 1.25);
  g.addColorStop(0, '#6f6a80'); g.addColorStop(.35, '#383447'); g.addColorStop(.75, '#15131f'); g.addColorStop(1, '#07060c');
  c.fillStyle = g; c.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  c.rotate(a);
  for (let k = 0; k < 9; k++){                                                     // craters: a shadowed bowl with a lit far rim
    const cx = (noiseHash(k, 3, 17) - .5) * r * 1.3, cy = (noiseHash(k, 5, 17) - .5) * r * 1.3, cr = r * (.06 + .14 * noiseHash(k, 7, 17));
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(cx, cy, cr, 0, 7); c.fill();
    c.strokeStyle = 'rgba(190,185,215,.16)'; c.lineWidth = cr * .18; c.beginPath(); c.arc(cx, cy, cr * .92, -a + .6, -a + 2.6); c.stroke();
  }
  c.rotate(-a);
  const sh = c.createLinearGradient(-r, -r, r, r); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.6)');
  c.fillStyle = sh; c.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  c.restore();
  const rl = c.createLinearGradient(-r, -r, r * .4, r * .4); rl.addColorStop(0, rgba(rim, .7)); rl.addColorStop(1, rgba(rim, 0));
  c.strokeStyle = rl; c.lineWidth = Math.max(2, r * .025); c.stroke();
}
function drawCruiser(c, len, h, rim, t){
  c.fillStyle = '#0b0d1b'; c.beginPath(); c.moveTo(0, 0); c.lineTo(len * .08, -h * .5); c.lineTo(len, -h * .55); c.lineTo(len, h * .5); c.lineTo(len * .1, h * .45); c.closePath(); c.fill();
  c.strokeStyle = rgba(rim, .5); c.lineWidth = 2; c.beginPath(); c.moveTo(len * .08, -h * .5); c.lineTo(len, -h * .55); c.stroke();
  for (let row = 0; row < 3; row++) for (let x = len * .14; x < len * .96; x += h * .32){
    if (noiseHash(Math.round(x), row, 5) < .35) continue; c.fillStyle = noiseHash(Math.round(x), row, 9) < .8 ? 'rgba(255,214,140,.9)' : 'rgba(130,210,255,.9)';
    c.fillRect(x, -h * .3 + row * h * .22, h * .14, h * .08);
  }
  const e = c.createRadialGradient(len, 0, 0, len, 0, h); e.addColorStop(0, 'rgba(140,230,255,.9)'); e.addColorStop(1, 'rgba(79,214,255,0)'); c.fillStyle = e; c.beginPath(); c.arc(len, 0, h, 0, 7); c.fill();
}

/* ---------- the fuel dock: where cheap power waits ---------- */
/** A refuelling depot: a long tank between two spheres, a docking ring and a beacon. u is one unit; it's about 220 units across. */
function drawDock(c, u, t, lit){
  const k = .55 + .45 * lit, beat = .5 + .5 * Math.sin(t / (lit > .5 ? 260 : 700));
  const steel = c.createLinearGradient(0, -30 * u, 0, 30 * u);
  steel.addColorStop(0, '#9aa3c8'); steel.addColorStop(.45, '#3f4670'); steel.addColorStop(1, '#141830');
  c.strokeStyle = 'rgba(150,160,210,.5)'; c.lineWidth = Math.max(1, 2 * u);                 // the truss it hangs on
  c.beginPath(); c.moveTo(-110 * u, -2 * u); c.lineTo(110 * u, -2 * u); c.stroke();
  for (let x = -100; x <= 100; x += 20){ c.beginPath(); c.moveTo(x * u, -2 * u); c.lineTo((x + 10) * u, 8 * u); c.lineTo((x + 20) * u, -2 * u); c.stroke(); }
  [-80, 80].forEach(x => {                                                                      // spherical tanks
    const g = c.createRadialGradient((x - 9) * u, -12 * u, 2 * u, x * u, 0, 26 * u);
    g.addColorStop(0, '#d8deff'); g.addColorStop(.5, '#5d6596'); g.addColorStop(1, '#151933');
    c.fillStyle = g; c.beginPath(); c.arc(x * u, 0, 24 * u, 0, 7); c.fill();
  });
  c.fillStyle = steel; c.beginPath();                                                           // the long tank
  c.moveTo(-60 * u, -16 * u); c.lineTo(60 * u, -16 * u); c.arc(60 * u, 0, 16 * u, -Math.PI / 2, Math.PI / 2); c.lineTo(-60 * u, 16 * u); c.arc(-60 * u, 0, 16 * u, Math.PI / 2, Math.PI * 1.5); c.fill();
  for (let i = 0; i < 5; i++){                                                                  // glowing fuel bands, brighter when it's cheap now
    const x = (-48 + i * 24) * u, a = (.35 + .65 * k) * (.6 + .4 * Math.sin(t / 400 - i * .8) * lit);
    c.fillStyle = `rgba(70,230,161,${a.toFixed(3)})`; c.fillRect(x - 3 * u, -15 * u, 6 * u, 30 * u);
  }
  c.save(); c.globalCompositeOperation = 'lighter';
  const halo = c.createRadialGradient(0, 0, 0, 0, 0, 130 * u);
  halo.addColorStop(0, `rgba(70,230,161,${(.18 + .3 * lit * beat).toFixed(3)})`); halo.addColorStop(1, 'rgba(70,230,161,0)');
  c.fillStyle = halo; c.beginPath(); c.arc(0, 0, 130 * u, 0, 7); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(200,210,255,.7)'; c.lineWidth = Math.max(1, 3 * u);                   // the docking ring, and its beacon
  c.beginPath(); c.ellipse(0, -30 * u, 12 * u, 5 * u, 0, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(0, -16 * u); c.lineTo(0, -25 * u); c.stroke();
  c.fillStyle = `rgba(180,255,220,${(.4 + .6 * beat).toFixed(3)})`; c.beginPath(); c.arc(0, -42 * u, 3.5 * u, 0, 7); c.fill();
}

/* ---------- the station your train stops at ---------- */
/** A platform from x0 to x1 with its edge at y, lamps standing behind the train, and a sign with the station's name. */
function drawPlatform(c, x0, x1, y, trainH, name, rem, t){
  const top = c.createLinearGradient(0, y, 0, y + rem * .5);
  top.addColorStop(0, '#5a6290'); top.addColorStop(1, '#2a3058');
  c.fillStyle = top; c.fillRect(x0, y, x1 - x0, rem * .5);
  const face = c.createLinearGradient(0, y + rem * .5, 0, y + rem * 1.6);
  face.addColorStop(0, '#1a1f3e'); face.addColorStop(1, '#070914');
  c.fillStyle = face; c.fillRect(x0, y + rem * .5, x1 - x0, rem * 1.1);
  c.fillStyle = 'rgba(255,209,102,.9)'; c.fillRect(x0, y + rem * .08, x1 - x0, rem * .1);   // the yellow line
  for (let x = x0 + rem * 3; x < x1 - rem; x += rem * 10){                                  // lamps, behind the train
    c.fillStyle = '#20264a'; c.fillRect(x - 2, y - trainH - rem * 1.6, 4, trainH + rem * 1.6);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y - trainH - rem * 1.6, 0, x, y - trainH - rem * 1.6, rem * 2.4);
    g.addColorStop(0, 'rgba(255,224,170,.85)'); g.addColorStop(1, 'rgba(255,200,140,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y - trainH - rem * 1.6, rem * 2.4, 0, 7); c.fill(); c.restore();
  }
  if (!name) return;
  c.font = `600 ${(rem * 1.1).toFixed(1)}px "JetBrains Mono", monospace`;                    // the station's sign, on its own post at the far end
  const w = c.measureText(name.toUpperCase()).width + rem * 1.4, sx = x1 - w - rem * .6, sy = y - trainH - rem * 3.6;
  c.fillStyle = '#20264a'; c.fillRect(sx + w / 2 - 2, sy + rem * 1.8, 4, y - sy - rem * 1.8);
  c.fillStyle = '#0d2a6b'; c.fillRect(sx, sy, w, rem * 1.8);
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2; c.strokeRect(sx + 3, sy + 3, w - 6, rem * 1.8 - 6);
  c.fillStyle = '#ffffff'; c.textBaseline = 'middle'; c.fillText(name.toUpperCase(), sx + rem * .7, sy + rem * .92);
}
