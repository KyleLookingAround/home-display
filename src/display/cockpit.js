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
  let on = false, raf = 0, last = 0, frame = 0, W = 0, H = 0, dpr = 1, quality = 1, staticTimer = 0, clock = 0;
  let sctx = null, nctx = null, gctx = null;
  let sky = skyFor(null), engine = engineFor(null), world = worldFor({}), cards = [], preview = {}, pal = null, palKey = '';
  let nebulae = [], stars = [[], [], []], back = null, backX = 0, backAt = -1e9, backDirty = true, starSprites = {}, moonCv = null, moonKey = '', body = null, bodyN = (Math.random() * 4) | 0, moonX = 0, things = [], timers = {}, auroraSprite = null, auroraX = 0;
  let flyby = null, motes = [], rocks = [], streaks = [], sparkles = [], rainOut = [], moteSprite = null, railK = 0;
  let drops = [], flakes = [], dropSprite = null, frostCache = null, fogCache = null, vignette = null, glassKey = '';
  let rotI = 0, boards = [], nextNear = 0, laneI = 0, train = null;
  let voyage = null, lights = [], rem = 16;
  let actx = null, tier = 0, learnt = 0, adapt = true, detail = 'auto', aheadAt = -1e9, aheadDt = 0, intervals = [], auroraCv = null, auroraAt = -1e9, nearClear = false, glassDrawn = '';
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
  /*
   * How hard to work. TV browsers draw canvases slowly, so they start lower, and any screen steps down a tier when it
   * can't keep up. scale: canvas resolution; fps: frames a second; ahead: how often the road ahead (sharp text) redraws.
   */
  const TIERS = [{ scale: 1, fps: 60, ahead: 0 }, { scale: .75, fps: 30, ahead: 120 }, { scale: .5, fps: 30, ahead: 400 }, { scale: .4, fps: 20, ahead: 1000 }];
  const TV = /SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|Philips|NETTV|Saphi|Titan|VIDAA|Android ?TV|AFT[A-Z]|CrKey|Opera TV|TV Safari/i.test(navigator.userAgent || '');
  function chooseTier(){
    adapt = detail !== 'high' && detail !== 'low';
    tier = detail === 'high' ? 0 : detail === 'low' ? 2 : Math.max(learnt, TV ? 2 : (navigator.hardwareConcurrency || 4) <= 2 ? 1 : 0);   // a step down is remembered until the page reloads
    quality = tier === 0 ? 1 : .5;
    document.body.classList.toggle('lite', tier > 0);
  }

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
    palKey = key; pal = p; backDirty = true;
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
  /**
   * The backdrop: the sky's colour, the far and middle stars and both nebulae, painted together now and then into one
   * picture two screens wide. They're so far off that they creep by at a pixel or two a second, so their parallax was
   * never visible, and blending five full-screen layers every frame was more than a TV could draw. Now it's one copy.
   */
  function starTile(layer, c, ox){
    c.globalCompositeOperation = 'lighter';
    stars[layer].forEach(s => {
      c.globalAlpha = s.a * .86;
      [s.x, s.x - W, s.x + W].forEach(x => { if (x > -s.s && x < W + s.s) c.drawImage(starSprites[s.tint + s.z], ox + x - s.s / 2, s.y - s.s / 2, s.s, s.s); });
    });
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  function bakeBackdrop(){
    const w2 = W * 2;
    if (!back) back = document.createElement('canvas');
    const bw = Math.round(w2 * dpr), bh = Math.round(H * dpr);
    if (back.width !== bw || back.height !== bh){ back.width = bw; back.height = bh; }
    const c = back.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba(pal.top, 1)); g.addColorStop(1, rgba(pal.bottom, 1));
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = g; c.fillRect(0, 0, w2, H);
    const neb = l => { if (!l.ready) return; const w = l.fw * l.scale, h = l.fh * l.scale; c.globalAlpha = l.alpha; c.drawImage(l.canvas, -l.x, 0, w, h); c.drawImage(l.canvas, -l.x + w, 0, w, h); c.globalAlpha = 1; };
    starTile(0, c, 0); starTile(0, c, W); neb(nebulae[0]);
    starTile(1, c, 0); starTile(1, c, W); neb(nebulae[1]);
    backDirty = false; backAt = clock;
  }
  function drawBackdrop(t, dt){
    // the nebulae fade in once painted: re-bake a few times a second until they're there
    const fading = nebulae.some(l => l.ready && l.alpha < 1);
    nebulae.forEach(l => { if (l.ready) l.alpha = Math.min(1, l.alpha + dt / 2500); });
    if (backDirty || (fading && clock - backAt > 250) || !back) bakeBackdrop();
    backX = ((backX + speedAt(200) * dt / S) % (W * 2) + W * 2) % (W * 2);
    sctx.drawImage(back, -backX, 0, W * 2, H); sctx.drawImage(back, W * 2 - backX, 0, W * 2, H);
    if (tier === 0) drawSky(t);
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
    // painted at a quarter size a few times a second, then stretched over the sky in one go
    const cw = Math.max(64, Math.round(W / 4)), ch = Math.max(48, Math.round(H / 4));
    if (!auroraCv || auroraCv.width !== cw){ auroraCv = document.createElement('canvas'); auroraCv.width = cw; auroraCv.height = ch; auroraAt = -1e9; }
    if (clock - auroraAt > (tier === 0 ? 100 : 500)){
      auroraAt = clock;
      const c = auroraCv.getContext('2d'), step = 2;
      c.clearRect(0, 0, cw, ch); c.globalCompositeOperation = 'lighter';
      for (let x = 0; x < cw; x += step){
        const u = (x * 4 + auroraX) / W, n = vnoise(u * 4 + t / 9000, 3, 1e6, 41), n2 = vnoise(u * 9 - t / 6000, 5, 1e6, 43);
        c.globalAlpha = .1 + .26 * n * (.4 + .6 * n2);
        c.drawImage(auroraSprite, x - step, ch * (.05 + .1 * n), step * 3, ch * (.2 + .2 * n2));
      }
    }
    sctx.globalCompositeOperation = 'lighter'; sctx.globalAlpha = k * .85;
    sctx.drawImage(auroraCv, 0, 0, W, H);
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
    const r = H * .05, key = Math.round(world.moon.f * 200) + ':' + Math.round(r);
    if (key !== moonKey){
      moonKey = key; const n = Math.ceil(r * 7);
      moonCv = sprite(n, n, c => drawMoon(c, n / 2, n / 2, r, world.moon));
    }
    sctx.drawImage(moonCv, moonX + view.x * .02 - moonCv.width / 2, H * .17 + view.y * .02 - moonCv.height / 2);
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
    const mine = !!(voyage && voyage.train && voyage.train.mine);
    if (mine && timers.train != null && timers.train - clock > 45e3 && !train) timers.train = clock + 8e3;   // time to leave: bring it round soon
    if (due('train', 16e3, mine ? 50e3 : 130e3, mine ? 70e3 : 210e3, !train)) startTrain();
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
    const kind = want || pick(['rock', 'cruiser', 'rock']), d = rnd(.55, .75);
    flyby = { kind, d, x: W + 50, y: H * rnd(.18, .6), len: kind === 'truss' ? W * 1.3 : kind === 'cruiser' ? W * .9 : H * .4, a: rnd(0, 6) };
  }
  function drawNear(t, dt){
    const busy = flyby || tier === 0 || engine.mode === 'warp' || sky.snow > 0 || sky.cold > .6 || sky.rain > 0 || sky.wind > 0;
    if (!busy){ if (!nearClear){ nctx.clearRect(0, 0, W, H); nearClear = true; el('cNear').className = 'idle'; } return; }   // hidden, it costs nothing to show
    if (nearClear){ nearClear = false; el('cNear').className = ''; }
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
    if (tier > 0) motes = [];
    while (tier === 0 && motes.length < 10) motes.push({ x: rnd(0, W * 1.5), y: rnd(0, H * .8), d: rnd(.3, .6), s: rnd(10, 34) });
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


  /* ---------- the road ahead: the next twelve hours laid along the window, now on the left ---------- */
  // Things come in from the right and leave on the left, so how far right something is says how soon it comes:
  // a landscape whose height is the Agile price, the fuel dock at the cheapest two hours, weather fronts, and waypoints.
  const TONE_RGB = { neg: [184, 146, 255], good: [70, 230, 161], warn: [255, 181, 71], bad: [255, 107, 125] };
  const priceTone = p => p < 0 ? 'neg' : p < 15 ? 'good' : p < 25 ? 'warn' : 'bad';
  function aheadGeom(){
    const x0 = W * (narrow() ? .1 : .13), x1 = W * .93, now = Date.now(), span = voyage.to - voyage.from;
    return { x0, x1, yb: H * .752, now, xOf: t => x0 + (t - now) / span * (x1 - x0) };
  }
  /** Labels are queued while the road ahead is drawn, then stacked so none sits on another (first queued, first placed). */
  let queued = [];
  function label(c, x, y, lines, align, rgb){ queued.push({ x, y, lines, align, rgb }); }
  function placeLabels(c){
    const placed = [];
    queued.forEach(q => {
      const r = measureLabel(c, q.x, q.y, q.lines, q.align), y0 = r.y;
      r.x = clamp(r.x, W * .07, Math.max(W * .07, W * .93 - r.w));   // keep it inside the window
      const hitAt = () => placed.filter(p => r.x < p.x + p.w + 6 && p.x < r.x + r.w + 6 && r.y < p.y + p.h + 6 && p.y < r.y + r.h + 6)[0];
      for (let n = 0, hit; n < 8 && (hit = hitAt()); n++) r.y = hit.y - r.h - 8;
      if (r.y < H * .33){                                              // never up among the billboards: try below instead
        r.y = y0;
        for (let n = 0, hit; n < 8 && (hit = hitAt()); n++) r.y = hit.y + hit.h + 8;
        if (r.y + r.h > H * .74 || hitAt()) return;
      }
      if (y0 - r.y > rem){ c.strokeStyle = `rgba(${q.rgb.join(',')},.4)`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(r.x + rem, r.y + r.h); c.lineTo(r.x + rem, y0 + r.h); c.stroke(); }
      drawLabel(c, r, q.lines, q.rgb); placed.push(r);
    });
    queued = [];
  }
  const fontOf = l => `${l.b ? 700 : 500} ${(rem * l.size).toFixed(1)}px ${l.mono === false ? '"Exo 2", sans-serif' : '"JetBrains Mono", monospace'}`;
  function measureLabel(c, x, y, lines, align){
    let w = 0, h = 0;
    lines.forEach(l => { c.font = fontOf(l); w = Math.max(w, c.measureText(l.text).width); h += rem * l.size * 1.25; });
    const pad = rem * .45, bw = w + pad * 2, bh = h + pad * 2;
    return { x: align === 'right' ? x - bw : align === 'center' ? x - bw / 2 : x, y: y - bh, w: bw, h: bh, pad };
  }
  /** Text on the canvas, in rem so it keeps to the ten-foot sizes, with a dark backing so it reads over anything. */
  function drawLabel(c, r, lines, rgb){
    const bx = r.x, by = r.y, pad = r.pad;
    c.fillStyle = 'rgba(4,6,18,.72)'; c.beginPath();
    if (c.roundRect) c.roundRect(bx, by, r.w, r.h, rem * .3); else c.rect(bx, by, r.w, r.h);
    c.fill();
    c.strokeStyle = `rgba(${rgb.join(',')},.55)`; c.lineWidth = 1.5; c.stroke();
    let ty = by + pad; c.textBaseline = 'top';
    lines.forEach(l => {
      c.font = fontOf(l);
      c.fillStyle = l.col || '#e9ecff'; c.fillText(l.text, bx + pad, ty + rem * l.size * .1); ty += rem * l.size * 1.25;
    });
  }
  const until = ms => { const m = Math.max(0, Math.round(ms / 60e3)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  function drawAhead(t, dt){
    if (!voyage) return;
    const g = aheadGeom(), c = actx;
    queued = [];
    voyage.fronts.forEach((f, i) => drawFront(g, f, i, t));
    const frontLabels = queued; queued = [];
    const R = voyage.range;
    if (!R || !R.length){ queued = frontLabels; placeLabels(c); return; }
    const ps = R.map(r => r.p), lo = Math.min(0, Math.min.apply(null, ps)), hi = Math.max(30, Math.max.apply(null, ps));
    const hOf = p => g.yb - H * (.035 + .12 * (p - lo) / (hi - lo));
    const pts = R.map(r => [g.xOf((r.from + r.to) / 2), hOf(r.p), r.p]), lastX = g.xOf(R[R.length - 1].to);
    pts.unshift([W * .04, pts[0][1], pts[0][2]]);
    pts.push([lastX, pts[pts.length - 1][1], pts[pts.length - 1][2]]);
    const known = pts.slice();
    if (lastX < W * .96) pts.push([lastX + W * .03, g.yb - H * .03, null], [W * .96, g.yb - H * .03, null]);   // prices not out yet: a low plain
    const ridge = () => {
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    };
    // the land: dark, lit along its top by whatever light is outside, with lights on it streaming past
    c.save(); c.beginPath(); ridge(); c.lineTo(W * .96, H); c.lineTo(W * .04, H); c.closePath();
    const land = c.createLinearGradient(0, g.yb - H * .17, 0, g.yb);
    land.addColorStop(0, `rgba(${pal.deep.map(v => Math.round(v * .45 + 14)).join(',')},.96)`); land.addColorStop(1, 'rgba(5,6,16,.99)');
    c.fillStyle = land; c.fill(); c.clip();
    if (!lights.length && tier === 0) for (let i = 0; i < 70; i++) lights.push({ x: rnd(0, W), y: rnd(0, 1), b: rnd(.25, 1), w: Math.random() < .2 });
    const sp = speedAt(9) * dt / S;
    c.globalCompositeOperation = 'lighter';
    lights.forEach(l => {
      l.x -= sp; if (l.x < 0) { l.x += W; l.y = rnd(0, 1); }
      c.fillStyle = l.w ? `rgba(130,210,255,${(.5 * l.b).toFixed(2)})` : `rgba(255,205,140,${(.55 * l.b).toFixed(2)})`;
      c.fillRect(l.x, g.yb - H * (.005 + .13 * l.y), 2.2, 2.2);
    });
    c.restore();
    // the ridge line, coloured by price: violet below zero, green cheap, amber, red at peak
    const line = c.createLinearGradient(W * .04, 0, W * .96, 0);
    known.forEach(p => { const k = clamp((p[0] - W * .04) / (W * .92), 0, 1); line.addColorStop(k, `rgba(${TONE_RGB[priceTone(p[2])].join(',')},1)`); });
    c.save(); c.beginPath(); ridge(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = line; c.lineWidth = rem * .5; c.globalAlpha = .22; c.stroke();
    c.lineWidth = rem * .12; c.globalAlpha = .95; c.stroke(); c.restore();
    // the times along it, and where now is
    c.save(); c.font = `500 ${(rem * .9).toFixed(1)}px "JetBrains Mono", monospace`; c.textBaseline = 'alphabetic'; c.textAlign = 'center';
    const step = 3 * 3600e3, first = Math.ceil((g.now + 3600e3) / step) * step;
    for (let tt = first; tt < voyage.to; tt += step){
      const x = g.xOf(tt); if (x > lastX - rem * 2 || x < g.x0 + rem * 4) continue;
      c.fillStyle = 'rgba(200,208,255,.55)'; c.fillText(hhmm(tt), x, g.yb - rem * .5);
    }
    if (lastX < W * .9){ c.textAlign = 'left'; c.fillStyle = 'rgba(200,208,255,.45)'; c.fillText('Prices due at 4pm', lastX + W * .035, g.yb - rem * .5); }
    c.strokeStyle = 'rgba(233,236,255,.5)'; c.setLineDash([4, 6]); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(g.x0, g.yb); c.lineTo(g.x0, hOf(R[0].p) - rem * 1.4); c.stroke(); c.setLineDash([]);
    c.textAlign = 'left'; c.fillStyle = 'rgba(233,236,255,.8)'; c.fillText('NOW', g.x0 + rem * .4, hOf(R[0].p) - rem * .7);
    c.restore();
    drawTheDock(g, hOf, t);
    voyage.waypoints.forEach(w => drawWaypoint(g, w, hOf, R, t));
    queued = queued.concat(frontLabels); placeLabels(c);
  }
  /** The fuel dock hangs over the cheapest two hours; when they come, it has arrived. */
  function drawTheDock(g, hOf, t){
    const d = voyage.dock; if (!d) return;
    const c = actx, xa = Math.max(g.xOf(d.from), g.x0), xb = Math.max(g.xOf(d.to), xa + rem * 2), lit = d.now ? 1 : 0;
    const beat = .5 + .5 * Math.sin(t / 900);
    c.save(); c.globalCompositeOperation = 'lighter';                                       // the valley glows
    const v = c.createLinearGradient(0, g.yb - H * .3, 0, g.yb);
    v.addColorStop(0, 'rgba(70,230,161,0)'); v.addColorStop(1, `rgba(70,230,161,${(.12 + .14 * beat + .15 * lit).toFixed(3)})`);
    c.fillStyle = v; c.fillRect(xa, g.yb - H * .3, xb - xa, H * .3); c.restore();
    const cx = narrow() ? clamp((xa + xb) / 2, W * .3, W * .7) : clamp((xa + xb) / 2, W * .2, W * .82), cy = g.yb - H * .19, u = Math.min(H, W) * .0013;
    c.strokeStyle = 'rgba(70,230,161,.45)'; c.lineWidth = 2; c.setLineDash([3, 5]);         // the fuel line down to the valley
    c.beginPath(); c.moveTo(cx, cy + 16 * u); c.lineTo(cx, hOf(d.avg) - 4); c.stroke(); c.setLineDash([]);
    c.save(); c.translate(cx, cy); drawDock(c, u, t, lit); c.restore();
    const green = [70, 230, 161], dur = `${hhmm(d.from)}–${hhmm(d.to)}`;
    label(c, cx, cy - 52 * u, d.now
      ? [{ text: 'CHEAP POWER NOW', size: .9, col: '#46e6a1' }, { text: 'Run the dishwasher', size: 1.25, b: true, mono: false }, { text: `${pence(d.avg)} average until ${hhmm(d.to)}`, size: .9 }]
      : [{ text: 'FUEL DOCK · CHEAPEST', size: .9, col: '#46e6a1' }, { text: dur, size: 1.25, b: true }, { text: `in ${until(d.from - g.now)} · ${pence(d.avg)}`, size: .9 }], 'center', green);
  }
  /** A calendar event: a beacon standing on the landscape at its time. */
  function drawWaypoint(g, w, hOf, R, t){
    const c = actx, x = g.xOf(w.t); if (x > W * .9) return;
    const r = R.filter(q => q.from <= w.t && w.t < q.to)[0], base = r ? hOf(r.p) : g.yb - H * .03, top = g.yb - H * .27;
    c.strokeStyle = 'rgba(184,146,255,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, base); c.lineTo(x, top); c.stroke();
    const k = .6 + .4 * Math.sin(t / 500);
    c.save(); c.translate(x, top); c.rotate(Math.PI / 4); c.fillStyle = `rgba(214,196,255,${k.toFixed(2)})`; c.fillRect(-rem * .3, -rem * .3, rem * .6, rem * .6); c.restore();
    const title = w.title.length > 22 ? w.title.slice(0, 21) + '…' : w.title;
    label(c, x + rem * .7, top + rem * 1.1, [{ text: hhmm(w.t), size: .9, col: '#b892ff' }, { text: title, size: 1, mono: false }], 'left', [184, 146, 255]);
  }
  /** Rain, snow or thunder on its way: a cloud bank standing over the hours it's due. */
  function drawFront(g, f, i, t){
    const c = actx, xa = Math.max(g.xOf(f.from), W * .05), xb = Math.min(g.xOf(f.to), W * .95);
    if (xb <= xa) return;
    const top = H * .47, base = H * .6, n = Math.max(3, Math.round((xb - xa) / (H * .05)));
    const storm = f.kind === 'thunder', snow = f.kind === 'snow';
    if (storm && Math.random() < .012) f.flash = 1;
    f.flash = (f.flash || 0) * .85;
    // rain or snow falling from it to the land
    c.save(); c.beginPath(); c.rect(xa, base - H * .02, xb - xa, g.yb - base); c.clip();
    c.strokeStyle = snow ? 'rgba(235,242,255,.7)' : 'rgba(160,190,240,.35)'; c.fillStyle = 'rgba(235,242,255,.75)'; c.lineWidth = 1.2;
    for (let k = 0; k < (xb - xa) / 9; k++){
      const x = xa + ((k * 97.3 + (snow ? t * .02 * Math.sin(k) : 0)) % (xb - xa)), y = base + ((k * 53.7 + t * (snow ? .03 : .45)) % (g.yb - base));
      if (snow){ c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); } else { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 12); c.stroke(); }
    }
    c.restore();
    // the cloud bank itself
    for (let k = 0; k < n; k++){
      const x = xa + (k + .5) / n * (xb - xa), y = top + (base - top) * (.35 + .5 * noiseHash(k, i, 31)) + Math.sin(t / 3000 + k) * 4, r = H * (.05 + .04 * noiseHash(k, i, 37));
      const gr = c.createRadialGradient(x - r * .3, y - r * .4, r * .1, x, y, r);
      const lit = storm ? f.flash : 0;
      gr.addColorStop(0, `rgba(${Math.round(120 + 135 * lit)},${Math.round(132 + 123 * lit)},${Math.round(168 + 87 * lit)},.75)`);
      gr.addColorStop(1, storm ? 'rgba(34,38,64,0)' : 'rgba(64,74,110,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    const word = storm ? 'Thunder' : snow ? 'Snow' : 'Rain';
    label(c, Math.max(xa, W * .06), top - rem * .2, [{ text: f.from <= g.now ? `${word} until ${hhmm(f.to)}` : `${word} from ${hhmm(f.from)}`, size: .9, col: '#4fd6ff' }], 'left', [79, 214, 255]);
  }

  /* ---------- billboards: holographic beacons for what you need to catch ---------- */
  // Bands, top to bottom: billboards in the sky (to .38), what's coming up (.4 to .6), then the landscape and the train.
  const NEAR = [{ y: .26, d: 1 }, { y: .26, d: 1.05 }], NARROW = [{ y: .21, d: 1 }, { y: .3, d: 1.05 }];
  function boardHtml(card){
    const sub = card.sub ? `<span class="bs">${esc(card.sub)}</span>` : '';
    // music: the album wall (six covers), or a cover beside the words
    if (card.wall) return `<span class="bh">${esc(card.head)}</span><span class="wall">${card.wall.map(u => `<span><img src="${esc(u)}" alt=""></span>`).join('')}</span>${sub}`;
    const text = `<span class="bh">${esc(card.head)}</span>${card.big ? `<span class="bb">${esc(card.big)}</span>` : ''}${sub}`;
    return card.img ? `<span class="art"><img src="${esc(card.img)}" alt=""></span><span class="tx">${text}</span>` : text;
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
    b.className = `board tone-${card.tone}${card.wall ? ' has-wall' : card.img ? ' has-img' : String(card.big).length > 11 ? ' long' : ''}`; b.setAttribute('data-card', card.id);
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
      const ry = still() ? 0 : clamp((b.x - W / 2) / (W / 2), -1, 1) * -8 * s, rz = Math.sin(t / 3300 + b.seed) * 1.2;
      b.el.style.transform = `translate(${(b.x - b.w / 2).toFixed(1)}px,${(y - b.h / 2).toFixed(1)}px) scale(${s.toFixed(3)}) rotateY(${ry.toFixed(2)}deg) rotate(${rz.toFixed(2)}deg)`;
      const far = clamp((d - 1.2) / 1.5, 0, 1);
      b.el.style.filter = far > 0 ? `${quality === 1 ? `blur(${(far * 1.8).toFixed(2)}px) ` : ''}brightness(${(1 - far * .35).toFixed(2)}) saturate(${(1 - far * .4).toFixed(2)})` : '';
      b.el.style.zIndex = String(Math.round(100 / d));
    }
    if (still()) return;
    const lanes = narrow() ? NARROW : NEAR;
    if (clock >= nextNear){ spawnBoard(lanes[laneI++ % lanes.length]); nextNear = clock + (narrow() ? 11e3 : 9e3); }
  }

  /* ---------- the space train: one fact a carriage; and, when it's time to leave, your own train ---------- */
  /** Your real train's carriages: when to leave, then the platform and whether it's on time. */
  function myTrainCards(){
    const tr = voyage.train, lv = tr.leave;
    return [
      { id: 'train', tone: lv.cls === 'good' ? 'cyan' : lv.cls, head: `Your train · ${hhmm(tr.sched)}`, big: lv.text, sub: `to ${tr.dest}` },
      { id: 'platform', tone: tr.delayed ? 'bad' : 'cyan', head: tr.platform ? `Platform ${tr.platform}` : 'Platform to be shown',
        big: tr.delayed ? 'Delayed' : tr.exp && tr.exp - tr.sched >= 60e3 ? 'Expected ' + hhmm(tr.exp) : 'On time',
        sub: `${tr.station ? tr.station + ' · ' : ''}${tr.walk} min walk` }
    ];
  }
  function startTrain(){
    const mine = !!(voyage && voyage.train && voyage.train.mine);
    const onBoards = boards.map(b => b.id), list = mine ? myTrainCards() : cards.filter(c => c.id !== 'date' && onBoards.indexOf(c.id) < 0).slice(0, narrow() ? 4 : 7);
    if (!list.length) return;
    const tr = document.createElement('div'); tr.className = 'strain' + (mine ? ' mine' : '');
    tr.innerHTML = `<div class="loco"><i class="nose"></i><span class="lname">Harold Street Express</span><i class="lamp"></i></div>`
      + list.map(c => `<div class="car tone-${c.tone}" data-card="${c.id}"><i class="cwin"></i><div class="cpanel">${boardHtml(c)}</div><i class="bogie"></i></div>`).join('');
    el('cBoards').appendChild(tr);
    train = { el: tr, ids: list.map(c => c.id), w: tr.offsetWidth, h: tr.offsetHeight, d: narrow() ? 1.4 : 1.3, y: narrow() ? .68 : .64, x: W + 40, mine };
    // your train pulls in, waits at the platform in the middle of the window, then pulls out
    if (mine){
      // the whole train in the middle of the window; on a narrow screen, the carriage that says when to leave
      const car = tr.querySelector('.car'), s = 1 / train.d, fits = train.w * s < W * .9;
      train.stopX = fits ? W / 2 - train.w * s / 2 : W / 2 - (car.offsetLeft + car.offsetWidth / 2) * s;
      train.phase = 'in'; train.sp = 0;
    }
  }
  function moveTrain(dt){
    if (!train) return;
    const s = 1 / train.d, v = readableAt(train.d) * 1.35;
    if (!still()){
      if (train.stopX == null) train.x -= v * dt / S;
      else {
        const acc = v * v / (2 * W * .35);
        if (train.phase === 'in'){
          const sp = Math.min(v, Math.sqrt(2 * acc * Math.max(0, train.x - train.stopX)) + 6);
          train.x = Math.max(train.stopX, train.x - sp * dt / S);
          if (train.x <= train.stopX + .5){ train.x = train.stopX; train.phase = 'dwell'; train.until = clock + 25e3; }
        } else if (train.phase === 'dwell'){ if (clock >= train.until) train.phase = 'out'; }
        else { train.sp = Math.min(v, train.sp + acc * dt / S); train.x -= train.sp * dt / S; }
      }
    }
    if (train.x < -train.w * s - 80){ train.el.parentNode && train.el.parentNode.removeChild(train.el); train = null; return; }
    train.el.style.transform = `translate(${train.x.toFixed(1)}px,${(H * train.y - train.h * s / 2 + view.y / train.d).toFixed(1)}px) scale(${s.toFixed(3)})`;
    train.el.style.zIndex = String(Math.round(100 / train.d));
  }
  /** How much of the platform to show: it comes in as your train slows, and goes once it has pulled away. */
  function platformK(){
    if (!train || train.stopX == null) return 0;
    if (train.phase === 'in') return clamp(1 - (train.x - train.stopX) / (W * .5), 0, 1);
    if (train.phase === 'dwell') return 1;
    return clamp(1 - (train.stopX - train.x) / (W * .4), 0, 1);
  }
  /** The guide rail the train runs on: it lights up as the train comes, and fades after. */
  function drawRail(dt){
    railK += ((train ? 1 : 0) - railK) * Math.min(1, dt / 900);
    if (railK < .02) return;
    const y = H * (narrow() ? .68 : .64) + (train ? train.h / train.d / 2 : 60) + 8;
    const pk = platformK();
    if (pk > 0){
      const x0 = Math.max(train.stopX - rem * 2, W * .04), x1 = Math.min(train.stopX + train.w / train.d + rem * 2, W * .96);
      actx.save(); actx.globalAlpha = pk; drawPlatform(actx, x0, x1, y + 4, train.h / train.d, voyage && voyage.train ? voyage.train.station : '', rem, clock); actx.restore();
    }
    const g = actx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(79,214,255,0)'); g.addColorStop(.5, `rgba(79,214,255,${.5 * railK})`); g.addColorStop(1, 'rgba(79,214,255,0)');
    actx.fillStyle = g; actx.fillRect(0, y, W, 2);
    actx.globalCompositeOperation = 'lighter'; actx.fillStyle = `rgba(150,230,255,${.6 * railK})`;
    if (tier === 0) for (let x = ((-clock * readableAt(1.3) / S) % 140 + 140) % 140; x < W; x += 140){ actx.beginPath(); actx.arc(x, y + 1, 2.2, 0, 7); actx.fill(); }
    actx.globalCompositeOperation = 'source-over';
  }

  /* ---------- the ship ---------- */
  function sway(t){
    const k = 1 + sky.wind * 2.5, sy = Math.sin(t / 7300) * 4 * k + Math.sin(t / 29000) * 7, sx = Math.sin(t / 19000) * 5;
    el('cShip').style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) rotate(${(Math.sin(t / 11000) * .16 * k).toFixed(3)}deg)`;
    view.x = -sx * 1.5; view.y = -sy * 1.5;
  }

  /* ---------- sizes and the loop ---------- */
  function resize(){
    W = innerWidth; H = innerHeight;
    const sharp = Math.min(tier === 0 ? 1.5 : 1, window.devicePixelRatio || 1);
    dpr = sharp * TIERS[tier].scale;
    [el('cSpace'), el('cNear'), el('cGlass')].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    const ca = el('cAhead'); ca.width = Math.round(W * sharp); ca.height = Math.round(H * sharp);   // text stays sharp at any tier
    sctx = el('cSpace').getContext('2d'); nctx = el('cNear').getContext('2d'); gctx = el('cGlass').getContext('2d'); actx = ca.getContext('2d');
    [sctx, nctx, gctx].forEach(c => c.setTransform(dpr, 0, 0, dpr, 0, 0)); actx.setTransform(sharp, 0, 0, sharp, 0, 0);
    aheadAt = -1e9; auroraCv = null; glassDrawn = ''; nearClear = false; intervals = [];
    makeStarSprites(); glassKey = ''; refreshPalette(true); lights = [];
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    stars = STAR_LAYERS.map((L, i) => { const n = Math.round(W * H / L.per * (quality === 1 ? 1 : .55)), a = []; for (let k = 0; k < n; k++) a.push(newStar(i, rnd(0, W))); return a; });
    nebulae = [makeLayer(quality === 1 ? 5 : 7, 3, 420, { warp: 2.2, band: .3, lo: .32, hi: .9, dust: 1, gain: .95 }),
               makeLayer(quality === 1 ? 4 : 6, 8, 140, { warp: 3.4, band: .22, lo: .5, hi: .95, dust: 0, gain: .7 })];
    body = null; moonX = 0; backDirty = true; moonKey = '';
  }
  function loop(t){
    if (!on) return;
    raf = requestAnimationFrame(loop);
    const T = TIERS[tier];
    if (last && t - last < 1000 / T.fps - 4) return;                // a frame cap, so a slow screen isn't asked for more
    const gap = last ? t - last : 16, dt = Math.min(80, gap); last = t; frame++; clock += dt;
    const growing = nebulae.some(l => !l.ready);
    nebulae.forEach(l => { if (!l.ready) growLayer(l, quality === 1 ? 10 : 6); });
    render(t, dt);
    // Keeping up? Judge over a few seconds once the nebulae are painted; step down a tier if not.
    if (adapt && !growing){
      intervals.push(gap);
      if (intervals.reduce((a, b) => a + b, 0) >= 3000){
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length; intervals = [];
        if (avg > 1000 / T.fps * 1.4 && tier < TIERS.length - 1){ tier++; learnt = tier; quality = .5; document.body.classList.add('lite'); resize(); }
      }
    }
  }
  function render(t, dt){
    sway(t); schedule();
    drawBackdrop(t, dt); drawSun(); drawComets(t, dt); drawTheMoon(dt); drawAurora(t, dt); drawLightning(t); drawBody(dt); drawStars(2, dt, t); drawThings(t, dt); drawHaze();
    aheadDt += dt;
    if (clock - aheadAt >= TIERS[tier].ahead || dt === 0){ aheadAt = clock; actx.clearRect(0, 0, W, H); drawAhead(t, aheadDt); drawRail(aheadDt); aheadDt = 0; }
    placeBoards(t, dt); moveTrain(dt); drawNear(t, dt);
    // the glass only needs drawing while something on it moves, or when it changes
    const frost = Math.max(sky.cold, sky.snow * .8), gk = [W, H, sky.fog, frost].join();
    if (sky.rain > 0 || sky.snow > 0 || drops.length || flakes.length || gk !== glassDrawn){
      glassDrawn = gk;
      if (tier === 0 || frame % 2 === 0) drawGlass(tier === 0 ? dt : dt * 2);
    }
  }
  /** Reduced motion: a still scene, redrawn every 30 seconds with new billboards. */
  function drawStill(){
    nebulae.forEach(l => { while (!l.ready) growLayer(l, 200); l.alpha = 1; });
    boards.forEach(b => b.el.parentNode && b.el.parentNode.removeChild(b.el)); boards = [];
    (narrow() ? [[NARROW[0], W / 2]] : [[NEAR[0], W * .3], [NEAR[1], W * .72]]).forEach(p => spawnBoard(p[0], p[1]));
    const t = performance.now(); render(t, 0);
  }
  function previewTrain(){
    startTrain(); if (!train) return;
    if (train.stopX != null){ train.x = train.stopX; train.phase = 'dwell'; train.until = clock + 25e3; } else train.x = W * .05;
  }
  /** A scene already under way: a billboard or two in view, so it never opens on empty space. */
  function setTheScene(){
    if (narrow()) spawnBoard(NARROW[0], W * .6);
    else { spawnBoard(NEAR[0], W * .46); laneI = 1; }
    nextNear = clock + 5e3;
    const show = String(preview.show || '');
    ['house', 'whales', 'jellies', 'birds', 'iss', 'comet', 'traffic'].forEach(k => { if (show.indexOf(k) >= 0) spawn(k, true); });
    if (show.indexOf('train') >= 0 && !train) previewTrain();
    const near = ['truss', 'rock', 'cruiser'].filter(k => show.indexOf(k) >= 0)[0];
    if (near || show.indexOf('flyby') >= 0){ startFlyby(near); flyby.x = W * .7; }
  }

  /** The cabin's dials: a needle for live draw, today's cost as a fuel gauge, grid carbon as a lamp. */
  function setInstruments(i){
    if (!i || !el('iDraw')) return;
    const off = (e, v) => { if (v) e.setAttribute('data-off', '1'); else e.removeAttribute('data-off'); };
    off(el('iDraw'), !i.draw);
    if (i.draw){ el('iNeedle').style.transform = `rotate(${((i.draw.frac - .5) * 180).toFixed(1)}deg)`; el('iDrawV').textContent = Math.round(i.draw.w).toLocaleString('en-GB') + ' W'; }
    off(el('iToday'), !i.cost && !i.carbon);
    el('iTodayK').textContent = i.cost ? 'Today' : 'Grid carbon';
    el('iFuel').className = 'fuel' + (!i.cost || i.cost.frac == null ? ' nousual' : i.cost.tone === 'bad' ? ' bad' : '');
    el('iCost').style.display = i.cost ? '' : 'none';
    if (i.cost){
      el('iCost').textContent = gbp(i.cost.p) + (i.cost.usual ? ' · usual ' + gbp(i.cost.usual) : ' so far');
      if (i.cost.frac != null){ el('iFill').style.width = (i.cost.frac * 100).toFixed(1) + '%'; el('iMark').style.left = (i.cost.mark * 100) + '%'; }
    }
    el('iAir').style.display = i.carbon ? '' : 'none';
    if (i.carbon){ el('iLamp').className = 'lamp ' + i.carbon.tone; el('iAirV').textContent = (i.cost ? 'Grid ' : '') + i.carbon.index; }
  }

  return {
    start(){
      if (on) return; on = true; document.body.classList.add('cockpit');
      clock = 0; timers = {}; things = []; issShown = -1e9; train = null; flyby = null; railK = 0;
      chooseTier(); resize(); last = 0; nextBolt = performance.now() + 2500;
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
      sky = info.sky; engine = info.engine; world = info.world; cards = info.cards; voyage = info.voyage || null;
      if (info.detail && info.detail !== detail){ detail = info.detail; if (on){ chooseTier(); resize(); } }
      setInstruments(info.instruments);
      if (train && train.mine && voyage && voyage.train){ const cs = myTrainCards(); [].forEach.call(train.el.querySelectorAll('.cpanel'), (p, i) => { const h = cs[i] && boardHtml(cs[i]); if (h && p.innerHTML !== h) p.innerHTML = h; }); }
      const next = info.preview || {}, changed = String(next.show || '') !== String(preview.show || '');
      preview = next;
      if (on && changed) setTheScene();
      else if (on && !train && /train/.test(String(preview.show || ''))) previewTrain();
      else if (on && train && !train.mine && /mytrain/.test(String(preview.show || '')) && voyage && voyage.train){ train.el.parentNode && train.el.parentNode.removeChild(train.el); train = null; previewTrain(); }
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
