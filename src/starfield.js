/* Starfield: three depth layers drifting slowly, gentle twinkle, the odd shooting star. Static when reduced motion is on. */
(() => {
  const cv = document.getElementById('stars'); if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tints = ['233,236,255','255,214,170','170,210,255','210,190,255'];
  let W = 0, H = 0, stars = [], shoot = null, last = 0;
  function seed(){
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W*dpr; cv.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    const n = Math.round(W*H/2600);
    stars = Array.from({length:n}, () => { const z = Math.random(); return { x:Math.random()*W, y:Math.random()*H, z, r:.35 + z*z*1.5, a:.35 + z*.6, tw:Math.random()*Math.PI*2, ts:.5 + Math.random()*1.6, c:tints[(Math.random()*tints.length)|0] }; });
  }
  function draw(t){
    // the screensaver covers the whole screen: rest until it's gone
    if (document.body.classList.contains('cockpit')){ last = 0; setTimeout(() => requestAnimationFrame(draw), 500); return; }
    // music coming out of this screen (body.hush on the wall display): a dozen frames a second, so Spotify's player has the time it needs
    if (document.body.classList.contains('hush') && last && t - last < 80){ requestAnimationFrame(draw); return; }
    const dt = Math.min(100, t - last || 16); last = t;
    ctx.clearRect(0,0,W,H);
    for (const s of stars){
      if (!still){ s.x -= (0.004 + s.z*s.z*0.03)*dt; if (s.x < -2){ s.x = W + 2; s.y = Math.random()*H; } s.tw += s.ts*dt/1000; }
      const a = s.a*(still ? 1 : 0.7 + 0.3*Math.sin(s.tw));
      ctx.fillStyle = `rgba(${s.c},${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
      if (s.r > 1.45){ ctx.fillStyle = `rgba(${s.c},${a*.12})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r*4, 0, Math.PI*2); ctx.fill(); }
    }
    if (!still){
      if (!shoot && Math.random() < dt/9000) shoot = { x: Math.random()*W*.8 + W*.2, y: Math.random()*H*.4, life: 0 };
      if (shoot){
        shoot.life += dt;
        const p = shoot.life/900, len = 140, x = shoot.x - p*W*.35, y = shoot.y + p*W*.12;
        const g = ctx.createLinearGradient(x, y, x + len, y - len*.34);
        g.addColorStop(0, `rgba(233,236,255,${.85*(1 - p)})`); g.addColorStop(1, 'rgba(233,236,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y - len*.34); ctx.stroke();
        if (p >= 1) shoot = null;
      }
      if (!document.hidden) requestAnimationFrame(draw); else document.addEventListener('visibilitychange', () => requestAnimationFrame(draw), { once: true });
    }
  }
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { seed(); if (still) draw(0); }, 200); });
  seed(); still ? draw(0) : requestAnimationFrame(draw);
})();
