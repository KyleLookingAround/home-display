/* ===================== cockpit: the screensaver, looking out of a rocket ship's window ===================== */
// Billboards carrying your live numbers fly past; the weather outside shows up on the glass and in the sky,
// and the power price sets the engines. Written for older TV browsers too: no ?. or ?? here.
const Cockpit = (() => {
  let on = false, raf = 0, last = 0, frame = 0, W = 0, H = 0, dpr = 1, quality = 1, slowFrames = 0, staticTimer = 0;
  let sctx = null, gctx = null, planetCache = null, planetKey = '', frostCache = null, frostKey = '';
  let stars = [], clouds = [], rocks = [], drops = [], flakes = [], motes = [], traffic = [], nextTraffic = 0, galaxies = [];
  let sky = skyFor(null), engine = engineFor(null), cards = [], rot = [], rotI = 0, boards = [], nextBoard = 0, laneI = 0;
  let bolt = null, nextBolt = 0, vp = { x: 0, y: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const el = id => document.getElementById(id);
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => W / H < 1.1;

  /* ---------- sizes ---------- */
  function resize(){
    W = innerWidth; H = innerHeight; dpr = Math.min(1.5, window.devicePixelRatio || 1);
    [el('cSpace'), el('cGlass')].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    sctx = el('cSpace').getContext('2d'); gctx = el('cGlass').getContext('2d');
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0); gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    planetKey = ''; frostKey = '';
    const n = Math.round(W * H / 3400 * quality);
    stars = []; for (let i = 0; i < n; i++) stars.push(newStar(true));
    motes = []; for (let i = 0; i < Math.round(26 * quality); i++) motes.push(newMote(true));
    galaxies = [{ x: .3, y: .3, r: .09, a: -.5, c: '190,170,255' }, { x: .66, y: .17, r: .05, a: .7, c: '150,210,255' }];
  }
  function newMote(anywhere){ return { x: rnd(-1.6, 1.6), y: rnd(-1, .9), z: anywhere ? rnd(.02, .25) : .25 }; }
  function newStar(anywhere){
    return { x: rnd(-1.7, 1.7), y: rnd(-1.1, 1.1), z: anywhere ? rnd(.05, 1) : 1, c: ['233,236,255', '255,220,180', '180,210,255', '215,195,255'][(Math.random() * 4) | 0] };
  }

  /* ---------- outside: sky, planet, stars, nebulae, debris, lightning ---------- */
  function project(x, y, z){ const f = W * .36; return { x: vp.x + x / z * f, y: vp.y + y / z * f }; }
  function drawSky(t){
    const c = sctx;
    c.fillStyle = sky.phase === 'day' ? '#050b24' : '#02030a'; c.fillRect(0, 0, W, H);
    const glow = (x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H); };
    if (sky.phase === 'dawn'){ glow(0, H, H * 1.1, '255,140,90', .32); glow(W * .2, H, H * .8, '255,95,174', .18); }
    if (sky.phase === 'dusk'){ glow(W, H, H * 1.1, '255,110,70', .3); glow(W * .8, H, H * .9, '170,80,255', .2); }
    if (sky.phase === 'day') glow(W * .18, H * .2, H * 1.3, '80,140,255', .22);
    glow(W * .85, H * .1, H * .9, '143,107,255', .12);
    if (engine.mode === 'warp') glow(vp.x, vp.y, H * .9, '184,146,255', .18 + .06 * Math.sin(t / 300));
    if (sky.phase === 'night' && sky.cloud < .8) drawMoon(W * .8, H * .24, H * .055);
    if (sky.sun > 0) drawSun(W * .2, H * .22, sky.sun);
  }
  function drawMoon(x, y, r){
    const c = sctx, g = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
    g.addColorStop(0, '#e8e9f2'); g.addColorStop(1, '#8c90a8');
    const halo = c.createRadialGradient(x, y, r, x, y, r * 3); halo.addColorStop(0, 'rgba(220,225,255,.12)'); halo.addColorStop(1, 'rgba(220,225,255,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(x, y, r * 3, 0, 7); c.fill();
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = 'rgba(90,95,120,.35)';
    [[-.3, -.1, .22], [.25, .3, .16], [.1, -.4, .1], [-.15, .4, .12]].forEach(k => { c.beginPath(); c.arc(x + k[0] * r, y + k[1] * r, k[2] * r, 0, 7); c.fill(); });
  }
  function drawSun(x, y, s){
    const c = sctx;
    let g = c.createRadialGradient(x, y, 0, x, y, H * .45);
    g.addColorStop(0, `rgba(255,250,230,${.95 * s})`); g.addColorStop(.06, `rgba(255,230,160,${.8 * s})`); g.addColorStop(.25, `rgba(255,180,90,${.18 * s})`); g.addColorStop(1, 'rgba(255,180,90,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // lens flare along the line through the middle of the view
    [[.35, .03, '255,200,120'], [.6, .018, '120,200,255'], [.95, .05, '184,146,255'], [1.25, .025, '70,230,161']].forEach(f => {
      const fx = x + (vp.x - x) * f[0] * 2, fy = y + (vp.y - y) * f[0] * 2, r = H * f[1] * 2;
      g = c.createRadialGradient(fx, fy, 0, fx, fy, r); g.addColorStop(0, `rgba(${f[2]},${.16 * s})`); g.addColorStop(1, `rgba(${f[2]},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(fx, fy, r, 0, 7); c.fill();
    });
  }
  /** A gas giant low on the right, its colours from the temperature outside, lit by the sun when there is one. */
  function drawPlanet(t){
    const r = H * .44, key = Math.round(sky.temp) + sky.phase + Math.round(t / 4000) + W + 'x' + H;
    if (key !== planetKey){
      planetKey = key;
      const cv = planetCache || document.createElement('canvas'); planetCache = cv;
      const s = Math.ceil(r * 2 + 4); cv.width = s; cv.height = s;
      const c = cv.getContext('2d'), cx = s / 2, temp = sky.temp;
      const pal = temp <= 0 ? ['#d6f3ff', '#7cc4ee', '#2d5f9e'] : temp <= 9 ? ['#a9f0e6', '#3fa7b5', '#1d4f78'] : temp <= 18 ? ['#ffe2a8', '#d9944a', '#7a3f2a'] : ['#ffd08a', '#e8633c', '#7d1f2a'];
      c.save(); c.beginPath(); c.arc(cx, cx, r, 0, 7); c.clip();
      const base = c.createLinearGradient(0, cx - r, 0, cx + r); base.addColorStop(0, pal[0]); base.addColorStop(.5, pal[1]); base.addColorStop(1, pal[2]);
      c.fillStyle = base; c.fillRect(0, 0, s, s);
      const off = t / 9000;
      for (let i = 0; i < 14; i++){
        const y = cx - r + (i + .5) * (2 * r / 14) + Math.sin(off + i * 1.7) * r * .02;
        c.fillStyle = i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)';
        c.fillRect(0, y - r * .05, s, r * (.04 + .03 * Math.abs(Math.sin(i * 2.3))));
      }
      const lx = sky.sun > 0 || sky.phase === 'dawn' ? cx - r * .5 : cx - r * .2;
      const shade = c.createRadialGradient(lx, cx - r * .5, r * .2, cx, cx, r * 1.05);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(.7, 'rgba(0,0,10,.35)'); shade.addColorStop(1, `rgba(0,0,10,${sky.phase === 'night' ? .85 : .7})`);
      c.fillStyle = shade; c.fillRect(0, 0, s, s); c.restore();
      c.strokeStyle = 'rgba(160,200,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cx, r, 0, 7); c.stroke();
    }
    const x = W * .86 + Math.sin(t / 60000) * W * .02 + (vp.x - W / 2) * .15, y = H * .9 + (vp.y - H * .42) * .15;
    sctx.drawImage(planetCache, x - planetCache.width / 2, y - planetCache.height / 2);
  }
  /** Faint spiral galaxies, so far away they barely move. */
  function drawGalaxies(){
    const c = sctx;
    for (const g of galaxies){
      const x = W * g.x + (vp.x - W / 2) * .04, y = H * g.y + (vp.y - H * .42) * .04, r = H * g.r;
      c.save(); c.translate(x, y); c.rotate(g.a); c.scale(1, .38);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${g.c},.32)`); gr.addColorStop(.25, `rgba(${g.c},.12)`); gr.addColorStop(1, `rgba(${g.c},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
      c.strokeStyle = `rgba(${g.c},.1)`; c.lineWidth = r * .08;
      for (let k = 0; k < 2; k++){ c.beginPath(); for (let i = 0; i < 30; i++){ const an = i / 30 * 4 + k * Math.PI, rr = r * (.15 + i / 30 * .75); c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } c.stroke(); }
      c.restore();
    }
  }
  /** Things passing at their own distances: satellites, freighters, a ring station, tumbling asteroids. Far ones are small, dim and blue. */
  function drawTraffic(t, dt){
    if (t > nextTraffic && traffic.length < 3){
      const kinds = ['satellite', 'freighter', 'station', 'asteroid', 'satellite', 'freighter'];
      const side = Math.random() < .5 ? -1 : 1;
      traffic.push({ kind: kinds[(Math.random() * kinds.length) | 0], x: side * rnd(.35, 1.1), y: rnd(-.55, .25), z: 1, vx: rnd(-.04, .04), spin: rnd(-.6, .6), a: rnd(0, 6), born: t });
      nextTraffic = t + rnd(9000, 22000) / Math.max(.6, engine.speed);
    }
    traffic.sort((a, b) => b.z - a.z);
    for (let i = traffic.length - 1; i >= 0; i--){
      const o = traffic[i];
      o.z -= .045 * engine.speed * dt / 1000; o.x += o.vx * dt / 1000; o.a += o.spin * dt / 1000;
      const p = project(o.x, o.y, o.z), size = W * .016 / o.z;
      if (o.z < .06 || p.x < -size * 4 || p.x > W + size * 4 || p.y > H + size * 4){ traffic.splice(i, 1); continue; }
      const near = clamp(1 - o.z, 0, 1), fade = Math.min(1, (t - o.born) / 2500);
      sctx.save(); sctx.globalAlpha = fade * (.35 + .65 * near); sctx.translate(p.x, p.y);
      shapes[o.kind](sctx, size, o.a, near, t);
      // distance haze: far things take on the colour of space
      sctx.restore();
    }
  }
  const shapes = {
    satellite(c, s, a, near, t){
      c.rotate(a * .3);
      c.fillStyle = `rgb(${Math.round(60 + 120 * near)},${Math.round(70 + 110 * near)},${Math.round(110 + 100 * near)})`; c.fillRect(-s * .35, -s * .25, s * .7, s * .5);
      c.fillStyle = `rgba(60,120,220,${.5 + .4 * near})`; c.strokeStyle = 'rgba(160,210,255,.6)'; c.lineWidth = Math.max(.5, s * .03);
      [-1, 1].forEach(d => { c.fillRect(d > 0 ? s * .45 : -s * 1.75, -s * .22, s * 1.3, s * .44); c.strokeRect(d > 0 ? s * .45 : -s * 1.75, -s * .22, s * 1.3, s * .44);
        for (let k = 1; k < 4; k++){ const x = (d > 0 ? s * .45 : -s * 1.75) + k * s * .325; c.beginPath(); c.moveTo(x, -s * .22); c.lineTo(x, s * .22); c.stroke(); } });
      c.fillStyle = Math.sin(t / 400) > 0 ? '#ff6b7d' : 'rgba(255,107,125,.2)'; c.beginPath(); c.arc(0, -s * .3, Math.max(1, s * .07), 0, 7); c.fill();
    },
    freighter(c, s, a, near, t){
      const L = s * 3.2, h = s * .55;
      const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, `rgb(${Math.round(70 + 110 * near)},${Math.round(75 + 105 * near)},${Math.round(110 + 90 * near)})`); g.addColorStop(1, '#1a1d30');
      c.fillStyle = g; c.beginPath(); c.moveTo(-L / 2, -h * .6); c.lineTo(L / 2 - h, -h); c.quadraticCurveTo(L / 2 + h * .4, 0, L / 2 - h, h); c.lineTo(-L / 2, h * .6); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,214,140,.9)'; for (let k = 0; k < 7; k++) c.fillRect(-L / 2 + L * (.15 + k * .1), -h * .2, Math.max(1, s * .08), Math.max(1, s * .08));
      const e = c.createRadialGradient(-L / 2, 0, 0, -L / 2, 0, h * 2); e.addColorStop(0, 'rgba(120,230,255,.9)'); e.addColorStop(1, 'rgba(79,214,255,0)');
      c.fillStyle = e; c.beginPath(); c.arc(-L / 2, 0, h * 2, 0, 7); c.fill();
      c.fillStyle = Math.sin(t / 300) > .3 ? '#46e6a1' : 'rgba(70,230,161,.2)'; c.beginPath(); c.arc(L / 2 - h * .6, -h * .9, Math.max(1, s * .06), 0, 7); c.fill();
    },
    station(c, s, a, near){
      const R = s * 2.2, col = `rgba(${Math.round(140 + 100 * near)},${Math.round(150 + 90 * near)},${Math.round(190 + 60 * near)},`;
      c.save(); c.scale(1, .42); c.lineWidth = Math.max(1, s * .3); c.strokeStyle = col + '.9)'; c.beginPath(); c.arc(0, 0, R, 0, 7); c.stroke();
      c.lineWidth = Math.max(.5, s * .06); c.strokeStyle = col + '.55)';
      for (let k = 0; k < 4; k++){ const an = a + k * Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an) * R, Math.sin(an) * R); c.stroke(); }
      c.fillStyle = 'rgba(255,214,140,.85)';
      for (let k = 0; k < 16; k++){ const an = a + k * Math.PI / 8; c.beginPath(); c.arc(Math.cos(an) * R, Math.sin(an) * R, Math.max(.8, s * .07), 0, 7); c.fill(); }
      c.restore();
      c.fillStyle = col + '1)'; c.beginPath(); c.arc(0, 0, s * .45, 0, 7); c.fill();
    },
    asteroid(c, s, a, near){
      c.rotate(a); const r = s * 1.1;
      const g = c.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, `rgb(${Math.round(90 + 80 * near)},${Math.round(80 + 70 * near)},${Math.round(95 + 60 * near)})`); g.addColorStop(1, '#16131f');
      c.fillStyle = g; c.beginPath(); for (let i = 0; i < 11; i++){ const an = i / 11 * 6.283, rr = r * (.75 + .25 * Math.sin(i * 2.3 + 1)); c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,.25)'; [[.3, .2, .2], [-.25, .35, .14], [.05, -.35, .12]].forEach(k => { c.beginPath(); c.arc(k[0] * r, k[1] * r, k[2] * r, 0, 7); c.fill(); });
    }
  };
  /** Dust right by the glass: big, soft and fast, the nearest layer of all. */
  function drawMotes(dt){
    const c = sctx, dz = .05 * engine.speed * dt / 1000;
    for (const m of motes){
      m.z -= dz;
      const p = project(m.x, m.y, m.z);
      if (m.z < .012 || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60){ Object.assign(m, newMote(false)); continue; }
      const r = Math.min(9, .045 / m.z), a = Math.min(.35, (.25 - m.z) * 2);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(220,230,255,${a})`); g.addColorStop(1, 'rgba(220,230,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    }
  }
  function drawStars(dt){
    const c = sctx, speed = .075 * engine.speed * (1 + sky.wind * .3), dz = speed * dt / 1000, trail = 4 + engine.speed * 7;
    c.lineCap = 'round';
    for (const s of stars){
      s.z -= dz;
      const p = project(s.x, s.y, s.z);
      if (s.z < .03 || p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50){ Object.assign(s, newStar(false)); continue; }
      const q = project(s.x, s.y, Math.min(1, s.z + dz * trail)), a = Math.min(1, (1 - s.z) * 1.3), w = Math.max(.6, 1.9 * (1 - s.z));
      c.strokeStyle = `rgba(${engine.mode === 'warp' ? '215,195,255' : s.c},${a})`; c.lineWidth = w;
      c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(p.x + .01, p.y); c.stroke();
    }
  }
  function drawClouds(dt){
    const want = Math.round(sky.cloud * 7 + sky.fog * 3);
    while (clouds.length < want) clouds.push({ x: rnd(-1.4, 1.4), y: rnd(-.8, .6), z: clouds.length ? 1 : rnd(.3, 1), r: rnd(.5, 1.1), h: (Math.random() * 3) | 0 });
    if (clouds.length > want) clouds.length = want;
    const c = sctx, stormy = sky.rain > 0 || sky.thunder, cols = stormy ? ['70,85,120', '55,60,105', '90,100,140'] : ['143,107,255', '255,95,174', '79,214,255'];
    for (const k of clouds){
      k.z -= .02 * engine.speed * dt / 1000;
      if (k.z < .12) Object.assign(k, { x: rnd(-1.4, 1.4), y: rnd(-.8, .6), z: 1 });
      const p = project(k.x, k.y, k.z), R = k.r / k.z * W * .09, a = Math.min(.3, (1 - k.z) * .45) * (stormy ? 1.3 : 1);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R); g.addColorStop(0, `rgba(${cols[k.h]},${a})`); g.addColorStop(1, `rgba(${cols[k.h]},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, R, 0, 7); c.fill();
    }
  }
  function drawRocks(dt){
    const want = Math.round(sky.wind * 9);
    while (rocks.length < want) rocks.push({ x: -40 - Math.random() * W * .5, y: rnd(H * .12, H * .68), v: rnd(60, 180), r: rnd(4, 15), a: rnd(0, 6), va: rnd(-2, 2) });
    if (rocks.length > want) rocks.length = want;
    const c = sctx;
    for (const k of rocks){
      k.x += k.v * (dt / 1000) * (1 + sky.wind); k.a += k.va * dt / 1000;
      if (k.x > W + 40) Object.assign(k, { x: -40, y: rnd(H * .12, H * .68) });
      c.save(); c.translate(k.x, k.y); c.rotate(k.a); c.fillStyle = '#4a4560'; c.strokeStyle = 'rgba(200,190,255,.35)';
      c.beginPath(); for (let i = 0; i < 7; i++){ const an = i / 7 * 6.283, rr = k.r * (.7 + .3 * Math.sin(i * 2.7 + k.r)); c[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); }
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }
  }
  function drawLightning(t){
    if (!sky.thunder) return;
    if (!bolt && t > nextBolt){
      const pts = [], x0 = rnd(W * .2, W * .8); let x = x0, y = H * .1;
      while (y < H * rnd(.45, .6)){ pts.push([x, y]); x += rnd(-40, 40); y += rnd(18, 45); }
      bolt = { pts, until: t + 180 }; nextBolt = t + rnd(4000, 11000);
      const f = el('cFlash'); f.style.transition = 'none'; f.style.opacity = '.45';
      setTimeout(() => { f.style.transition = 'opacity .9s'; f.style.opacity = '0'; }, 60);
    }
    if (bolt){
      const c = sctx; c.strokeStyle = 'rgba(230,235,255,.95)'; c.lineWidth = 2.5; c.shadowColor = '#b892ff'; c.shadowBlur = 18;
      c.beginPath(); bolt.pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](p[0], p[1])); c.stroke(); c.shadowBlur = 0;
      if (t > bolt.until) bolt = null;
    }
  }
  function drawHaze(){
    if (engine.dust > 0){ sctx.fillStyle = `rgba(150,105,60,${engine.dust * .13})`; sctx.fillRect(0, 0, W, H); }
  }

  /* ---------- the glass: rain, snow, frost, fog ---------- */
  function drawGlass(dt){
    const c = gctx; c.clearRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(.3, 'rgba(255,255,255,0)'); g.addColorStop(.42, 'rgba(255,255,255,.035)'); g.addColorStop(.5, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (sky.fog > 0){
      c.fillStyle = `rgba(165,180,210,${.26 * sky.fog})`; c.fillRect(0, 0, W, H);
      const fg = c.createRadialGradient(W / 2, H * .45, H * .1, W / 2, H * .45, H * .9); fg.addColorStop(0, 'rgba(165,180,210,0)'); fg.addColorStop(1, `rgba(165,180,210,${.3 * sky.fog})`);
      c.fillStyle = fg; c.fillRect(0, 0, W, H);
    }
    const frost = Math.max(sky.cold, sky.snow * .8);
    if (frost > 0){ c.globalAlpha = frost; c.drawImage(frostLayer(), 0, 0, W, H); c.globalAlpha = 1; }
    const sec = dt / 1000;
    // rain: drops land, sit, and now and then one runs down the glass
    if (sky.rain > 0 && drops.length < 170 * sky.rain && Math.random() < sky.rain * 9 * sec) drops.push({ x: rnd(0, W), y: rnd(0, H * .82), r: rnd(1.5, 4.5) * (W > 1400 ? 1.4 : 1), life: rnd(15e3, 45e3), age: 0, vy: 0 });
    if (sky.rain > 0 && Math.random() < sky.rain * .7 * sec){ const d = drops[(Math.random() * drops.length) | 0]; if (d && d.r > 3 && !d.vy) d.vy = rnd(30, 90); }
    for (let i = drops.length - 1; i >= 0; i--){
      const d = drops[i]; d.age += dt;
      if (d.vy){ d.y += d.vy * sec; d.vy = Math.min(220, d.vy + 40 * sec); if (Math.random() < 3 * sec) drops.push({ x: d.x + rnd(-1, 1), y: d.y - d.r * 2, r: d.r * .4, life: rnd(4e3, 9e3), age: 0, vy: 0 }); }
      if (d.age > d.life || d.y > H){ drops.splice(i, 1); continue; }
      const a = Math.min(1, (d.life - d.age) / 2500);
      c.fillStyle = `rgba(170,200,255,${.13 * a})`; c.strokeStyle = `rgba(230,240,255,${.32 * a})`; c.lineWidth = .8;
      c.beginPath(); if (d.vy) c.ellipse(d.x, d.y, d.r * .85, d.r * 1.25, 0, 0, 7); else c.arc(d.x, d.y, d.r, 0, 7); c.fill(); c.stroke();
      c.fillStyle = `rgba(255,255,255,${.55 * a})`; c.beginPath(); c.arc(d.x - d.r * .35, d.y - d.r * .35, d.r * .28, 0, 7); c.fill();
    }
    // snow: flakes stick to the glass and slowly melt
    if (sky.snow > 0 && flakes.length < 150 * sky.snow && Math.random() < sky.snow * 7 * sec) flakes.push({ x: rnd(0, W), y: rnd(0, H * .85), r: rnd(1.5, 4) * (W > 1400 ? 1.4 : 1), life: rnd(20e3, 50e3), age: 0, a: rnd(0, 3) });
    for (let i = flakes.length - 1; i >= 0; i--){
      const f = flakes[i]; f.age += dt; if (f.age > f.life){ flakes.splice(i, 1); continue; }
      const a = Math.min(1, (f.life - f.age) / 4000) * .85;
      c.strokeStyle = `rgba(240,248,255,${a})`; c.lineWidth = 1;
      c.beginPath(); for (let k = 0; k < 3; k++){ const an = f.a + k * 1.047; c.moveTo(f.x - Math.cos(an) * f.r, f.y - Math.sin(an) * f.r); c.lineTo(f.x + Math.cos(an) * f.r, f.y + Math.sin(an) * f.r); } c.stroke();
    }
  }
  /** Frost creeping in from the edges of the glass, drawn once per size. */
  function frostLayer(){
    const key = W + 'x' + H;
    if (key === frostKey && frostCache) return frostCache;
    frostKey = key;
    const cv = frostCache || document.createElement('canvas'); frostCache = cv; cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), edge = (x0, y0, x1, y1) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(225,240,255,.42)'); g.addColorStop(1, 'rgba(225,240,255,0)'); return g; };
    const m = Math.min(W, H) * .22;
    c.fillStyle = edge(0, 0, m, 0); c.fillRect(0, 0, m, H);
    c.fillStyle = edge(W, 0, W - m, 0); c.fillRect(W - m, 0, m, H);
    c.fillStyle = edge(0, 0, 0, m); c.fillRect(0, 0, W, m);
    c.strokeStyle = 'rgba(235,245,255,.5)'; c.lineWidth = 1;
    const branch = (x, y, an, len, depth) => {
      if (depth > 3 || len < 4) return;
      const x2 = x + Math.cos(an) * len, y2 = y + Math.sin(an) * len;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
      branch(x2, y2, an + rnd(-.5, .5), len * .7, depth + 1);
      if (Math.random() < .7) branch(x + (x2 - x) * .5, y + (y2 - y) * .5, an + (Math.random() < .5 ? -1 : 1) * rnd(.6, 1.1), len * .5, depth + 1);
    };
    for (let i = 0; i < 70; i++){
      const side = i % 3, len = m * rnd(.15, .4);
      if (side === 0) branch(0, rnd(0, H), rnd(-.6, .6), len, 0);
      else if (side === 1) branch(W, rnd(0, H), Math.PI + rnd(-.6, .6), len, 0);
      else branch(rnd(0, W), 0, Math.PI / 2 + rnd(-.6, .6), len, 0);
    }
    return cv;
  }

  /* ---------- billboards ---------- */
  const LANES = [{ x: -.27, y: -.06, cls: '' }, { x: .27, y: -.02, cls: '' }, { x: 0, y: -.27, cls: 'wide' }];
  const NARROW_LANES = [{ x: 0, y: -.17, cls: 'wide' }, { x: 0, y: .05, cls: 'wide' }];
  function boardHtml(card){
    return `<span class="bh">${esc(card.head)}</span><span class="bb">${esc(card.big)}</span>${card.sub ? `<span class="bs">${esc(card.sub)}</span>` : ''}`;
  }
  function spawn(t){
    if (!rot.length) return;
    // Never the same billboard twice on screen at once.
    let card = rot[rotI++ % rot.length];
    for (let k = 0; k < rot.length && boards.some(b => b.id === card.id); k++) card = rot[rotI++ % rot.length];
    if (boards.some(b => b.id === card.id)) return;
    const lanes = narrow() ? NARROW_LANES : LANES, lane = lanes[laneI++ % lanes.length];
    const b = document.createElement('div');
    b.className = `board tone-${card.tone} ${lane.cls}${String(card.big).length > 11 ? ' long' : ''}`; b.setAttribute('data-card', card.id); b.innerHTML = boardHtml(card);
    el('cBoards').appendChild(b);
    boards.push({ el: b, id: card.id, lane, born: t, life: still() ? 20000 : 15000, w: b.offsetWidth, h: b.offsetHeight, seed: Math.random() * 6 });
  }
  function scaleAt(p){
    if (p < .3){ const q = p / .3; return .04 + .81 * Math.pow(q, 2.2); }
    if (p < .8) return .85 + .2 * (p - .3) / .5;
    const q = (p - .8) / .2; return 1.05 + 2.6 * q * q;
  }
  function placeBoards(t){
    for (let i = boards.length - 1; i >= 0; i--){
      const b = boards[i], p = (t - b.born) / b.life;
      if (p >= 1){ b.el.parentNode && b.el.parentNode.removeChild(b.el); boards.splice(i, 1); continue; }
      const s = still() ? 1 : scaleAt(p), bob = Math.sin(t / 1700 + b.seed) * 5 * s;
      const x = vp.x + b.lane.x * W * s, y = vp.y + b.lane.y * H * s + bob;
      const a = still() ? 1 : p < .08 ? p / .08 : p > .86 ? Math.max(0, 1 - (p - .86) / .14) : 1;
      // Side billboards turn to face you as they pass; the overhead one tips down. Far away they're soft, dim and blue.
      const turn = still() ? 0 : Math.min(1, s), ry = b.lane.x < 0 ? 18 * turn : b.lane.x > 0 ? -18 * turn : 0, rx = b.lane.x === 0 ? (b.lane.y < 0 ? -12 : 10) * turn : 0;
      b.el.style.transform = `translate(${(x - b.w / 2).toFixed(1)}px,${(y - b.h / 2).toFixed(1)}px) scale(${s.toFixed(3)}) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;
      b.el.style.opacity = a.toFixed(3);
      const far = clamp((.6 - s) / .56, 0, 1);
      b.el.style.filter = far > 0 ? `${quality === 1 ? `blur(${(far * 3).toFixed(2)}px) ` : ''}brightness(${(1 - far * .45).toFixed(2)}) saturate(${(1 - far * .5).toFixed(2)})` : '';
      b.el.style.zIndex = String(Math.round(s * 100));
    }
    if (t >= nextBoard){ spawn(t); nextBoard = t + (still() ? 10000 : narrow() ? 7600 : 5600); }
  }

  /* ---------- the ship ---------- */
  function sway(t){
    el('cBoards').style.perspectiveOrigin = `${vp.x.toFixed(0)}px ${vp.y.toFixed(0)}px`;
    const k = 1 + sky.wind * 2.5, sx = Math.sin(t / 6300) * 6 * k + Math.sin(t / 23000) * 10, sy = Math.sin(t / 8100) * 4 * k + Math.sin(t / 31000) * 7;
    const r = Math.sin(t / 9700) * .22 * k;
    el('cShip').style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) rotate(${r.toFixed(3)}deg)`;
    vp.x = W / 2 - sx * 1.6; vp.y = H * (narrow() ? .36 : .42) - sy * 1.6;
  }

  function loop(t){
    if (!on) return;
    const dt = Math.min(80, t - (last || t)); last = t; frame++;
    if (dt > 34) slowFrames++; else if (slowFrames > 0) slowFrames -= .25;
    if (slowFrames > 90 && quality > .5){ quality = .5; slowFrames = 0; resize(); }
    sway(t); drawSky(t); drawGalaxies(); drawPlanet(t); drawClouds(dt); drawStars(dt); drawTraffic(t, dt); drawRocks(dt); drawMotes(dt); drawLightning(t); drawHaze();
    if (quality === 1 || frame % 2 === 0) drawGlass(quality === 1 ? dt : dt * 2);
    placeBoards(t);
    raf = requestAnimationFrame(loop);
  }
  /** Reduced motion: one still frame, refreshed every 20 seconds with the next billboards. */
  function drawStill(){
    const t = performance.now();
    sway(0); drawSky(t); drawGalaxies(); drawPlanet(t); drawClouds(0); drawStars(0); drawHaze(); drawGlass(400);
    boards.forEach(b => b.el.parentNode && b.el.parentNode.removeChild(b.el)); boards = [];
    LANES.slice(0, narrow() ? 1 : 2).forEach(() => spawn(t)); placeBoards(t + 1);
  }

  return {
    start(){
      if (on) return; on = true; document.body.classList.add('cockpit');
      resize(); last = 0; nextBoard = 0; nextBolt = performance.now() + 2500;
      if (still()){ drawStill(); staticTimer = setInterval(drawStill, 20000); }
      else raf = requestAnimationFrame(loop);
    },
    stop(){
      on = false; cancelAnimationFrame(raf); clearInterval(staticTimer); document.body.classList.remove('cockpit');
      boards.forEach(b => b.el.parentNode && b.el.parentNode.removeChild(b.el)); boards = []; drops = []; flakes = [];
    },
    resize(){ if (on){ resize(); if (still()) drawStill(); } },
    /** New data: the billboards to come, the sky, the engines and the dashboard. */
    update(info){
      sky = info.sky; engine = info.engine;
      const ids = info.cards.map(c => c.id + c.weight).join();
      if (ids !== cards.map(c => c.id + c.weight).join()){ rot = billboardRotation(info.cards); rotI = rotI % Math.max(1, rot.length); }
      cards = info.cards;
      boards.forEach(b => { const c = cards.filter(x => x.id === b.id)[0]; if (c){ const h = boardHtml(c); if (b.el.innerHTML !== h) b.el.innerHTML = h; } });
      const h = info.hud;
      el('hPrice').textContent = h.price; el('hPrice').className = 'v ' + h.priceTone;
      el('hEngine').textContent = engine.label; el('hEngine').className = 's ' + engine.tone;
      el('hTemp').textContent = h.temp; el('hWx').textContent = h.wx; el('hDateC').textContent = h.date;
      el('cHud').setAttribute('data-engine', engine.mode);
    },
    running: () => on
  };
})();
