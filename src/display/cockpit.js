/* ===================== cockpit: the screensaver, a side window onto space ===================== */
// You're sitting in a ship's cabin, watching space go by. Everything outside has a depth and slides past at the ship's
// speed divided by it, so near things rush and far things creep. Layers, back to front:
//   space   (canvas)  sky, nebulae, stars, aurora, moon, planets, traffic, your house, wildlife, the ISS, comets
//   boards  (DOM)     holographic billboards and the space train, so their words stay crisp
//   near    (canvas)  huge things passing close, dust, debris, rain and ice outside
//   ship    (DOM)     the glass (rain, frost, fog), the window frame, the cabin and its dashboard
// The weather sets the sky's colours and the glass; the power price sets the ship's speed; your data rides past on
// billboards and the train. Written for older TV browsers too: no ?. or ?? here.
const Cockpit = (() => {
  let on = false, raf = 0, last = 0, frame = 0, W = 0, H = 0, dpr = 1, quality = 1, slowFrames = 0, staticTimer = 0, clock = 0;
  let sctx = null, nctx = null, gctx = null;
  let sky = skyFor(null), engine = engineFor(null), world = worldFor({}), cards = [], preview = {}, pal = null, palKey = '', skyGrad = null;
  let nebulae = [], stars = [[], [], []], starSprites = {}, body = null, bodyN = (Math.random() * 4) | 0, moonX = 0, things = [], timers = {}, auroraSprite = null, auroraX = 0;
  let flyby = null, motes = [], rocks = [], streaks = [], sparkles = [], rainOut = [], moteSprite = null, railK = 0;
  let drops = [], flakes = [], dropSprite = null, frostCache = null, fogCache = null, vignette = null, glassKey = '';
  let rotI = 0, boards = [], nextNear = 0, nextFar = 0, laneI = 0, train = null;
  let bolt = null, nextBolt = 0, flash = 0, view = { x: 0, y: 0 }, issShown = -1e9;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const el = id => document.getElementById(id);
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => W / H < 1.1;
  const S = 1000;
  /** How fast something at a given depth crosses the window, in pixels a second. Depth 1 is a billboard close by. */
  const speedAt = d => W / 13 * engine.speed / d;
  /** Billboards and the train keep a readable pace whatever the engines do. */
  const readableAt = d => W / 13 * clamp(engine.speed, .7, 1.4) / d;
  const TINTS = ['233,236,255', '255,222,186', '182,212,255', '220,200,255'];

  /* ---------- colours: the time of day, then the weather and the engines on top ---------- */
  const PHASES = {
    night: { top: [3, 3, 12], bottom: [9, 10, 32], deep: [24, 12, 62], mid: [86, 46, 158], bright: [168, 118, 240], accent: [72, 186, 236], amb: [126, 146, 255] },
    day:   { top: [6, 16, 46], bottom: [16, 38, 92], deep: [14, 36, 96], mid: [48, 106, 188], bright: [146, 200, 252], accent: [214, 176, 255], amb: [176, 210, 255] },
    dawn:  { top: [10, 8, 32], bottom: [86, 36, 66], deep: [50, 18, 62], mid: [168, 66, 120], bright: [255, 168, 132], accent: [255, 214, 156], amb: [255, 176, 146] },
    dusk:  { top: [8, 6, 28], bottom: [74, 20, 66], deep: [44, 12, 66], mid: [158, 46, 132], bright: [255, 122, 100], accent: [180, 104, 255], amb: [255, 146, 176] }
  };
  const MOODS = {
    storm: { deep: [26, 30, 54], mid: [72, 84, 122], bright: [152, 168, 204], accent: [118, 140, 206], amb: [150, 166, 210] },
    ice:   { deep: [16, 42, 76], mid: [72, 138, 190], bright: [204, 238, 255], accent: [154, 224, 255], amb: [190, 232, 255] },
    warp:  { deep: [44, 14, 86], mid: [124, 62, 226], bright: [206, 166, 255], accent: [255, 122, 222], amb: [200, 160, 255] },
    eco:   { amb: [255, 150, 110] }
  };
  function paletteFor(){
    const base = PHASES[sky.phase] || PHASES.night, out = {};
    Object.keys(base).forEach(k => { out[k] = base[k].slice(); });
    const blend = (m, k) => { if (k > 0) Object.keys(MOODS[m]).forEach(c => { out[c] = lerp3(out[c], MOODS[m][c], k).map(Math.round); }); };
    blend('storm', Math.min(.85, Math.max(sky.rain, sky.thunder * .9, sky.fog * .8, (sky.cloud - .6) * 2)));
    blend('ice', Math.min(.75, Math.max(sky.snow, sky.cold * .7)));
    if (engine.mode === 'warp') blend('warp', .6);
    if (engine.mode === 'eco') blend('eco', .5);
    out.density = clamp(.7 + sky.cloud * .4 + sky.fog * .25 - sky.sun * .1, .5, 1.25);
    return out;
  }
  function refreshPalette(force){
    const p = paletteFor(), key = JSON.stringify(p);
    if (!force && key === palKey) return;
    palKey = key; pal = p; skyGrad = null;
    nebulae.forEach(l => { if (l.ready) colourLayer(l); });
    const sec = el('cSec'); if (sec) sec.style.setProperty('--amb', `${pal.amb[0]},${pal.amb[1]},${pal.amb[2]}`);
  }

  /* ---------- nebulae: painted once from noise, then scrolled slowly round and round ---------- */
  function makeLayer(scale, seed, depth, o){
    const fw = Math.ceil(W * 2 / scale), fh = Math.ceil(H / scale);
    return { fw, fh, scale, seed, depth, o, dens: new Float32Array(fw * fh), dust: new Float32Array(fw * fh), hue: new Float32Array(fw * fh),
             row: 0, ready: false, alpha: 0, x: rnd(0, W * 2), canvas: document.createElement('canvas') };
  }
  /** A few rows at a time, so building the sky never freezes the screen. */
  function growLayer(l, rows){
    const P = 6, o = l.o;
    for (let n = 0; n < rows && l.row < l.fh; n++, l.row++){
      const y = l.row, yy = y * P / l.fw, ny = y / l.fh;
      for (let x = 0; x < l.fw; x++){
        const nx = x / l.fw * P, i = y * l.fw + x;
        const qx = fbm(nx, yy, P, l.seed, 3), qy = fbm(nx + 5.2, yy + 1.3, P, l.seed + 7, 3);
        let d = fbm(nx + o.warp * qx, yy + o.warp * qy, P, l.seed + 3, 5);
        // a broad river of cloud winding across the view, like a galaxy seen edge on
        const bandY = .44 + .2 * Math.sin(nx / P * Math.PI * 2 * 2 + l.seed), band = Math.exp(-Math.pow((ny - bandY) / o.band, 2));
        d = smoothstep(o.lo, o.hi, d * (.5 + .7 * band));
        l.dens[i] = d;
        l.dust[i] = o.dust ? smoothstep(.52, .74, fbm(nx * 2 + 3, yy * 2, P * 2, l.seed + 11, 4)) * band * o.dust : 0;
        l.hue[i] = smoothstep(.45, .75, fbm(nx * 1.5 + 9, yy * 1.5, P * 2, l.seed + 19, 3));
      }
    }
    if (l.row >= l.fh && !l.ready){ l.ready = true; colourLayer(l); }
  }
  function colourLayer(l){
    const c = l.canvas; c.width = l.fw; c.height = l.fh;
    const ctx = c.getContext('2d'), img = ctx.createImageData(l.fw, l.fh), px = img.data, k = l.o.gain * pal.density;
    const a = pal.deep, b = pal.mid, cc = pal.bright, ac = pal.accent;
    for (let i = 0; i < l.dens.length; i++){
      const d = l.dens[i], dk = l.dust[i], j = i * 4;
      if (d < .004 && dk < .004){ px[j + 3] = 0; continue; }
      let r, g, bl;
      if (d < .5){ const t = d * 2; r = a[0] + (b[0] - a[0]) * t; g = a[1] + (b[1] - a[1]) * t; bl = a[2] + (b[2] - a[2]) * t; }
      else { const t = (d - .5) * 2; r = b[0] + (cc[0] - b[0]) * t; g = b[1] + (cc[1] - b[1]) * t; bl = b[2] + (cc[2] - b[2]) * t; }
      const h = l.hue[i] * .55; r += (ac[0] - r) * h; g += (ac[1] - g) * h; bl += (ac[2] - bl) * h;
      const dark = 1 - dk * .85;
      px[j] = r * dark; px[j + 1] = g * dark; px[j + 2] = bl * dark;
      px[j + 3] = Math.min(255, (d * 1.1 * k + dk * .55) * 255);
    }
    ctx.putImageData(img, 0, 0);
  }
  function drawLayer(l, dt){
    if (!l.ready) return;
    l.alpha = Math.min(1, l.alpha + dt / 2500);
    const w = l.fw * l.scale, h = l.fh * l.scale;
    l.x = ((l.x + speedAt(l.depth) * dt / S) % w + w) % w;
    const x = -l.x + view.x * 6 / l.depth, y = view.y * 6 / l.depth;
    sctx.globalAlpha = l.alpha;
    sctx.drawImage(l.canvas, x, y, w, h); sctx.drawImage(l.canvas, x + w, y, w, h);
    sctx.globalAlpha = 1;
  }

  /* ---------- stars: three depths of glowing points, the brightest with spikes ---------- */
  function makeStarSprites(){
    starSprites = {};
    TINTS.forEach(t => [0, 1, 2, 3].forEach(z => {
      const s = [8, 16, 28, 56][z];
      starSprites[t + z] = sprite(s, s, (c, n) => {
        const m = n / 2, g = c.createRadialGradient(m, m, 0, m, m, m);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.1, `rgba(${t},.95)`); g.addColorStop(.3, `rgba(${t},.25)`); g.addColorStop(1, `rgba(${t},0)`);
        c.fillStyle = g; c.fillRect(0, 0, n, n);
        if (z === 3){
          c.globalCompositeOperation = 'lighter';
          [0, Math.PI / 2].forEach(an => { c.save(); c.translate(m, m); c.rotate(an);
            const sg = c.createLinearGradient(-m, 0, m, 0); sg.addColorStop(0, `rgba(${t},0)`); sg.addColorStop(.5, 'rgba(255,255,255,.8)'); sg.addColorStop(1, `rgba(${t},0)`);
            c.fillStyle = sg; c.fillRect(-m, -.7, n, 1.4); c.restore(); });
        }
      });
    }));
    moteSprite = glowSprite(64, '220,230,255', .5);
  }
  const STAR_LAYERS = [{ d: 320, per: 1500, size: [0, 0, 0, 1], px: [2.5, 4] }, { d: 90, per: 5200, size: [0, 1, 1, 2], px: [5, 9] }, { d: 22, per: 24000, size: [1, 2, 2, 3], px: [9, 22] }];
  function newStar(layer, x){
    const L = STAR_LAYERS[layer];
    return { x, y: rnd(0, H), z: pick(L.size), tint: pick(TINTS), s: rnd(L.px[0], L.px[1]), a: rnd(.35, 1), ph: rnd(0, 6.3), tw: rnd(.6, 2.4) };
  }
  function drawStars(layer, dt, t){
    const L = STAR_LAYERS[layer], v = speedAt(L.d), warp = engine.mode === 'warp', streak = warp || engine.mode === 'fast';
    sctx.globalCompositeOperation = 'lighter';
    for (const s of stars[layer]){
      s.x -= v * dt / S;
      if (s.x < -30){ Object.assign(s, newStar(layer, W + rnd(5, 60))); continue; }
      const x = s.x + view.x * 4 / L.d, y = s.y + view.y * 4 / L.d, a = s.a * (.72 + .28 * Math.sin(t / S * s.tw + s.ph));
      sctx.globalAlpha = a; sctx.drawImage(starSprites[s.tint + s.z], x - s.s / 2, y - s.s / 2, s.s, s.s);
      if (streak){
        sctx.globalAlpha = a * .5; sctx.strokeStyle = `rgba(${warp ? '215,195,255' : s.tint},1)`; sctx.lineWidth = Math.max(.6, s.s / 8);
        sctx.beginPath(); sctx.moveTo(x, y); sctx.lineTo(x + v * (warp ? .5 : .12), y); sctx.stroke();
      }
    }
    sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- the sky behind it all: its colour, the sun or the moon, an aurora, lightning ---------- */
  function drawSky(t){
    if (!skyGrad){ skyGrad = sctx.createLinearGradient(0, 0, 0, H); skyGrad.addColorStop(0, rgba(pal.top, 1)); skyGrad.addColorStop(1, rgba(pal.bottom, 1)); }
    sctx.fillStyle = skyGrad; sctx.fillRect(0, 0, W, H);
    const glow = (x, y, r, col, a) => { const g = sctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); sctx.fillStyle = g; sctx.fillRect(0, 0, W, H); };
    if (sky.phase === 'dawn') glow(W * .1, H * 1.1, H * 1.2, [255, 150, 100], .35);
    if (sky.phase === 'dusk') glow(W * .9, H * 1.1, H * 1.2, [255, 110, 90], .32);
    if (engine.mode === 'warp') glow(W * .5, H * .45, W * .6, [184, 146, 255], .16 + .05 * Math.sin(t / 300));
  }
  function drawSun(){
    if (!(sky.sun > 0)) return;
    const x = W * .2, y = H * .26, s = sky.sun;
    sctx.globalCompositeOperation = 'lighter';
    let g = sctx.createRadialGradient(x, y, 0, x, y, H * .55);
    g.addColorStop(0, `rgba(255,252,236,${.95 * s})`); g.addColorStop(.05, `rgba(255,236,180,${.8 * s})`); g.addColorStop(.2, `rgba(255,190,110,${.2 * s})`); g.addColorStop(1, 'rgba(255,180,90,0)');
    sctx.fillStyle = g; sctx.fillRect(0, 0, W, H);
    [[.3, .03, '255,200,120'], [.55, .016, '120,200,255'], [.85, .05, '184,146,255'], [1.15, .022, '70,230,161']].forEach(f => {
      const fx = x + (W * .5 - x) * f[0] * 2, fy = y + (H * .45 - y) * f[0] * 2, r = H * f[1] * 2;
      g = sctx.createRadialGradient(fx, fy, 0, fx, fy, r); g.addColorStop(0, `rgba(${f[2]},${.15 * s})`); g.addColorStop(1, `rgba(${f[2]},0)`);
      sctx.fillStyle = g; sctx.beginPath(); sctx.arc(fx, fy, r, 0, 7); sctx.fill();
    });
    sctx.globalCompositeOperation = 'source-over';
  }
  /** Curtains of light when the grid is clean, or when you're paid to use power. */
  function drawAurora(t, dt){
    const k = Math.max(world.aurora, /aurora/.test(String(preview.show || '')) ? 1 : 0);
    if (!(k > 0)) return;
    if (!auroraSprite) auroraSprite = sprite(4, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(160,90,255,0)'); g.addColorStop(.35, 'rgba(160,90,255,.22)'); g.addColorStop(.72, 'rgba(70,240,170,.6)'); g.addColorStop(.84, 'rgba(200,255,230,.8)'); g.addColorStop(1, 'rgba(70,240,170,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    auroraX += speedAt(70) * dt / S;
    const step = quality === 1 ? 4 : 8;
    sctx.globalCompositeOperation = 'lighter';
    for (let x = 0; x < W; x += step){
      const u = (x + auroraX) / W, n = vnoise(u * 4 + t / 9000, 3, 1e6, 41), n2 = vnoise(u * 9 - t / 6000, 5, 1e6, 43);
      const top = H * (.05 + .1 * n), len = H * (.2 + .2 * n2);
      sctx.globalAlpha = k * (.18 + .4 * n * (.4 + .6 * n2));
      sctx.drawImage(auroraSprite, x - step, top, step * 3, len);
    }
    sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over';
  }
  function drawLightning(t){
    if (!sky.thunder) return;
    if (!bolt && t > nextBolt){
      const pts = [], x0 = rnd(W * .15, W * .85); let x = x0, y = H * rnd(.08, .2);
      const end = H * rnd(.4, .6); while (y < end){ pts.push([x, y]); x += rnd(-38, 38); y += rnd(14, 40); }
      bolt = { pts, until: t + 200 }; nextBolt = t + rnd(3500, 10000); flash = 1;
      const f = el('cFlash'); f.style.transition = 'none'; f.style.opacity = '.35';
      setTimeout(() => { f.style.transition = 'opacity 1.1s'; f.style.opacity = '0'; }, 70);
    }
    if (flash > 0){ sctx.globalCompositeOperation = 'lighter'; sctx.fillStyle = `rgba(190,180,255,${flash * .28})`; sctx.fillRect(0, 0, W, H); sctx.globalCompositeOperation = 'source-over'; flash = Math.max(0, flash - .045); }
    if (bolt){
      sctx.strokeStyle = 'rgba(236,238,255,.95)'; sctx.lineWidth = 2.5; sctx.shadowColor = '#b892ff'; sctx.shadowBlur = 22;
      sctx.beginPath(); bolt.pts.forEach((p, i) => sctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); sctx.stroke(); sctx.shadowBlur = 0;
      if (t > bolt.until) bolt = null;
    }
  }
  function drawHaze(){
    if (engine.dust > 0){ sctx.fillStyle = `rgba(150,105,60,${engine.dust * .12})`; sctx.fillRect(0, 0, W, H); }
    if (sky.fog > 0){ sctx.fillStyle = `rgba(150,165,195,${sky.fog * .14})`; sctx.fillRect(0, 0, W, H); }
  }

  /** The size things are drawn at: the window's height, or less on a tall, narrow screen. */
  const unit = () => Math.min(H, W * 1.15);

  /* ---------- planets and the moon: they take minutes to pass ---------- */
  const BODIES = ['gas', 'ocean', 'ice', 'rock'];
  function newBody(x){
    const kind = BODIES[bodyN++ % BODIES.length], R = unit() * rnd(.2, .28), seed = (Math.random() * 1000) | 0;
    const b = { kind, R, x, y: H * rnd(.36, .5), d: 40, img: renderPlanet(kind, R * (quality === 1 ? 1 : .6), seed) };
    if (PLANETS[kind].rings && Math.random() < PLANETS[kind].rings) b.rings = renderRings(kind, R, seed);
    return b;
  }
  function drawBody(dt){
    if (!body) body = newBody(W * .74);
    body.x -= speedAt(body.d) * dt / S;
    const span = body.rings ? body.rings.w / 2 : body.R * 1.3;
    if (body.x < -span){ body = newBody(W + span + W * .4); return; }
    const x = body.x + view.x * 3 / body.d, y = body.y + view.y * 3 / body.d, sz = body.R * 2 * (1 + body.img.pad / body.img.r);
    if (body.rings) sctx.drawImage(body.rings.back, x - body.rings.w / 2, y - body.rings.h / 2);
    sctx.drawImage(body.img.canvas, x - sz / 2, y - sz / 2, sz, sz);
    if (body.rings) sctx.drawImage(body.rings.front, x - body.rings.w / 2, y - body.rings.h / 2);
  }
  function drawTheMoon(dt){
    if (sky.phase === 'day' && !/moon/.test(String(preview.show || ''))) return;
    if (!moonX) moonX = W * .53;
    moonX -= speedAt(160) * dt / S; if (moonX < -H * .2) moonX = W + H * .2;
    drawMoon(sctx, moonX + view.x * .02, H * .17 + view.y * .02, H * .05, world.moon);
  }

  /* ---------- things going by: traffic, your house, wildlife, the ISS, comets ---------- */
  function spawn(kind, mid){
    const x0 = mid ? W * rnd(.45, .6) : W + 300;
    if (kind === 'traffic'){
      const k = pick(['satellite', 'freighter', 'station', 'asteroid', 'satellite', 'freighter']), d = rnd(2.6, 12), own = k === 'freighter' ? rnd(-.5, 2) : rnd(-.15, .15);
      things.push({ kind: k, ship: true, d, own, x: own > 1 && !mid ? -W * .1 : x0, y: rnd(H * .12, H * .62), spin: rnd(-.6, .6), a: rnd(0, 6) });
    } else if (kind === 'house'){
      things.push({ kind, d: 4.5, own: 0, x: mid ? W * .55 : W + H * .4, y: H * .5, smoke: [], puff: 0 });
    } else if (kind === 'whales'){
      const hue = pick([200, 230, 260, 290]), n = 2 + (Math.random() < .5 ? 1 : 0);
      for (let i = 0; i < n; i++) things.push({ kind: 'whale', d: 5 + i * 1.6, own: -.35, x: x0 + i * W * .18, y: H * (.28 + i * .12), hue: hue + i * 12, ph: rnd(0, 9e3) });
    } else if (kind === 'jellies'){
      const hue = pick([300, 190, 330, 170]);
      for (let i = 0; i < 6; i++) things.push({ kind: 'jelly', d: rnd(3, 7), own: .25, x: x0 + rnd(-W * .2, W * .35), y: H * rnd(.25, .7), vy: -rnd(4, 12), hue: hue + rnd(-20, 20), seed: rnd(0, 9) });
    } else if (kind === 'birds'){
      const n = 9 + ((Math.random() * 5) | 0), y = H * rnd(.2, .45);
      for (let i = 0; i < n; i++){ const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        things.push({ kind: 'bird', d: 2.4, own: -1.3, x: x0 + row * 34, y: y + side * row * 20, seed: rnd(0, 9) }); }
    } else if (kind === 'iss'){
      things.push({ kind, d: 6, own: 3.2, x: mid ? W * .4 : -120, y: H * .2 });
    } else if (kind === 'comet'){
      things.push({ kind, d: 300, x: mid ? W * .6 : W * 1.15, y: H * rnd(.1, .22), vx: -W / 9, vy: H / 40, len: W * rnd(.22, .32),
                    colours: world.comet.length ? world.comet : (preview.show ? ['green', 'blue'] : []) });
    }
  }
  function schedule(){
    const due = (k, first, min, max, ok) => {
      if (timers[k] == null) timers[k] = clock + first;
      if (clock >= timers[k]){ timers[k] = clock + rnd(min, max); if (ok !== false) return true; }
      return false;
    };
    if (due('traffic', 3e3, 6e3, 15e3) && things.filter(o => o.ship).length < 4) spawn('traffic');
    if (due('house', 50e3, 200e3, 320e3)) spawn('house');
    if (due('wild', 100e3, 240e3, 460e3)) spawn(pick(['whales', 'jellies', 'birds']));
    if (due('comet', 7e3, 70e3, 120e3, world.comet.length > 0)) spawn('comet');
    if (world.iss && world.iss.near && clock - issShown > 150e3 && !things.some(o => o.kind === 'iss')){ issShown = clock; spawn('iss'); }
    if (due('train', 16e3, 130e3, 210e3, !train)) startTrain();
    if (due('flyby', 38e3, 75e3, 150e3, !flyby)) startFlyby();
  }
  /** Comets are far beyond the moon, so they're drawn before it. */
  function drawComets(t, dt){
    for (let i = things.length - 1; i >= 0; i--){
      const o = things[i];
      if (o.kind !== 'comet') continue;
      o.x += o.vx * dt / S; o.y += o.vy * dt / S;
      if (o.x < -o.len * 1.2){ things.splice(i, 1); continue; }
      drawComet(sctx, o.x, o.y, o.len, Math.atan2(-o.vy, -o.vx), o.colours, t);
    }
  }
  function drawThings(t, dt){
    things.sort((a, b) => b.d - a.d);
    for (let i = things.length - 1; i >= 0; i--){
      const o = things[i];
      if (o.kind === 'comet') continue;
      o.x += (o.own - 1) * speedAt(o.d) * dt / S;
      if (o.vy) o.y += o.vy * dt / S;
      const margin = o.kind === 'house' ? H * .45 : o.kind === 'whale' ? H * .5 : 220;
      if (o.x < -margin || (o.own > 1 && o.x > W + margin)){ things.splice(i, 1); continue; }
      const x = o.x + view.x * 2 / o.d, y = o.y + view.y * 2 / o.d, near = clamp(1 - (o.d - 2.6) / 9.4, 0, 1);
      sctx.save(); sctx.translate(x, y);
      if (o.ship){
        const s = W * .05 / o.d; o.a += o.spin * dt / S; sctx.globalAlpha = .4 + .6 * near;
        if (o.kind === 'freighter' && o.own > 1) sctx.scale(-1, 1);
        SHIPS[o.kind](sctx, s, o.a, near, t);
      } else if (o.kind === 'house'){
        // smoke puffs rise from the chimney and drift back as we pass
        o.puff -= dt; if (world.house.smoke > 0 && o.puff <= 0){ o.smoke.push({ x: 30, y: -150, r: 6, a: .35 * world.house.smoke }); o.puff = 500; }
        o.smoke.forEach(p => { p.y -= 9 * dt / S; p.x += 7 * dt / S; p.r += 5 * dt / S; p.a *= Math.pow(.86, dt / S); });
        o.smoke = o.smoke.filter(p => p.a > .02);
        drawHouse(sctx, unit() * .0026, world.house, t, o.smoke, pal.amb);
      } else if (o.kind === 'whale'){
        sctx.globalAlpha = .55 + .4 * clamp(1 - (o.d - 5) / 5, 0, 1); drawWhale(sctx, unit() * .0012 * 6 / o.d, t + o.ph, o.hue);
      } else if (o.kind === 'jelly'){
        sctx.globalCompositeOperation = 'lighter'; sctx.globalAlpha = .8; drawJelly(sctx, unit() * .0022 * 4 / o.d, t, o.hue, o.seed);
      } else if (o.kind === 'bird'){
        sctx.globalCompositeOperation = 'lighter'; drawBird(sctx, H * .0022, t, o.seed);
      } else if (o.kind === 'iss'){
        drawISS(sctx, H * .032, t);
      }
      sctx.restore();
    }
  }

  /* ---------- close by: huge things sweeping past, dust, debris, rain and ice outside ---------- */
  function startFlyby(want){
    const kind = want || pick(['truss', 'rock', 'cruiser']), d = rnd(.55, .75);
    flyby = { kind, d, x: W + 50, y: H * rnd(.18, .6), len: kind === 'truss' ? W * 1.3 : kind === 'cruiser' ? W * .9 : H * .4, a: rnd(0, 6) };
  }
  function drawNear(t, dt){
    nctx.clearRect(0, 0, W, H);
    const c = nctx, amb = pal.amb;
    if (flyby){
      const f = flyby;
      f.x -= speedAt(f.d) * dt / S; f.a += .05 * dt / S;
      if (f.x < (f.kind === 'rock' ? -f.len : -f.len - 50)) flyby = null;
      else { c.save(); c.translate(f.x, f.y + view.y * 3);
        if (f.kind === 'truss') drawTruss(c, f.len, H * .07, amb, t);
        else if (f.kind === 'cruiser') drawCruiser(c, f.len, H * .12, amb, t);
        else drawBigRock(c, f.len, amb, f.a);
        c.restore(); }
    }
    // dust right by the glass, soft and out of focus
    while (motes.length < Math.round(10 * quality)) motes.push({ x: rnd(0, W * 1.5), y: rnd(0, H * .8), d: rnd(.3, .6), s: rnd(10, 34) });
    c.globalCompositeOperation = 'lighter';
    motes.forEach(m => { m.x -= speedAt(m.d) * dt / S; if (m.x < -60) Object.assign(m, { x: W + rnd(30, W * .8), y: rnd(0, H * .8) }); c.globalAlpha = .18; c.drawImage(moteSprite, m.x - m.s / 2, m.y - m.s / 2, m.s, m.s); });
    // warp: light streaking past
    if (engine.mode === 'warp'){
      if (streaks.length < 26) streaks.push({ x: W + rnd(0, W), y: rnd(0, H * .8), len: rnd(120, 520), v: rnd(1500, 3200) });
      c.lineCap = 'round';
      streaks.forEach(s => { s.x -= s.v * dt / S; if (s.x < -s.len) Object.assign(s, { x: W + rnd(0, 200), y: rnd(0, H * .8) });
        const g = c.createLinearGradient(s.x, 0, s.x + s.len, 0); g.addColorStop(0, 'rgba(230,215,255,.55)'); g.addColorStop(1, 'rgba(184,146,255,0)');
        c.globalAlpha = 1; c.strokeStyle = g; c.lineWidth = 1.6; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + s.len, s.y); c.stroke(); });
    } else streaks = [];
    // ice crystals glinting past in the cold
    if (sky.snow > 0 || sky.cold > .6){
      while (sparkles.length < 40 * Math.max(sky.snow, sky.cold * .6)) sparkles.push({ x: rnd(0, W * 1.3), y: rnd(0, H * .8), s: rnd(6, 16), ph: rnd(0, 6) });
      sparkles.forEach(p => { p.x -= speedAt(.9) * dt / S; p.y += 12 * dt / S; if (p.x < -20 || p.y > H) Object.assign(p, { x: W + rnd(0, 300), y: rnd(-20, H * .6) });
        c.globalAlpha = .5 + .5 * Math.sin(t / 200 + p.ph); c.drawImage(starSprites[TINTS[2] + 1], p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); });
    } else sparkles = [];
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // rain outside, swept past
    if (sky.rain > 0){
      while (rainOut.length < 60 * sky.rain) rainOut.push({ x: rnd(0, W * 1.2), y: rnd(-H, H), len: rnd(30, 70) });
      c.strokeStyle = 'rgba(190,210,255,.18)'; c.lineWidth = 1.2;
      rainOut.forEach(r => { r.x -= (speedAt(.8) + 120) * dt / S; r.y += 700 * dt / S; if (r.y > H || r.x < -50) Object.assign(r, { x: rnd(0, W * 1.2), y: rnd(-H * .3, 0) });
        c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x + r.len * .35, r.y - r.len); c.stroke(); });
    } else rainOut = [];
    // debris tumbling past on windy days
    const wantRocks = Math.round(sky.wind * 8);
    while (rocks.length < wantRocks) rocks.push({ x: W + rnd(20, W * .6), y: rnd(H * .1, H * .7), d: rnd(1.1, 2.4), r: rnd(5, 15), a: rnd(0, 6), va: rnd(-2, 2) });
    if (rocks.length > wantRocks) rocks.length = wantRocks;
    rocks.forEach(k => { k.x -= speedAt(k.d) * (1 + sky.wind) * dt / S; k.a += k.va * dt / S; if (k.x < -40) Object.assign(k, { x: W + rnd(20, 300), y: rnd(H * .1, H * .7) });
      c.save(); c.translate(k.x, k.y); SHIPS.asteroid(c, k.r / k.d, k.a, .5, t); c.restore(); });
  }

  /* ---------- the glass: reflections, condensation, frost, rain and snow ---------- */
  function glassLayers(){
    const key = W + 'x' + H; if (key === glassKey) return; glassKey = key;
    vignette = sprite(W, H, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h * .42, h * .25, w / 2, h * .42, w * .62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,8,.55)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const s = c.createLinearGradient(0, 0, w, h * .6); s.addColorStop(.28, 'rgba(255,255,255,0)'); s.addColorStop(.36, 'rgba(255,255,255,.045)'); s.addColorStop(.4, 'rgba(255,255,255,.01)'); s.addColorStop(.47, 'rgba(255,255,255,.035)'); s.addColorStop(.55, 'rgba(255,255,255,0)');
      c.fillStyle = s; c.fillRect(0, 0, w, h);
      const r = c.createLinearGradient(0, h * .6, 0, h * .78); r.addColorStop(0, 'rgba(255,190,120,0)'); r.addColorStop(1, 'rgba(255,190,120,.06)');   // the cabin's lights, reflected low in the glass
      c.fillStyle = r; c.fillRect(0, h * .6, w, h * .2);
    });
    fogCache = sprite(W / 4, H / 4, (c, w, h) => {
      const img = c.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const n = fbm(x / w * 6, y / w * 6, 6, 77, 4), i = (y * w + x) * 4; img.data[i] = 200; img.data[i + 1] = 210; img.data[i + 2] = 228; img.data[i + 3] = smoothstep(.35, .7, n) * 150; }
      c.putImageData(img, 0, 0);
    });
    frostCache = sprite(W, H, c => {
      const m = Math.min(W, H) * .24, edge = (x0, y0, x1, y1) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(225,240,255,.45)'); g.addColorStop(1, 'rgba(225,240,255,0)'); return g; };
      c.fillStyle = edge(0, 0, m, 0); c.fillRect(0, 0, m, H); c.fillStyle = edge(W, 0, W - m, 0); c.fillRect(W - m, 0, m, H);
      c.fillStyle = edge(0, 0, 0, m); c.fillRect(0, 0, W, m); c.fillStyle = edge(0, H * .8, 0, H * .8 - m); c.fillRect(0, H * .8 - m, W, m);
      c.strokeStyle = 'rgba(235,245,255,.26)'; c.lineWidth = 1;
      const branch = (x, y, an, len, depth) => { if (depth > 3 || len < 4) return; const x2 = x + Math.cos(an) * len, y2 = y + Math.sin(an) * len;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); branch(x2, y2, an + rnd(-.5, .5), len * .7, depth + 1);
        if (Math.random() < .7) branch(x + (x2 - x) * .5, y + (y2 - y) * .5, an + (Math.random() < .5 ? -1 : 1) * rnd(.6, 1.1), len * .5, depth + 1); };
      for (let i = 0; i < 48; i++){ const side = i % 4, len = m * rnd(.12, .38);
        if (side === 0) branch(0, rnd(0, H), rnd(-.6, .6), len, 0); else if (side === 1) branch(W, rnd(0, H), Math.PI + rnd(-.6, .6), len, 0);
        else if (side === 2) branch(rnd(0, W), 0, Math.PI / 2 + rnd(-.6, .6), len, 0); else branch(rnd(0, W), H * .78, -Math.PI / 2 + rnd(-.6, .6), len, 0); }
    });
    dropSprite = sprite(64, 64, (c, s) => {
      const m = s / 2, g = c.createRadialGradient(m * .8, m * .7, m * .1, m, m, m);
      g.addColorStop(0, 'rgba(210,225,255,.05)'); g.addColorStop(.75, 'rgba(160,185,230,.16)'); g.addColorStop(.92, 'rgba(20,24,40,.35)'); g.addColorStop(1, 'rgba(20,24,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(m, m, m, 0, 7); c.fill();
      const hl = c.createRadialGradient(m * .65, m * .6, 0, m * .65, m * .6, m * .3); hl.addColorStop(0, 'rgba(255,255,255,.85)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = hl; c.beginPath(); c.arc(m * .65, m * .6, m * .3, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5; c.beginPath(); c.arc(m, m, m * .82, .3, 1.6); c.stroke();
    });
  }
  function drawGlass(dt){
    glassLayers();
    const c = gctx, sec = dt / S; c.clearRect(0, 0, W, H);
    c.drawImage(vignette, 0, 0);
    if (sky.fog > 0){ c.globalAlpha = sky.fog * .85; c.drawImage(fogCache, 0, 0, W, H); c.globalAlpha = 1; }
    const frost = Math.max(sky.cold, sky.snow * .8);
    if (frost > 0){ c.globalAlpha = frost; c.drawImage(frostCache, 0, 0); c.globalAlpha = 1; }
    // rain: drops land and bead, and now and then one is swept back along the glass by the ship's motion
    const big = W > 1400 ? 1.5 : 1;
    if (sky.rain > 0 && drops.length < 180 * sky.rain && Math.random() < sky.rain * 10 * sec) drops.push({ x: rnd(0, W), y: rnd(0, H * .8), r: rnd(2, 6) * big, life: rnd(15e3, 45e3), age: 0, vx: 0, vy: 0 });
    if (sky.rain > 0 && Math.random() < sky.rain * 1.1 * sec){ const d = pick(drops); if (d && d.r > 4 && !d.vx){ d.vx = -rnd(60, 150) * clamp(engine.speed, .5, 2); d.vy = rnd(14, 40); } }
    for (let i = drops.length - 1; i >= 0; i--){
      const d = drops[i]; d.age += dt;
      if (d.vx){ d.x += d.vx * sec; d.y += d.vy * sec; if (Math.random() < 5 * sec) drops.push({ x: d.x + d.r * 2, y: d.y, r: d.r * .35, life: rnd(4e3, 9e3), age: 0, vx: 0, vy: 0 }); }
      if (d.age > d.life || d.y > H || d.x < -10){ drops.splice(i, 1); continue; }
      c.globalAlpha = Math.min(1, (d.life - d.age) / 2500);
      if (d.vx){ c.save(); c.translate(d.x, d.y); c.rotate(Math.atan2(d.vy, d.vx)); c.scale(1.5, .8); c.drawImage(dropSprite, -d.r, -d.r, d.r * 2, d.r * 2); c.restore(); }
      else c.drawImage(dropSprite, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
    }
    c.globalAlpha = 1;
    // snow: flakes stick to the glass and slowly melt
    if (sky.snow > 0 && flakes.length < 150 * sky.snow && Math.random() < sky.snow * 7 * sec) flakes.push({ x: rnd(0, W), y: rnd(0, H * .8), r: rnd(1.5, 4) * big, life: rnd(20e3, 50e3), age: 0, a: rnd(0, 3) });
    for (let i = flakes.length - 1; i >= 0; i--){
      const f = flakes[i]; f.age += dt; if (f.age > f.life){ flakes.splice(i, 1); continue; }
      c.strokeStyle = `rgba(240,248,255,${Math.min(1, (f.life - f.age) / 4000) * .85})`; c.lineWidth = 1;
      c.beginPath(); for (let k = 0; k < 3; k++){ const an = f.a + k * 1.047; c.moveTo(f.x - Math.cos(an) * f.r, f.y - Math.sin(an) * f.r); c.lineTo(f.x + Math.cos(an) * f.r, f.y + Math.sin(an) * f.r); } c.stroke();
    }
  }

  /* ---------- billboards: holographic beacons for what you need to catch ---------- */
  const NEAR = [{ y: .3, d: 1 }, { y: .5, d: 1.05 }], FAR = [{ y: .2, d: 2.4 }, { y: .44, d: 2.7 }], NARROW = [{ y: .26, d: 1 }, { y: .46, d: 1.05 }];
  function boardHtml(card){
    return `<span class="bh">${esc(card.head)}</span><span class="bb">${esc(card.big)}</span>${card.sub ? `<span class="bs">${esc(card.sub)}</span>` : ''}`;
  }
  function nextCard(list, avoid){
    for (let k = 0; k < list.length; k++){ const c = list[(rotI++) % list.length]; if (!avoid(c)) return c; }
    return null;
  }
  function spawnBoard(lane, x){
    const real = cards.filter(c => c.id !== 'date'), urgent = billboardRotation(boardCards(real)), list = lane.d > 2 || !urgent.length ? billboardRotation(real) : urgent;
    const card = nextCard(list, c => boards.some(b => b.id === c.id) || (!!train && train.ids.indexOf(c.id) >= 0));
    if (!card) return;
    const b = document.createElement('div');
    b.className = `board tone-${card.tone}${String(card.big).length > 11 ? ' long' : ''}`; b.setAttribute('data-card', card.id);
    b.innerHTML = `<div class="holo">${boardHtml(card)}</div><i class="beam"></i><i class="buoy"></i>`;
    el('cBoards').appendChild(b);
    const holo = b.firstChild, s = 1 / lane.d;
    boards.push({ el: b, holo, id: card.id, lane, w: b.offsetWidth, h: holo.offsetHeight, x: x != null ? x : W + b.offsetWidth * s / 2 + 40, seed: rnd(0, 6) });
  }
  function placeBoards(t, dt){
    for (let i = boards.length - 1; i >= 0; i--){
      const b = boards[i], d = b.lane.d, s = 1 / d;
      if (!still()) b.x -= readableAt(d) * dt / S;
      if (b.x < -b.w * s / 2 - 60){ b.el.parentNode && b.el.parentNode.removeChild(b.el); boards.splice(i, 1); continue; }
      const y = H * b.lane.y + Math.sin(t / 2100 + b.seed) * 7 * s + view.y / d;
      const ry = still() ? 0 : clamp((b.x - W / 2) / (W / 2), -1, 1) * -14 * s, rz = Math.sin(t / 3300 + b.seed) * 1.2;
      b.el.style.transform = `translate(${(b.x - b.w / 2).toFixed(1)}px,${(y - b.h / 2).toFixed(1)}px) scale(${s.toFixed(3)}) rotateY(${ry.toFixed(2)}deg) rotate(${rz.toFixed(2)}deg)`;
      const far = clamp((d - 1.2) / 1.5, 0, 1);
      b.el.style.filter = far > 0 ? `${quality === 1 ? `blur(${(far * 1.8).toFixed(2)}px) ` : ''}brightness(${(1 - far * .35).toFixed(2)}) saturate(${(1 - far * .4).toFixed(2)})` : '';
      b.el.style.zIndex = String(Math.round(100 / d));
    }
    if (still()) return;
    const lanes = narrow() ? NARROW : NEAR;
    if (clock >= nextNear){ spawnBoard(lanes[laneI++ % lanes.length]); nextNear = clock + (narrow() ? 11e3 : 9e3); }
    if (!narrow() && clock >= nextFar){ spawnBoard(pick(FAR)); nextFar = clock + rnd(10e3, 16e3); }
  }

  /* ---------- the space train: one fact a carriage ---------- */
  function startTrain(){
    const onBoards = boards.map(b => b.id), list = cards.filter(c => c.id !== 'date' && onBoards.indexOf(c.id) < 0).slice(0, narrow() ? 4 : 7);
    if (!list.length) return;
    const tr = document.createElement('div'); tr.className = 'strain';
    tr.innerHTML = `<div class="loco"><i class="nose"></i><span class="lname">Harold Street Express</span><i class="lamp"></i></div>`
      + list.map(c => `<div class="car tone-${c.tone}" data-card="${c.id}"><i class="cwin"></i><div class="cpanel">${boardHtml(c)}</div><i class="bogie"></i></div>`).join('');
    el('cBoards').appendChild(tr);
    train = { el: tr, ids: list.map(c => c.id), w: tr.offsetWidth, h: tr.offsetHeight, d: narrow() ? 1.4 : 1.3, y: narrow() ? .68 : .64, x: W + 40 };
  }
  function moveTrain(dt){
    if (!train) return;
    const s = 1 / train.d;
    if (!still()) train.x -= readableAt(train.d) * 1.35 * dt / S;
    if (train.x < -train.w * s - 80){ train.el.parentNode && train.el.parentNode.removeChild(train.el); train = null; return; }
    train.el.style.transform = `translate(${train.x.toFixed(1)}px,${(H * train.y - train.h * s / 2 + view.y / train.d).toFixed(1)}px) scale(${s.toFixed(3)})`;
    train.el.style.zIndex = String(Math.round(100 / train.d));
  }
  /** The guide rail the train runs on: it lights up as the train comes, and fades after. */
  function drawRail(dt){
    railK += ((train ? 1 : 0) - railK) * Math.min(1, dt / 900);
    if (railK < .02) return;
    const y = H * (narrow() ? .68 : .64) + (train ? train.h / train.d / 2 : 60) + 8;
    const g = sctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(79,214,255,0)'); g.addColorStop(.5, `rgba(79,214,255,${.5 * railK})`); g.addColorStop(1, 'rgba(79,214,255,0)');
    sctx.fillStyle = g; sctx.fillRect(0, y, W, 2);
    sctx.globalCompositeOperation = 'lighter'; sctx.fillStyle = `rgba(150,230,255,${.6 * railK})`;
    for (let x = ((-clock * readableAt(1.3) / S) % 140 + 140) % 140; x < W; x += 140){ sctx.beginPath(); sctx.arc(x, y + 1, 2.2, 0, 7); sctx.fill(); }
    sctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- the ship ---------- */
  function sway(t){
    const k = 1 + sky.wind * 2.5, sy = Math.sin(t / 7300) * 4 * k + Math.sin(t / 29000) * 7, sx = Math.sin(t / 19000) * 5;
    el('cShip').style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) rotate(${(Math.sin(t / 11000) * .16 * k).toFixed(3)}deg)`;
    view.x = -sx * 1.5; view.y = -sy * 1.5;
  }

  /* ---------- sizes and the loop ---------- */
  function resize(){
    W = innerWidth; H = innerHeight; dpr = Math.min(quality === 1 ? 1.5 : 1, window.devicePixelRatio || 1);
    [el('cSpace'), el('cNear'), el('cGlass')].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    sctx = el('cSpace').getContext('2d'); nctx = el('cNear').getContext('2d'); gctx = el('cGlass').getContext('2d');
    [sctx, nctx, gctx].forEach(c => c.setTransform(dpr, 0, 0, dpr, 0, 0));
    makeStarSprites(); glassKey = ''; skyGrad = null; refreshPalette(true);
    stars = STAR_LAYERS.map((L, i) => { const n = Math.round(W * H / L.per * (quality === 1 ? 1 : .55)), a = []; for (let k = 0; k < n; k++) a.push(newStar(i, rnd(0, W))); return a; });
    nebulae = [makeLayer(quality === 1 ? 5 : 7, 3, 420, { warp: 2.2, band: .3, lo: .32, hi: .9, dust: 1, gain: .95 }),
               makeLayer(quality === 1 ? 4 : 6, 8, 140, { warp: 3.4, band: .22, lo: .5, hi: .95, dust: 0, gain: .7 })];
    body = null; moonX = 0;
  }
  function loop(t){
    if (!on) return;
    const dt = Math.min(80, t - (last || t)); last = t; frame++; clock += dt;
    if (dt > 34) slowFrames++; else if (slowFrames > 0) slowFrames -= .25;
    if (slowFrames > 90 && quality > .5){ quality = .5; slowFrames = 0; resize(); }
    nebulae.forEach(l => { if (!l.ready) growLayer(l, quality === 1 ? 10 : 6); });
    render(t, dt);
    raf = requestAnimationFrame(loop);
  }
  function render(t, dt){
    sway(t); schedule();
    drawSky(t); drawStars(0, dt, t); drawLayer(nebulae[0], dt); drawSun(); drawComets(t, dt); drawTheMoon(dt); drawStars(1, dt, t); drawAurora(t, dt);
    drawLayer(nebulae[1], dt); drawLightning(t); drawBody(dt); drawStars(2, dt, t); drawThings(t, dt); drawRail(dt); drawHaze();
    placeBoards(t, dt); moveTrain(dt); drawNear(t, dt);
    if (quality === 1 || frame % 2 === 0) drawGlass(quality === 1 ? dt : dt * 2);
  }
  /** Reduced motion: a still scene, redrawn every 30 seconds with new billboards. */
  function drawStill(){
    nebulae.forEach(l => { while (!l.ready) growLayer(l, 200); l.alpha = 1; });
    boards.forEach(b => b.el.parentNode && b.el.parentNode.removeChild(b.el)); boards = [];
    (narrow() ? [[NARROW[0], W / 2]] : [[NEAR[0], W * .3], [NEAR[1], W * .7], [FAR[0], W * .55]]).forEach(p => spawnBoard(p[0], p[1]));
    const t = performance.now(); render(t, 0);
  }
  /** A scene already under way: a billboard or two in view, so it never opens on empty space. */
  function setTheScene(){
    if (narrow()) spawnBoard(NARROW[0], W * .6);
    else { spawnBoard(NEAR[0], W * .46); spawnBoard(FAR[1], W * .85); laneI = 1; }
    nextNear = clock + 5e3; nextFar = clock + 8e3;
    const show = String(preview.show || '');
    ['house', 'whales', 'jellies', 'birds', 'iss', 'comet', 'traffic'].forEach(k => { if (show.indexOf(k) >= 0) spawn(k, true); });
    if (show.indexOf('train') >= 0 && !train){ startTrain(); if (train) train.x = W * .05; }
    const near = ['truss', 'rock', 'cruiser'].filter(k => show.indexOf(k) >= 0)[0];
    if (near || show.indexOf('flyby') >= 0){ startFlyby(near); flyby.x = W * .7; }
  }

  return {
    start(){
      if (on) return; on = true; document.body.classList.add('cockpit');
      clock = 0; timers = {}; things = []; issShown = -1e9; train = null; flyby = null; railK = 0;
      resize(); last = 0; nextBolt = performance.now() + 2500;
      setTheScene();
      if (still()){ drawStill(); staticTimer = setInterval(drawStill, 30000); }
      else raf = requestAnimationFrame(loop);
    },
    stop(){
      on = false; cancelAnimationFrame(raf); clearInterval(staticTimer); document.body.classList.remove('cockpit');
      boards.forEach(b => b.el.parentNode && b.el.parentNode.removeChild(b.el)); boards = [];
      if (train && train.el.parentNode) train.el.parentNode.removeChild(train.el); train = null;
      drops = []; flakes = []; things = [];
    },
    resize(){ if (on){ resize(); if (still()) drawStill(); } },
    /** New data: the billboards, the sky, the engines, the world outside and the dashboard. */
    update(info){
      sky = info.sky; engine = info.engine; world = info.world; cards = info.cards;
      const next = info.preview || {}, changed = String(next.show || '') !== String(preview.show || '');
      preview = next;
      if (on && changed) setTheScene();
      else if (on && !train && /train/.test(String(preview.show || ''))){ startTrain(); if (train) train.x = W * .05; }
      if (on) refreshPalette(false);
      boards.forEach(b => { const c = cards.filter(x => x.id === b.id)[0]; if (c){ const h = boardHtml(c); if (b.holo.innerHTML !== h) b.holo.innerHTML = h; } });
      const h = info.hud;
      el('hPrice').textContent = h.price; el('hPrice').className = 'v ' + h.priceTone;
      el('hEngine').textContent = engine.label; el('hEngine').className = 's ' + engine.tone;
      el('hTemp').textContent = h.temp; el('hWx').textContent = h.wx; el('hDateC').textContent = h.date;
      el('cHud').setAttribute('data-engine', engine.mode);
    },
    running: () => on
  };
})();
