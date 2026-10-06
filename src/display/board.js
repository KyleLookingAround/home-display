/* ===================== display: drawing helpers for Today, Energy and Travel, in the dashboard's look ===================== */
// Plain script for TV browsers (Chromium 63): no ?. or ??. Draws with strings; display.js puts them on the page.

const PRICE_COL = { neg: '#b892ff', cheap: '#46e6a1', normal: '#ffd166', peak: '#ff6b7d', muted: '#9aa2c8' };
const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/** Line icons, the same set the phone uses. */
const ICON = {
  train: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l-2 2M15 20l2 2M9 16v4M15 16v4"/>',
  bins: '<path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15"/>',
  rain: '<path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>',
  flood: '<path d="M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17M3 21c2 0 2-1.5 4.5-1.5S9.5 21 12 21s2.5-1.5 4.5-1.5S19 21 21 21M12 3v9M8.5 8.5 12 12l3.5-3.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  release: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5.5a6.5 6.5 0 0 0-6.5 6.5"/>',
  gig: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  cake: '<path d="M4 21h16M5 21v-8h14v8M8 13v-3M12 13v-3M16 13v-3M8 7.5a1 1 0 0 0 1-1C9 5.7 8 4.5 8 4.5S7 5.7 7 6.5a1 1 0 0 0 1 1zM12 7.5a1 1 0 0 0 1-1C13 5.7 12 4.5 12 4.5s-1 1.2-1 2a1 1 0 0 0 1 1zM16 7.5a1 1 0 0 0 1-1c0-.8-1-2-1-2s-1 1.2-1 2a1 1 0 0 0 1 1zM5 16.5c2.3 1 4.7 1 7 0s4.7-1 7 0"/>'
};
const icon = k => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;

/** A heads-up, as on the phone's Now page. */
function headsHtml(items){
  return items.map(it => `<div class="hu ${it.tone}">${icon(it.kind)}<span class="t"><b>${esc(it.title)}</b><span class="s">${esc(it.sub)}</span></span>${it.colours ? `<span class="dots">${it.colours.map(c => `<i style="background:${BIN_COLOURS[c] || BIN_COLOURS.grey}"></i>`).join('')}</span>` : ''}</div>`).join('');
}

/** What the region's power is made of, as a bar and its biggest three. */
const FUEL_COL = { wind: '#4fd6ff', solar: '#ffd166', hydro: '#2f7bff', nuclear: '#b892ff', biomass: '#46e6a1', gas: '#ff8a5c', coal: '#6c7399', imports: '#9aa2c8', other: '#6c7399' };
function mixHtml(g){
  if (!g) return '';
  return `<div class="mix">${g.mix.map(f => `<i style="flex:${f.perc};background:${FUEL_COL[f.fuel] || '#6c7399'}"></i>`).join('')}</div>`
    + `<p class="legend">${g.mix.slice(0, 2).map(f => `<span><i style="background:${FUEL_COL[f.fuel] || '#6c7399'}"></i>${esc(f.name)} ${Math.round(f.perc)}%</span>`).join('')}</p>`;
}

/**
 * The price strip: Agile over a stretch of time as a smooth line coloured by price, the cheapest two hours shaded,
 * rain as bands, events and your train as markers, and now as a dashed line. Sized in real pixels so its text stays sharp.
 * o: { from, to, rates, cheap, rain: [{ from, to }], markers: [{ t, kind, label }], now, width, height }
 */
function stripSvg(o){
  const W = Math.max(200, o.width), H = Math.max(80, o.height), fs = Math.round(remPx() * 0.9);
  const top = fs * 1.6, bottom = fs * 1.7, ih = H - top - bottom;
  const span = o.to - o.from, x = t => (t - o.from) / span * W;
  const rates = (o.rates || []).filter(r => r.to > o.from && r.from < o.to);
  if (!rates.length) return '';
  const ps = rates.map(r => r.p), lo = Math.min(0, Math.min.apply(null, ps)), hi = Math.max(20, Math.max.apply(null, ps));
  const y = v => top + ih - (v - lo) / (hi - lo) * ih;
  const pts = rates.map(r => [x(Math.max(o.from, Math.min(o.to, (r.from + r.to) / 2))), y(r.p)]);
  pts.unshift([0, pts[0][1]]); pts.push([W, pts[pts.length - 1][1]]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++){
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const id = 'g' + Math.round(Math.random() * 1e6);
  const stops = rates.map(r => { const off = Math.max(0, Math.min(1, x((r.from + r.to) / 2) / W)); return `<stop offset="${off.toFixed(4)}" stop-color="${PRICE_COL[priceTone(r.p)]}"/>`; }).join('');
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Agile prices')}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="${W}" y2="0" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`
    + `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}m"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}f)"/></mask></defs>`;
  (o.rain || []).forEach(b => { const a = Math.max(0, x(b.from)), e = Math.min(W, x(b.to)); if (e > a) s += `<rect class="rainb" x="${a.toFixed(1)}" y="${top.toFixed(1)}" width="${(e - a).toFixed(1)}" height="${ih.toFixed(1)}"/><text class="lbl rain" x="${(a + 6).toFixed(1)}" y="${(top + fs).toFixed(1)}" font-size="${fs}">Rain</text>`; });
  if (o.cheap){ const a = Math.max(0, x(o.cheap.from)), e = Math.min(W, x(o.cheap.to)); if (e > a) s += `<rect class="cheapb" x="${a.toFixed(1)}" y="${top.toFixed(1)}" width="${(e - a).toFixed(1)}" height="${ih.toFixed(1)}"/><text class="lbl cheap" x="${((a + e) / 2).toFixed(1)}" y="${(top - fs * 0.45).toFixed(1)}" text-anchor="middle" font-size="${fs}">Cheapest</text>`; }
  if (lo < 0) s += `<line class="zero" x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>`;
  s += `<path d="${d}L${W} ${(top + ih).toFixed(1)}L0 ${(top + ih).toFixed(1)}Z" fill="url(#${id})" mask="url(#${id}m)"/><path d="${d}" fill="none" stroke="url(#${id})" stroke-width="${Math.max(3, fs * 0.14).toFixed(1)}" stroke-linecap="round"/>`;
  (o.markers || []).forEach(m => {
    if (m.t < o.from || m.t > o.to) return;
    const mx = x(m.t), my = top + ih * 0.18;
    s += `<line class="mk" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${my.toFixed(1)}" y2="${(top + ih).toFixed(1)}"/>`
      + (m.kind === 'train' ? `<circle class="mkt" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${(fs * 0.32).toFixed(1)}"/>` : `<rect class="mke" x="${(mx - fs * 0.28).toFixed(1)}" y="${(my - fs * 0.28).toFixed(1)}" width="${(fs * 0.56).toFixed(1)}" height="${(fs * 0.56).toFixed(1)}" transform="rotate(45 ${mx.toFixed(1)} ${my.toFixed(1)})"/>`);
  });
  if (o.now >= o.from && o.now <= o.to){ const nx = x(o.now); s += `<line class="nowl" x1="${nx.toFixed(1)}" x2="${nx.toFixed(1)}" y1="${(top - fs * 0.2).toFixed(1)}" y2="${(top + ih).toFixed(1)}"/><circle class="nowd" cx="${nx.toFixed(1)}" cy="${y(lookup(rates, o.now) != null ? lookup(rates, o.now) : rates[0].p).toFixed(1)}" r="${(fs * 0.26).toFixed(1)}"/>`; }
  // hour labels along the bottom, spaced so they never touch
  const step = span > 26 * 3600e3 ? 6 : 3, first = new Date(o.from); first.setMinutes(0, 0, 0);
  let last = -1e9;
  for (let t = +first + 3600e3; t < o.to; t += 3600e3){
    const dt = new Date(t); if (dt.getHours() % step) continue;
    const tx = x(t); if (tx < fs * 1.5 || tx > W - fs * 1.5 || tx - last < fs * 4.2 || (o.now >= o.from && Math.abs(tx - x(o.now)) < fs * 3.6)) continue;
    s += `<text class="lbl" x="${tx.toFixed(1)}" y="${(H - fs * 0.45).toFixed(1)}" text-anchor="middle" font-size="${fs}">${dt.getHours() === 0 ? DOW[dt.getDay()] : pad2(dt.getHours()) + ':00'}</text>`;
    last = tx;
  }
  if (o.now >= o.from && o.now <= o.to) s += `<text class="lbl now" x="${Math.max(fs * 1.4, x(o.now)).toFixed(1)}" y="${(H - fs * 0.45).toFixed(1)}" text-anchor="middle" font-size="${fs}">Now</text>`;
  return s + '</svg>';
}

/**
 * The trains as the station shows them, in orange dot-matrix: the departures board (time, destination, platform,
 * expected, and when to leave with your walk; the ones it's too late for dimmed) and the platform sign (1st, 2nd, 3rd
 * from the first you can make, a scrolling line with where it calls, and a clock with seconds, which tick() fills).
 * Returned in two parts, so each is only redrawn when it changes and the scrolling line runs on undisturbed.
 */
function signHtml(trains, walk, now){
  const S = signTrains(trains.list, walk, now, 7), cell = (cls, t) => `<span class="${cls}">${esc(t)}</span>`;
  const board = `<div class="row hdr">${cell('t', 'Time')}${cell('d', 'Destination')}${cell('p', 'Plat')}${cell('s', 'Expt')}${cell('g', 'Leave')}</div>`
    + (S.board.length ? S.board.map(d => { const g = signGo(d, walk, now, true);
      return `<div class="row${g.late ? ' dim' : ''}">${cell('t', hhmm(d.sched))}${cell('d', d.dest)}${cell('p', d.platform || '-')}${cell('s', signExpected(d))}<span class="g${g.run ? ' blink' : ''}">${esc(g.text)}</span></div>`; }).join('')
      : '<div class="row centre">No departures listed</div>');
  const line = signLine(S.first3[0], trains.messages);
  let plat = '';
  S.first3.forEach((d, i) => {
    plat += `<div class="row">${cell('o', ordinal(i + 1))}${cell('t', hhmm(d.sched))}${cell('d', d.dest)}${cell('s', signStatus(d))}</div>`;
    if (i === 0 && line) plat += `<div class="row calls"><span class="run" style="animation-duration:${Math.max(10, Math.round(line.length * 0.18))}s">${esc(line)}</span></div>`;
  });
  if (!S.first3.length) plat = `<div class="row centre">${S.missed ? 'No more you can make' : 'No trains for now'}</div><div class="row centre dim">Please check the timetable</div>`;
  return { board: board, platform: plat + '<div class="clock-s" data-clock-s></div>' };
}

/* ---------- the journey map (src/lib/geo.js): Esri's dark grey tiles with the route, stations, home and the train ---------- */
function mapHtml(j, w, h){
  const v = fitView(j.fit.length ? j.fit : j.places, w, h, 60, 9, 15), pt = p => onView(v, p), xy = p => { const q = pt(p); return q.x.toFixed(1) + ',' + q.y.toFixed(1); };
  const tiles = viewTiles(v).map(t => `<img src="${mapTile(t)}" alt="" style="left:${t.left}px;top:${t.top}px">`).join('');
  let svg = j.walks.map(wk => `<polyline class="walk" points="${wk.map(xy).join(' ')}"/>`).join('');
  if (j.route.length) svg += `<polyline class="glow" points="${j.route.map(xy).join(' ')}"/><polyline class="route" points="${j.route.map(xy).join(' ')}"/>`;
  j.places.forEach(p => {
    const q = pt(p);
    if (p.kind === 'station') svg += `<circle class="stn${p.major ? ' big' : ''}" cx="${q.x}" cy="${q.y}" r="${p.major ? 9 : 6}"/>`;
    else if (p.kind === 'home') svg += `<g class="home" transform="translate(${q.x},${q.y}) scale(1.8)"><path d="M-7 1 0-6 7 1M-5 0v6h10V0"/></g>`;
    else if (p.kind === 'you') svg += `<circle class="you-ring" cx="${q.x}" cy="${q.y}" r="22"/><circle class="you" cx="${q.x}" cy="${q.y}" r="11"/>`;
    else if (p.kind === 'train') svg += `<circle class="train-ring" cx="${q.x}" cy="${q.y}" r="24"/><circle class="train" cx="${q.x}" cy="${q.y}" r="14"/>`;
  });
  j.places.filter(p => p.label).forEach(p => { const q = pt(p), left = p.right === false || (p.right !== true && q.x > w * 0.6); svg += `<text class="lbl${p.kind !== 'station' || p.major ? ' strong' : ''}" x="${q.x + (left ? -20 : 18)}" y="${q.y + 8}" text-anchor="${left ? 'end' : 'start'}">${esc(p.label)}</text>`; });
  return `<div class="jmap" style="height:${h}px">${tiles}<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${svg}</svg><span class="credit">${esc(MAP_CREDIT)}</span></div>`;
}
