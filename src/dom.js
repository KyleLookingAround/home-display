/* ===================== interface ===================== */
const state = {
  gasUnit: store.get('gasUnit') || 'm3', pay: store.get('pay') || 'DIRECT_DEBIT',
  days: 30, unit: 'gbp', region: store.get('region') || 'G', tab: 'overview',
  raw: null, model: null, reg: null,
  agileToday: null, agileErr: null, carbonFc: null, carbonErr: null,
  compare: null, compareOpts: null, compareBusy: false, exportRates: null, pv: null,
  live: { deviceId: null, data: null, err: null, checked: false }, rewards: null,
  sel: {}, changelog: store.getJ('changelog', []), acts: store.getJ('acts', {}),
  measures: store.getJ('measures', []), epc: store.getJ('epc', { cur: '', pot: '', notes: '' })
};

/* ---------- generic SVG bar chart ---------- */
function barChart(box, o){
  const W = Math.max(280, Math.floor(box.clientWidth || 600)), H = o.height || 220, P = { l: 46, r: 8, t: 14, b: 24 };
  const n = o.items.length;
  if (!n){ box.innerHTML = `<div class="empty">${esc(o.empty || 'No data yet.')}</div>`; o.onRead && o.onRead(null); return; }
  const tops = o.items.map(it => sum(it.segs.map(s => Math.max(0, s.v))));
  const bots = o.items.map(it => Math.min(0, ...it.segs.map(s => s.v)));
  const sc = niceScale(Math.min(0, ...bots), Math.max(o.minMax || 0.01, ...tops));
  const iw = W - P.l - P.r, ih = H - P.t - P.b, bw = iw / n, gap = Math.min(3, bw * 0.22);
  const y = v => P.t + ih - (v - sc.lo) / (sc.hi - sc.lo) * ih;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Chart')}">`;
  for (const b of o.bands || []) s += `<rect class="${b.cls}" x="${P.l + b.from*bw}" y="${P.t}" width="${(b.to - b.from)*bw}" height="${ih}"/>`;
  for (let v = sc.lo; v <= sc.hi + 1e-9; v += sc.step){
    const vv = Math.round(v*1e6)/1e6;
    s += `<line class="${Math.abs(vv) < 1e-9 && sc.lo < 0 ? 'zero' : 'gridl'}" x1="${P.l}" x2="${W - P.r}" y1="${y(vv)}" y2="${y(vv)}"/><text x="${P.l - 6}" y="${y(vv) + 4}" text-anchor="end">${(o.yFmt || fmtTick)(vv)}</text>`;
  }
  let lastLabel = -1e9;
  o.items.forEach((it, i) => {
    const x = P.l + i*bw + gap/2, w = Math.max(1, bw - gap);
    let acc = 0;
    for (const seg of it.segs){
      if (seg.v > 0){ s += `<rect class="${seg.cls}${it.faded ? ' past' : ''}" x="${x}" y="${y(acc + seg.v)}" width="${w}" height="${Math.max(0.5, y(acc) - y(acc + seg.v))}"/>`; acc += seg.v; }
      else if (seg.v < 0) s += `<rect class="${seg.cls}${it.faded ? ' past' : ''}" x="${x}" y="${y(0)}" width="${w}" height="${Math.max(0.5, y(seg.v) - y(0))}"/>`;
    }
    if (it.label){
      const lx = o.labelEdge ? P.l + i*bw : x + w/2;
      if (lx - lastLabel >= 54){ s += `<text x="${lx}" y="${H - 6}" text-anchor="${o.labelEdge && i === 0 ? 'start' : 'middle'}">${esc(it.label)}</text>`; lastLabel = lx; }
    }
  });
  if (o.endLabel) s += `<text x="${W - P.r}" y="${H - 6}" text-anchor="end">${esc(o.endLabel)}</text>`;
  for (const m of o.marks || []){ const mx = P.l + m.i*bw + bw/2; s += `<line class="mark" x1="${mx}" x2="${mx}" y1="${P.t}" y2="${P.t + ih}"/><text class="mark-t" x="${Math.min(mx + 3, W - 12)}" y="${P.t + 9}">◆</text>`; }
  if (o.nowAt != null){ const nx = P.l + o.nowAt*bw; s += `<line class="now" x1="${nx}" x2="${nx}" y1="${P.t}" y2="${P.t + ih}"/><text x="${Math.min(nx + 4, W - 28)}" y="${P.t + 9}" style="fill:var(--gas)">now</text>`; }
  for (let i = 0; i < n; i++) s += `<rect class="hit" data-i="${i}" x="${P.l + i*bw}" y="${P.t}" width="${bw}" height="${ih}"/>`;
  box.innerHTML = s + '</svg>';
  const select = i => {
    i = clamp(i, 0, n - 1);
    box.querySelectorAll('.hit.sel').forEach(h => h.classList.remove('sel'));
    const h = box.querySelector(`.hit[data-i="${i}"]`); if (h) h.classList.add('sel');
    state.sel[o.key] = i; box.dataset.sel = i;
    o.onRead && o.onRead(i);
  };
  const pick = ev => { const h = ev.target.closest && ev.target.closest('.hit'); if (h) select(+h.dataset.i); };
  box.onpointermove = ev => { if (ev.pointerType === 'mouse') pick(ev); };
  box.onclick = pick;
  box.onkeydown = ev => {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft'){ ev.preventDefault(); select((+box.dataset.sel || 0) + (ev.key === 'ArrowRight' ? 1 : -1)); }
  };
  const start = state.sel[o.key] != null && state.sel[o.key] < n ? state.sel[o.key] : (o.defaultSel ?? n - 1);
  select(start);
}

/* ---------- status ---------- */
function setStatus(kind){
  const el = $('#status');
  el.className = 'pill ' + ({ live:'live', demo:'demo', err:'err' }[kind] || '');
  el.textContent = kind === 'live' ? 'Signal live · ' + hhmm(Date.now()) : kind === 'demo' ? 'Example data' : kind === 'err' ? 'No signal' : 'Receiving…';
  $('#settingsBtn').textContent = NET.creds ? 'Settings' : 'Connect account';
  $('#acctLabel').textContent = NET.creds ? 'Mission control · Octopus ' + NET.creds.account : 'Mission control · not connected, showing example data';
}
function showNotice(kind, title, body){
  const n = $('#notice');
  if (!kind){ n.hidden = true; return; }
  n.className = 'notice ' + kind;
  n.innerHTML = `<strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}`;
  n.hidden = false;
}
const isDemo = () => !state.raw || state.raw.demo;
const exampleTag = () => isDemo() ? '<span class="tag warn">Example</span>' : '';
const eRateNow = () => (state.raw && unitPriceAt(state.raw.eSets, Date.now())) ?? null;
const gRateNow = () => (state.raw && unitPriceAt(state.raw.gSets, Date.now())) ?? null;

/* ---------- tabs ---------- */
function showTab(id){
  if (!$(`[data-panel="${id}"]`)) id = 'overview';
  state.tab = id;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  $$('.tabpanel').forEach(p => { p.hidden = p.dataset.panel !== id; });
  try { history.replaceState(null, '', '#' + id); } catch(e){}
  renderTab(id);
  if (id === 'prices') startLive();
}
function renderTab(id){
  if (!state.raw) return;
  if (!state.model){ state.model = buildModel(state.raw, state.days); state.reg = gasRegression(state.raw); }
  if (id === 'overview'){ renderTariffs(); renderTotals(); renderDaily(); renderMonth(); renderCap(); renderRewards(); renderLog(); }
  if (id === 'patterns'){ renderProfile(); renderGas(); renderSpikes(); renderCO2(); renderWeather(); }
  if (id === 'prices'){ renderLive(); renderAgile(); renderCarbon(); renderBest(); renderActivities(); }
  if (id === 'compare'){ renderCompare(); renderBattery(); renderSolar(); }
  if (id === 'home'){ renderChangelog(); renderPlan(); renderEPC(); renderServer(); }
}
function renderAll(){
  if (!state.raw) return;
  state.model = buildModel(state.raw, state.days);
  state.reg = gasRegression(state.raw);
  renderTab(state.tab);
}

/* ---------- overview ---------- */
function tariffCard(fuel, label, pt, sets){
  const cls = fuel === 'electricity' ? 'elec' : 'gas';
  if (!pt) return `<div class="panel"><p class="fuel ${cls}">${label}</p><p class="muted">No ${label.toLowerCase()} supply is listed on this account.</p></div>`;
  const c = currentRates(sets);
  const idLabel = fuel === 'electricity' ? 'MPAN' : 'MPRN';
  let rates = '<p class="muted">No current tariff found.</p>';
  if (c){
    const rr = c.twoRate ? [['Day rate', c.day], ['Night rate', c.night]] : [['Unit rate', c.unit]];
    rates = '<div class="rates">' + rr.map(([k, v]) => `<div class="rate"><span class="v">${v == null ? '—' : v.toFixed(2)}<small>p/kWh</small></span><span class="k">${k}</span></div>`).join('')
      + `<div class="rate"><span class="v">${c.standing == null ? '—' : c.standing.toFixed(2)}<small>p/day</small></span><span class="k">Standing charge</span></div></div>`;
  }
  const code = c?.code || pt.agreement?.tariff_code || '—';
  const since = pt.agreement?.valid_from ? new Date(pt.agreement.valid_from) : null;
  const rg = regionOf(code);
  const region = fuel === 'electricity' && REGIONS[rg] ? `<dt>Region</dt><dd>${rg} · ${REGIONS[rg]}</dd>` : '';
  const conv = fuel === 'gas' && !isDemo() && state.gasUnit === 'm3' ? '<p class="muted small">Readings converted from m³ to kWh.</p>' : '';
  return `<div class="panel">
    <p class="fuel ${cls}">${label}${exampleTag()}</p>
    <div style="display:grid;gap:2px"><p class="tname">${esc(c?.name || '—')}</p><p class="muted mono" style="font-size:12px">${esc(code)}</p></div>
    ${rates}
    <dl class="meta"><dt>${idLabel}</dt><dd>${esc(pt.id)}</dd><dt>Meter</dt><dd>${esc(pt.serials.join(', ') || '—')}</dd>${since ? `<dt>On tariff since</dt><dd>${longDate(since)}</dd>` : ''}${region}</dl>
    ${conv}</div>`;
}
function renderTariffs(){ const r = state.raw; $('#tariffs').innerHTML = tariffCard('electricity', 'Electricity', r.elecPts[0], r.eSets) + tariffCard('gas', 'Gas', r.gasPts[0], r.gSets); }

function renderTotals(){
  const m = state.model, t = m.tot, last = addDays(m.end, -1);
  $('#rangeLabel').textContent = `${shortDate(m.start)} – ${longDate(last)}`;
  const per = (v, n, f) => n ? f(v/n) + ' a day' : 'No readings yet';
  $('#totals').innerHTML = `
    <div class="stat"><span class="k"><i style="background:var(--elec);color:var(--elec)"></i>Electricity used</span><span class="v">${t.nE ? kwh(t.e) : '—'}</span><span class="s">${per(t.e, t.nE, kwh)}</span></div>
    <div class="stat"><span class="k"><i style="background:var(--elec);color:var(--elec)"></i>Electricity cost</span><span class="v">${t.nE ? gbp(t.ec) : '—'}</span><span class="s">${per(t.ec, t.nE, gbp)}</span></div>
    <div class="stat"><span class="k"><i style="background:var(--gas);color:var(--gas)"></i>Gas used</span><span class="v">${t.nG ? kwh(t.g) : '—'}</span><span class="s">${per(t.g, t.nG, kwh)}</span></div>
    <div class="stat"><span class="k"><i style="background:var(--gas);color:var(--gas)"></i>Gas cost</span><span class="v">${t.nG ? gbp(t.gc) : '—'}</span><span class="s">${per(t.gc, t.nG, gbp)}</span></div>
    <div class="stat total"><span class="k">Total cost</span><span class="v">${(t.nE || t.nG) ? gbp(t.ec + t.gc) : '—'}</span><span class="s">${isDemo() ? 'Example figures' : 'Inc. VAT and standing charges'}</span></div>`;
}

function renderDaily(){
  const m = state.model, g = state.unit === 'gbp', box = $('#dailyChart');
  if (!m.tot.nE && !m.tot.nG){ box.innerHTML = '<div class="empty">Daily electricity and gas will appear once your smart meter readings come through.</div>'; $('#dailyRead').textContent = ''; return; }
  const idx = new Map(m.days.map((d, i) => [d.k, i]));
  const marks = state.changelog.filter(c => idx.has(c.date)).map(c => ({ i: idx.get(c.date), text: c.text }));
  let def = m.days.length - 1; while (def > 0 && !m.days[def].eHas && !m.days[def].gHas) def--;
  barChart(box, {
    key: 'daily' + state.days, aria: `Daily ${g ? 'cost' : 'energy use'}`, defaultSel: def, marks,
    yFmt: v => (g ? '£' : '') + fmtTick(v),
    items: m.days.map(d => ({ label: shortDate(d.date), segs: [{ v: g ? d.ec/100 : d.e, cls:'bar-e' }, { v: g ? d.gc/100 : d.g, cls:'bar-g' }] })),
    onRead: i => {
      if (i == null) return;
      const d = m.days[i];
      const e = d.eHas ? `Electricity ${kwh(d.e)} · ${gbp(d.ec)}` : 'Electricity: no readings';
      const gg = d.gHas ? `Gas ${kwh(d.g)} · ${gbp(d.gc)}` : 'Gas: no readings';
      const notes = state.changelog.filter(c => c.date === d.k).map(c => ` · ◆ ${c.text}`).join('');
      $('#dailyRead').textContent = `${fmtDate(d.date)} — ${e} — ${gg}${notes}`;
    }
  });
}

function renderMonth(){
  const p = monthProjection(state.raw);
  $('#monthOut').innerHTML = p.daysSoFar && (p.soFar > 0)
    ? `<div class="chips">
        <div class="chip"><span class="v">${gbp(p.soFar)}</span><span class="k">${p.month} so far, ${p.daysSoFar} day${p.daysSoFar > 1 ? 's' : ''}${isDemo() ? ' · example' : ''}</span></div>
        <div class="chip"><span class="v">${gbp(p.projected)}</span><span class="k">On track for, by the end of ${p.month}</span></div>
      </div><p class="muted small">Based on your average of ${gbp(p.avgDay)} a day over the last two weeks.</p>`
    : `<div class="empty">Once this month has a day of readings, you'll see what you've spent so far and where it's heading.</div>`;
  renderDD();
}
function renderDD(){
  const a = annualProjection(state.raw, state.reg);
  const dd = parseFloat($('#ddAmount').value);
  const out = $('#ddOut');
  if (!a){ out.innerHTML = '<p class="muted">Needs a few weeks of readings to project your year.</p>'; return; }
  const gasNote = a.gasMethod === 'weather' ? 'Gas is projected using how your use responds to temperature and Stockport\'s typical weather, so winter is included.'
    : a.gasMethod === 'recent' ? 'Gas is projected from the last 30 days, so it will read low until winter shows up in your data.' : '';
  let html = `<p>Projected year: about <b>${gbp0(a.total)}</b> (electricity ${gbp0(a.elecP)}, gas ${gbp0(a.gasP)}), which is <b>${gbp0(a.total/12)}</b> a month on average.</p>`;
  if (dd > 0){
    const diff = dd*1200 - a.total;
    html += Math.abs(diff) < 6000
      ? `<p class="good">Your ${gbp0(dd*100)} a month looks about right.</p>`
      : diff > 0 ? `<p class="warn">At ${gbp0(dd*100)} a month you'd pay about ${gbp0(diff)} more than you use over a year, building up credit.</p>`
                 : `<p class="bad">At ${gbp0(dd*100)} a month you'd fall about ${gbp0(-diff)} short over a year.</p>`;
  }
  html += `<p class="muted small">${gasNote} Prices are today's, so a price cap change will move this.</p>`;
  out.innerHTML = html;
}

function renderCap(){
  const c = nextCapChange();
  const code = state.raw.eSets[0]?.code || '';
  const follows = !/AGILE|SILVER|FIX/.test(code);
  const er = eRateNow(), gr = gRateNow();
  $('#capOut').innerHTML = `
    <div class="chips">
      <div class="chip"><span class="v">${c.days} days</span><span class="k">Until ${longDate(c.next)}</span></div>
      <div class="chip"><span class="v">${c.announceDays > 0 ? c.announceDays + ' days' : 'Announced'}</span><span class="k">Ofgem usually announces around ${shortDate(c.announce)}</span></div>
    </div>
    <p class="small">${follows
      ? `Your current rates${er != null ? ` (electricity ${pence(er)}, gas ${gr != null ? pence(gr) : '—'} per kWh)` : ''} are on a flexible tariff, which normally moves with the cap on that date.`
      : 'Your tariff doesn\'t follow the cap directly: its price is fixed or set by wholesale prices.'}</p>`;
}

function renderRewards(){
  const out = $('#rewardsOut');
  if (isDemo()){ out.innerHTML = '<p class="muted">Connect your account to see upcoming Saving Sessions, the ones you\'ve joined and your Octoplus points.</p>'; return; }
  const r = state.rewards;
  if (!r){ out.innerHTML = '<p class="muted">Checking your rewards…</p>'; return; }
  if (r.sessions == null && r.points == null){ out.innerHTML = '<p class="muted">Couldn\'t read Saving Sessions or Octoplus from your account. If you haven\'t joined Octoplus, there\'s nothing to show yet; otherwise Octopus may have changed this part of their system.</p>'; return; }
  const now = Date.now();
  const ev = (r.sessions?.events || []).filter(e => +new Date(e.endAt) > now).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const joined = r.sessions?.account?.joinedEvents || [];
  const joinedIds = new Set(joined.map(j => String(j.eventId)));
  const earned = sum(joined.map(j => +j.rewardGivenInOctoPoints || 0));
  out.innerHTML = `<div class="chips">
      ${r.points != null ? `<div class="chip"><span class="v">${r.points.toLocaleString('en-GB')}</span><span class="k">Octopoints balance</span></div>` : ''}
      ${r.sessions ? `<div class="chip"><span class="v">${joined.length}</span><span class="k">Saving Sessions joined${earned ? ` · ${earned.toLocaleString('en-GB')} points earned` : ''}</span></div>` : ''}
    </div>
    ${r.sessions ? (ev.length ? `<ul class="list">${ev.map(e => `<li><span>${fmtDate(new Date(e.startAt))} ${hhmm(e.startAt)}–${hhmm(e.endAt)}${joinedIds.has(String(e.id)) ? '<span class="tag good">Joined</span>' : ''}</span><span class="when">${e.rewardPerKwhInOctoPoints ? e.rewardPerKwhInOctoPoints + ' points per kWh saved' : ''}</span></li>`).join('')}</ul>`
      : '<p class="muted small">No Saving Sessions announced right now.</p>') : ''}`;
}

function logText(){
  const w = weekLog(state.raw), c = w.cur, p = w.prev;
  if (!c.days) return null;
  const ch = (a, b) => b > 0 ? ` (${a >= b ? '+' : '−'}${Math.round(Math.abs(a - b)/b*100)}%)` : '';
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  return [
    `LOG · ${shortDate(c.from)} – ${longDate(c.to)}${isDemo() ? ' · EXAMPLE' : ''}`,
    '',
    `${pad('Electricity', 13)}${kwh(c.e)}${ch(c.e, p.e)}`,
    `${pad('Gas', 13)}${kwh(c.g)}${ch(c.g, p.g)}`,
    `${pad('Cost', 13)}${gbp(c.cost)}${ch(c.cost, p.cost)}`,
    c.best ? `${pad('Quietest day', 13)}${fmtDate(keyDate(c.best[0]))}, ${kwh(c.best[1])}` : '',
    c.worst ? `${pad('Busiest day', 13)}${fmtDate(keyDate(c.worst[0]))}, ${kwh(c.worst[1])}` : '',
    p.days ? '\nChanges are against the week before.' : ''
  ].filter(x => x !== null).join('\n');
}
function renderLog(){
  const t = logText();
  $('#logOut').innerHTML = t ? `<div class="log">${esc(t)}</div>` : '<div class="empty">Your first weekly log appears after a week of readings.</div>';
  $('#copyLog').disabled = !t;
}

/* ---------- patterns ---------- */
function renderProfile(){
  const m = state.model;
  barChart($('#profChart'), {
    key: 'prof', aria: 'Average electricity use by half hour', labelEdge: true, endLabel: '24:00', height: 210,
    empty: 'Your average day, half hour by half hour, will show here once electricity readings arrive.',
    bands: [{ from: 1, to: 11, cls: 'band-cheap' }, { from: 32, to: 38, cls: 'band-peak' }],
    items: m.profDays ? m.profile.map((v, i) => ({ label: i % 12 === 0 ? slotLabel(i) : null, segs: [{ v, cls: 'bar-e' }] })) : [],
    defaultSel: m.profile.indexOf(Math.max(...m.profile)),
    onRead: i => { $('#profRead').textContent = i == null ? '' : `${slotLabel(i)}–${slotLabel(i + 1)} — average ${m.profile[i].toFixed(3)} kWh (about ${Math.round(m.profile[i]*2000)} W)`; }
  });
  const ins = m.insights;
  $('#insights').innerHTML = ins ? `
    <div class="chip"><span class="v">${Math.round(ins.baseW)} W</span><span class="k">Always-on use</span><p>Fridge, router and standby. About ${gbp0(ins.baseW/1000*24*365*(ins.rateNow ?? 25))} a year.</p></div>
    <div class="chip"><span class="v">${pct(ins.overnightShare)}</span><span class="k">Used 00:30–05:30</span><p>The window most overnight tariffs make cheap.</p></div>
    <div class="chip"><span class="v">${pct(ins.peakShare)}</span><span class="k">Used 16:00–19:00</span><p>The priciest window on time-of-use tariffs.</p></div>
    <div class="chip"><span class="v">${ins.evening.toFixed(1)} kWh</span><span class="k">Average use 16:00–midnight</span><p>Roughly the usable battery size that would cover a typical evening.</p></div>` : '';
}
function renderGas(){
  const m = state.model, h = m.heating;
  barChart($('#gasChart'), {
    key: 'gasprof', aria: 'Average gas use by half hour', labelEdge: true, endLabel: '24:00', height: 200,
    empty: 'Your gas pattern will show here once gas readings arrive.',
    items: m.gasDays ? m.gasProfile.map((v, i) => ({ label: i % 12 === 0 ? slotLabel(i) : null, segs: [{ v, cls: 'bar-g' }] })) : [],
    defaultSel: m.gasProfile.indexOf(Math.max(...m.gasProfile)),
    onRead: i => { $('#gasRead').textContent = i == null ? '' : `${slotLabel(i)}–${slotLabel(i + 1)} — average ${m.gasProfile[i].toFixed(2)} kWh of gas`; }
  });
  const out = $('#heatingOut');
  if (!h){ out.innerHTML = ''; return; }
  const runs = h.runs.map(([a, b]) => `${slotLabel(a)}–${slotLabel(b)}`);
  let html = runs.length ? `<p>Your boiler usually runs <b>${runs.join(', ')}</b>${exampleTag()}.</p>` : '';
  if (h.totalNights){
    html += h.nightDays.length
      ? `<p class="warn">Gas was used between midnight and 05:00 on ${h.nightDays.length} of the last ${h.totalNights} nights (${h.nightDays.slice(-5).map(k => shortDate(keyDate(k))).join(', ')}${h.nightDays.length > 5 ? ' and more' : ''}). If nobody needs heat or hot water then, check the boiler timer and any frost or pre-heat setting.</p>`
      : '<p class="good">No gas used overnight. The boiler is resting when it should be.</p>';
  }
  out.innerHTML = html;
}
function renderSpikes(){
  const m = state.model;
  const hh = m.spikes.length ? `<ul class="list">${m.spikes.map(s => `<li><span>${fmtDate(new Date(s.t))} <span class="mono">${hhmm(s.t)}</span></span><span class="when">${s.v.toFixed(2)} kWh vs usual ${s.base.toFixed(2)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing unusual. Your half hours look like your normal pattern.</p>';
  const dd = m.oddDays.length ? `<ul class="list">${m.oddDays.map(d => `<li><span>${fmtDate(d.date)} · ${d.fuel}</span><span class="when">${kwh(d.v)}, ${d.ratio.toFixed(1)}× your normal day</span></li>`).join('')}</ul>` : '<p class="muted">No days well above your normal.</p>';
  $('#spikesOut').innerHTML = (m.profDays || m.gasDays) ? `<div class="prose"><h3>Unusual half hours ${exampleTag()}</h3><p class="muted small">Electricity at least three times your normal for that time of day: an oven, heater or appliance left on.</p>${hh}</div><div class="prose"><h3>Unusual days</h3><p class="muted small">Days at least 40% above your typical electricity or 50% above your typical gas.</p>${dd}</div>`
    : '<div class="empty">Unusual half hours and days will be flagged here once readings arrive.</div>';
}
function renderCO2(){
  const c = state.model.co2, n = Math.max(state.model.tot.nE, state.model.tot.nG);
  if (!n){ $('#co2Out').innerHTML = '<div class="empty">Your carbon footprint appears once readings arrive.</div>'; return; }
  const tot = c.e + c.g;
  $('#co2Out').innerHTML = `<div class="chips">
      <div class="chip"><span class="v">${kg(tot)}</span><span class="k">CO₂ over ${n} days${isDemo() ? ' · example' : ''}</span></div>
      <div class="chip"><span class="v">${kg(c.e)}</span><span class="k">From electricity</span></div>
      <div class="chip"><span class="v">${kg(c.g)}</span><span class="k">From gas</span></div>
      <div class="chip"><span class="v">${kg(tot/n*365)}</span><span class="k">A year at this rate</span></div>
    </div>
    <p class="muted small">About the same as driving ${Math.round(tot/0.17).toLocaleString('en-GB')} km in an average petrol car. Electricity uses ${c.regional ? 'National Grid\'s half-hourly intensity for your region' : 'a UK average of 200 g/kWh'}; gas uses 183 g/kWh.</p>`;
}
function renderWeather(){
  const box = $('#weatherChart'), out = $('#weatherOut'), reg = state.reg, raw = state.raw;
  if (!raw.weather){ box.innerHTML = '<div class="empty">Loading Stockport\'s weather…</div>'; out.innerHTML = ''; return; }
  if (!reg || !reg.pts.length){ box.innerHTML = '<div class="empty">Once you have gas readings, this shows how your gas use climbs as the temperature drops.</div>'; out.innerHTML = ''; return; }
  const W = Math.max(280, Math.floor(box.clientWidth || 500)), H = 230, P = { l: 44, r: 10, t: 24, b: 30 };
  const fc = [...raw.weather.entries()].filter(([, w]) => w.forecast).map(([k, w]) => ({ k, temp: w.t, g: reg.a != null ? reg.a + reg.b*Math.max(0, 15.5 - w.t) : null })).filter(x => x.g != null);
  const temps = reg.pts.map(p => p.temp).concat(fc.map(p => p.temp)), gs = reg.pts.map(p => p.g).concat(fc.map(p => p.g));
  const xs = niceScale(Math.min(...temps) - 1, Math.max(...temps) + 1, 5), ys = niceScale(0, Math.max(...gs, 1));
  const x = t => P.l + (t - xs.lo)/(xs.hi - xs.lo)*(W - P.l - P.r), y = v => P.t + (H - P.t - P.b) - (v - ys.lo)/(ys.hi - ys.lo)*(H - P.t - P.b);
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily gas use against outdoor temperature">`;
  for (let v = ys.lo; v <= ys.hi + 1e-9; v += ys.step) s += `<line class="gridl" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${fmtTick(v)}</text>`;
  for (let t = xs.lo; t <= xs.hi + 1e-9; t += xs.step) s += `<text x="${x(t)}" y="${H - 12}" text-anchor="middle">${fmtTick(t)}°</text>`;
  s += `<text x="${W - P.r}" y="${H - 1}" text-anchor="end">daily mean temperature</text><text x="${P.l - 6}" y="12">kWh of gas a day</text>`;
  for (const p of reg.pts) s += `<circle class="dot" cx="${x(p.temp)}" cy="${y(p.g)}" r="3.2"><title>${shortDate(keyDate(p.k))}: ${p.temp}°C, ${p.g.toFixed(1)} kWh</title></circle>`;
  for (const p of fc) s += `<circle class="dot fc" cx="${x(p.temp)}" cy="${y(p.g)}" r="4"><title>Forecast ${shortDate(keyDate(p.k))}: ${p.temp}°C, about ${p.g.toFixed(1)} kWh</title></circle>`;
  if (reg.a != null){
    let d = ''; for (let t = xs.lo; t <= xs.hi; t += (xs.hi - xs.lo)/60){ d += `${d ? 'L' : 'M'}${x(t).toFixed(1)},${y(reg.a + reg.b*Math.max(0, 15.5 - t)).toFixed(1)}`; }
    s += `<path class="fit" d="${d}"/>`;
  }
  box.innerHTML = s + '</svg>';
  if (reg.a == null){ out.innerHTML = '<p class="muted">Needs about 10 days of gas readings to work out the pattern.</p>'; return; }
  const gr = gRateNow() ?? 7;
  const fcKwh = sum(fc.map(p => p.g));
  out.innerHTML = `<p>Each degree colder adds about <b>${reg.b.toFixed(1)} kWh</b> of gas a day (${pence(reg.b*gr)}). Hot water and cooking use about <b>${reg.a.toFixed(1)} kWh</b> a day.${exampleTag()}</p>
    ${fc.length ? `<p>With the forecast, the next ${fc.length} days should use about <b>${kwh(fcKwh)}</b> of gas, roughly ${gbp(fcKwh*gr)} (hollow dots).</p>` : ''}
    <p class="muted small">Above about 15.5°C most homes stop heating. Fit quality R² ${reg.r2.toFixed(2)}${reg.r2 < 0.5 ? ', so treat this loosely' : ''}.</p>`;
}

/* ---------- prices ---------- */
function priceClass(p){ return p < 0 ? 'p-neg' : p < 15 ? 'p-low' : p < 25 ? 'p-mid' : 'p-high'; }
function renderAgile(){
  $('#agileSub').textContent = `Region ${state.region} · ${REGIONS[state.region]}. Tomorrow's prices usually appear around 4pm.`;
  const box = $('#agileChart'), a = state.agileToday;
  if (!a || !a.unit || !a.unit.length){
    const msg = state.agileErr ? errorText(state.agileErr).join(' ') : 'Tuning in to today\'s prices…';
    box.innerHTML = `<div class="empty">${esc(msg)}</div>`; $('#agileRead').textContent = ''; $('#agileChips').innerHTML = ''; return;
  }
  const rates = a.unit.filter(r => isFinite(r.to)), now = Date.now();
  const cur = rates.findIndex(r => r.from <= now && now < r.to);
  const nowAt = cur >= 0 ? cur + (now - rates[cur].from)/(rates[cur].to - rates[cur].from) : null;
  barChart(box, {
    key: 'agile', aria: 'Agile half-hourly prices', labelEdge: true, nowAt, defaultSel: cur >= 0 ? cur : 0,
    yFmt: v => fmtTick(v) + 'p',
    items: rates.map(r => { const d = new Date(r.from); return { faded: r.to <= now, label: d.getMinutes() === 0 && d.getHours() % 6 === 0 ? (d.getHours() === 0 ? (dayKey(r.from) === dayKey(now) ? 'Today' : DOW[d.getDay()]) : pad2(d.getHours()) + ':00') : null, segs: [{ v: r.p, cls: priceClass(r.p) }] }; }),
    onRead: i => { const r = rates[i]; $('#agileRead').textContent = `${DOW[new Date(r.from).getDay()]} ${hhmm(r.from)}–${hhmm(r.to)} — ${pence(r.p)}/kWh`; }
  });
  const fut = rates.filter(r => r.to > now);
  const best = cheapestWindow(rates, 4);
  const max = fut.length ? fut.reduce((x, y) => y.p > x.p ? y : x) : null;
  const neg = fut.filter(r => r.p < 0);
  $('#agileChips').innerHTML = [
    cur >= 0 ? `<div class="chip"><span class="v">${pence(rates[cur].p)}</span><span class="k">Right now, per kWh</span></div>` : '',
    best ? `<div class="chip"><span class="v">${hhmm(best.from)}–${hhmm(best.to)}</span><span class="k">Cheapest 2 hours to come · avg ${pence(best.avg)}</span></div>` : '',
    max ? `<div class="chip"><span class="v">${pence(max.p)}</span><span class="k">Highest to come, at ${hhmm(max.from)}</span></div>` : '',
    neg.length ? `<div class="chip"><span class="v">${neg.length} slot${neg.length > 1 ? 's' : ''}</span><span class="k">Below zero, first at ${fmtDate(new Date(neg[0].from))} ${hhmm(neg[0].from)}</span></div>` : ''
  ].join('');
  updateAlert(neg);
}
function updateAlert(neg){
  const el = $('#alert');
  if (!neg.length){ el.hidden = true; return; }
  const first = neg[0];
  el.innerHTML = `<strong>Plunge pricing ahead: Agile goes below zero ${dayKey(first.from) === dayKey(Date.now()) ? 'today' : 'on ' + fmtDate(new Date(first.from))} from ${hhmm(first.from)}.</strong><span>On Agile you'd be paid to use electricity then: ${neg.length} half hour${neg.length > 1 ? 's' : ''}, as low as ${pence(Math.min(...neg.map(r => r.p)))}.</span>`;
  el.hidden = false;
  try {
    if (store.get('notify') === 'on' && 'Notification' in window && Notification.permission === 'granted'){
      const key = 'neg-' + first.from;
      if (store.get('lastNotified') !== key){ new Notification('Agile prices go negative', { body: `From ${hhmm(first.from)} ${dayKey(first.from) === dayKey(Date.now()) ? 'today' : 'tomorrow'}, as low as ${pence(Math.min(...neg.map(r => r.p)))}.` }); store.set('lastNotified', key); }
    }
  } catch(e){}
}
function renderNotify(){
  const st = $('#notifyState');
  if (!('Notification' in window)){ $('#notifyBtn').disabled = true; st.textContent = 'This browser can\'t show notifications from this page.'; return; }
  const on = store.get('notify') === 'on' && Notification.permission === 'granted';
  $('#notifyBtn').textContent = on ? 'Stop negative price notifications' : 'Notify me about negative prices';
  st.textContent = on ? 'On while this page is open in a tab.' : Notification.permission === 'denied' ? 'Notifications are blocked for this page in your browser settings.' : '';
}

function ciClass(idx){ return ({ 'very low':'ci-vl', low:'ci-l', moderate:'ci-m', high:'ci-h', 'very high':'ci-vh' })[idx] || 'ci-m'; }
function renderCarbon(){
  const box = $('#ciChart'), c = state.carbonFc;
  if (!c || !c.length){ box.innerHTML = `<div class="empty">${esc(state.carbonErr ? errorText(state.carbonErr).join(' ') : 'Scanning the grid…')}</div>`; $('#ciRead').textContent = ''; $('#ciChips').innerHTML = ''; return; }
  const now = Date.now(), cur = c.findIndex(r => r.from <= now && now < r.to);
  barChart(box, {
    key: 'ci', aria: 'Carbon intensity forecast', labelEdge: true, height: 200, defaultSel: Math.max(0, cur),
    nowAt: cur >= 0 ? cur + (now - c[cur].from)/(c[cur].to - c[cur].from) : null,
    items: c.map(r => { const d = new Date(r.from); return { label: d.getMinutes() === 0 && d.getHours() % 6 === 0 ? (d.getHours() === 0 ? DOW[d.getDay()] : pad2(d.getHours()) + ':00') : null, segs: [{ v: r.v, cls: ciClass(r.index) }] }; }),
    onRead: i => { const r = c[i]; $('#ciRead').textContent = `${DOW[new Date(r.from).getDay()]} ${hhmm(r.from)}–${hhmm(r.to)} — ${r.v} g/kWh, ${r.index}`; }
  });
  const green = cheapestWindow(c.map(r => ({ from: r.from, to: r.to, p: r.v })), 6);
  const dirty = c.filter(r => r.to > now).reduce((x, y) => y.v > x.v ? y : x, c[0]);
  $('#ciChips').innerHTML = [
    cur >= 0 ? `<div class="chip"><span class="v">${c[cur].v} g</span><span class="k">Now · ${c[cur].index}</span></div>` : '',
    green ? `<div class="chip"><span class="v">${fmtDate(new Date(green.from)).slice(0, 3)} ${hhmm(green.from)}–${hhmm(green.to)}</span><span class="k">Greenest 3 hours · avg ${Math.round(green.avg)} g/kWh</span></div>` : '',
    dirty ? `<div class="chip"><span class="v">${dirty.v} g</span><span class="k">Dirtiest, ${DOW[new Date(dirty.from).getDay()]} ${hhmm(dirty.from)}</span></div>` : ''
  ].join('');
}

const actKwh = a => +(state.acts[a.id] ?? a.kwh);
function renderBest(){
  const sel = $('#bestSel');
  if (!sel.options.length) sel.innerHTML = ACTIVITIES.filter(a => a.hours).map(a => `<option value="${a.id}">${esc(a.label)}</option>`).join('');
  const a = ACTIVITIES.find(x => x.id === sel.value) || ACTIVITIES.find(x => x.hours);
  const slots = Math.max(1, Math.round(a.hours*2)), k = actKwh(a), out = [];
  const ag = state.agileToday?.unit?.filter(r => isFinite(r.to));
  if (ag && ag.length){
    const best = cheapestWindow(ag, slots), now = Date.now();
    const nowIdx = ag.findIndex(r => r.from <= now && now < r.to);
    const nowAvg = nowIdx >= 0 && nowIdx + slots <= ag.length ? sum(ag.slice(nowIdx, nowIdx + slots).map(r => r.p))/slots : null;
    if (best) out.push(`<div class="chip"><span class="v">${dayKey(best.from) === dayKey(now) ? '' : DOW[new Date(best.from).getDay()] + ' '}${hhmm(best.from)}</span><span class="k">Cheapest start on Agile · ${gbp(k*best.avg)}${nowAvg != null ? ` vs ${gbp(k*nowAvg)} if you start now` : ''}</span></div>`);
  }
  if (state.carbonFc?.length){
    const g = cheapestWindow(state.carbonFc.map(r => ({ from: r.from, to: r.to, p: r.v })), slots);
    if (g) out.push(`<div class="chip"><span class="v">${dayKey(g.from) === dayKey(Date.now()) ? '' : DOW[new Date(g.from).getDay()] + ' '}${hhmm(g.from)}</span><span class="k">Greenest start · about ${Math.round(k*g.avg)} g of CO₂</span></div>`);
  }
  const er = eRateNow(), c = currentRates(state.raw.eSets);
  if (er != null) out.push(`<div class="chip"><span class="v">${gbp(k*er)}</span><span class="k">${c && c.twoRate ? 'On your day rate. Night rate is cheaper after 00:30.' : 'On your tariff now. Any time costs the same.'}</span></div>`);
  $('#bestOut').innerHTML = out.join('') || '<div class="empty">Waiting for prices.</div>';
}
function renderActivities(){
  const er = eRateNow(), gr = gRateNow();
  const ag = state.agileToday?.unit?.filter(r => isFinite(r.to)) || [];
  const now = Date.now(), cur = ag.find(r => r.from <= now && now < r.to), min = ag.length ? Math.min(...ag.filter(r => r.to > now).map(r => r.p)) : null;
  const cell = (k, r) => r == null || !isFinite(r) ? '—' : gbp(k*r);
  $('#actTable').innerHTML = `<thead><tr><th>Activity</th><th class="num">kWh</th><th class="num">Your tariff</th><th class="num">Agile now</th><th class="num">Agile cheapest</th></tr></thead><tbody>${ACTIVITIES.map(a => {
    const k = actKwh(a), gasRow = a.fuel === 'g';
    return `<tr><td>${esc(a.label)}${gasRow ? ' <span class="tag" style="color:var(--gas)">Gas</span>' : ''}</td>
      <td class="num"><input class="kwh" type="number" min="0" step="0.01" value="${k}" data-act="${a.id}" aria-label="kWh for ${esc(a.label)}"></td>
      <td class="num">${cell(k, gasRow ? gr : er)}</td><td class="num">${gasRow ? '—' : cell(k, cur?.p)}</td><td class="num">${gasRow ? '—' : cell(k, min)}</td></tr>`;
  }).join('')}</tbody>`;
}

/* ---------- live (Home Mini) ---------- */
let liveTimer = null;
async function startLive(){
  renderLive();
  if (isDemo() || !NET.creds) return;
  if (!state.live.checked){
    state.live.checked = true;
    try { state.live.deviceId = store.get('mini.' + NET.creds.account) || await findHomeMini(); if (state.live.deviceId) store.set('mini.' + NET.creds.account, state.live.deviceId); }
    catch(e){ state.live.err = e; }
    renderLive();
  }
  if (state.live.deviceId && !liveTimer){ pollLive(); liveTimer = setInterval(pollLive, 60e3); }
}
async function pollLive(){
  if (document.hidden || state.tab !== 'prices'){ clearInterval(liveTimer); liveTimer = null; return; }
  try { state.live.data = await liveReading(state.live.deviceId); state.live.err = null; } catch(e){ state.live.err = e; }
  renderLive();
}
function renderLive(){
  const out = $('#liveOut'), L = state.live;
  if (isDemo() || !NET.creds){ out.innerHTML = '<p class="muted">With an Octopus Home Mini plugged in, this shows what your home is drawing right now, updated every minute, instead of yesterday\'s readings. Connect your account to check for one.</p>'; return; }
  if (!L.checked){ out.innerHTML = '<p class="muted">Looking for a Home Mini…</p>'; return; }
  if (!L.deviceId){ out.innerHTML = `<p class="muted">${L.err ? 'Couldn\'t check for a Home Mini: ' + esc(errorText(L.err)[0]) : 'No Home Mini found on your account.'} It's a small plug-in device Octopus sends to smart meter customers who ask for it, usually free. Once it's paired, live readings appear here.</p>`; return; }
  const d = L.data;
  if (!d){ out.innerHTML = `<p class="muted">${L.err ? esc(errorText(L.err).join(' ')) : 'Connecting to your Home Mini…'}</p>`; return; }
  const er = eRateNow();
  out.innerHTML = `<div class="chips">
      <div class="chip"><span class="big elec">${d.demand != null ? Math.round(d.demand).toLocaleString('en-GB') + ' W' : '—'}</span><span class="k">Drawing now${d.at ? ' · ' + hhmm(d.at) : ''}</span></div>
      <div class="chip"><span class="v">${d.today != null ? kwh(d.today) : '—'}</span><span class="k">Electricity used today</span></div>
      <div class="chip"><span class="v">${d.today != null && er != null ? gbp(d.today*er) : '—'}</span><span class="k">Today so far, before standing charge</span></div>
    </div><p class="muted small">Updates every minute while this tab is open.</p>`;
}

/* ---------- compare ---------- */
async function runCompare(){
  if (state.compareBusy) return;
  state.compareBusy = true; $('#cmpBtn').disabled = true;
  const out = $('#cmpOut');
  try {
    if (isDemo()){
      const raw = state.raw;
      const go = [], cosy = [];
      for (let t = +addDays(startOfDay(new Date()), -90); t < Date.now(); t += 1800e3){
        const s = slotOf(t);
        go.push({ from: t, to: t + 1800e3, p: s >= 1 && s < 11 ? 8.5 : 27.5 });
        cosy.push({ from: t, to: t + 1800e3, p: (s >= 8 && s < 14) || (s >= 26 && s < 32) || s >= 44 ? 13.5 : s >= 32 && s < 38 ? 38 : 26 });
      }
      const sc = [{ from: 0, to: Infinity, p: 50 }];
      state.compareOpts = [
        { ...COMPARE[0], unit: raw.agileHist.unit, sc: raw.agileHist.sc },
        { ...COMPARE[1], unit: go, sc }, { ...COMPARE[4], unit: cosy, sc }
      ];
    } else {
      const end = startOfDay(new Date()), from = addDays(end, -90), opts = [];
      for (const c of COMPARE){
        out.innerHTML = `<p class="muted">Fetching ${c.label} prices…</p>`;
        try { const p = await findProduct(c.re); if (!p) continue; const r = await loadProductRates(p.code, state.region, from, end, 4, state.pay); if (r.unit?.length) opts.push({ ...c, product: p.code, unit: r.unit, sc: r.sc }); } catch(e){ if (e.code === 'NETWORK') throw e; }
      }
      state.compareOpts = opts;
    }
    state.compare = compareTariffs(state.raw, state.compareOpts);
  } catch(e){ out.innerHTML = `<p class="bad">${esc(errorText(e).join(' '))}</p>`; state.compareBusy = false; $('#cmpBtn').disabled = false; return; }
  state.compareBusy = false; $('#cmpBtn').disabled = false; $('#cmpBtn').textContent = 'Run again';
  renderCompare(); renderBattery();
}
function renderCompare(){
  const out = $('#cmpOut'), c = state.compare, m = state.model;
  let html = '';
  if (m && m.agileCmp){
    const a = m.agileCmp, diff = a.yours - a.agile;
    html += `<div class="prose"><p>${isDemo() ? 'Example: ' : ''}Over the last ${a.days} days with readings you paid <b>${gbp(a.yours)}</b> for electricity. On Agile, same use at the same times, it would have been <b>${gbp(a.agile)}</b> (${diff >= 0 ? gbp(diff) + ' less' : gbp(-diff) + ' more'}).</p></div>`;
  }
  if (!c){ out.innerHTML = html + (state.raw.elec.length ? '<p class="muted small">Run the comparison to price your use on every Octopus import tariff.</p>' : '<div class="empty">Needs electricity readings to compare tariffs.</div>'); return; }
  const mine = c.rows.find(r => r.id === 'current');
  html += `<div class="tbl-wrap"><table><thead><tr><th>Tariff</th><th class="num">A year, about</th><th class="num">vs yours</th><th>Who it's for</th></tr></thead><tbody>${c.rows.map((r, i) => {
    const d = r.year - mine.year;
    return `<tr class="${r.id === 'current' ? 'mine' : i === 0 ? 'best' : ''}"><td>${esc(r.label)}${i === 0 ? '<span class="tag good">Cheapest</span>' : ''}</td><td class="num">${gbp0(r.year)}</td><td class="num ${d < 0 ? 'good' : d > 0 ? 'bad' : ''}">${r.id === 'current' ? '—' : (d < 0 ? '−' : '+') + gbp0(Math.abs(d))}</td><td class="muted small">${esc(r.note || '')}</td></tr>`;
  }).join('')}</tbody></table></div>
  <p class="muted small">${isDemo() ? 'Example figures. ' : ''}Based on ${c.days} days of your readings scaled to a year, including standing charges. Your autumn use may not match the rest of the year, and eligibility rules come from Octopus.</p>`;
  out.innerHTML = html;
}

function renderBattery(){
  const sel = $('#bTariff'), prev = sel.value;
  const opts = [{ v: 'current', l: 'Your tariff now' }];
  if (state.compareOpts) state.compareOpts.forEach(o => opts.push({ v: o.id, l: o.label }));
  else if (state.raw.agileHist) opts.push({ v: 'agile', l: 'Agile' });
  sel.innerHTML = opts.map(o => `<option value="${o.v}">${esc(o.l)}</option>`).join('');
  sel.value = opts.some(o => o.v === prev) ? prev : (opts.find(o => o.v === 'agile') ? 'agile' : 'current');
  const id = sel.value, raw = state.raw;
  const opt = state.compareOpts?.find(o => o.id === id);
  const priceAt = id === 'current' ? t => unitPriceAt(raw.eSets, t) : opt ? t => lookup(opt.unit, t) : t => lookup(raw.agileHist?.unit, t);
  const cap = +$('#bCap').value || 5, pow = +$('#bPow').value || 3, eff = clamp((+$('#bEff').value || 90)/100, 0.5, 1), cost = +$('#bCost').value || 0;
  const r = simulateBattery(raw, priceAt, cap, pow, eff);
  const out = $('#bOut');
  if (!r){ out.innerHTML = '<div class="empty">Needs electricity readings, and prices for the chosen tariff, to simulate a battery.</div>'; return; }
  if (r.saved < 100){ out.innerHTML = `<p class="small">On this tariff a battery saves almost nothing, because the price is the same all day. A battery pays off with a time-of-use tariff such as Agile, Go or Flux, or alongside solar panels.</p>`; return; }
  const pay = r.year > 0 ? cost*100 / r.year : null;
  out.innerHTML = `<div class="chips">
      <div class="chip"><span class="v good">${gbp0(r.year)}</span><span class="k">Saved a year, about${isDemo() ? ' · example' : ''}</span></div>
      <div class="chip"><span class="v">${pay ? pay.toFixed(1) + ' years' : '—'}</span><span class="k">To pay back ${gbp0(cost*100)}</span></div>
      <div class="chip"><span class="v">${r.cycledPerDay.toFixed(1)} kWh</span><span class="k">Shifted per day on average</span></div>
    </div><p class="muted small">From ${r.days} days of your readings, saving ${gbp(r.saved)} against ${gbp(r.base)} of unit costs. Excludes standing charges, battery wear and any export income.</p>`;
}

async function loadSolarInputs(){
  if (!state.exportRates){
    if (isDemo()) state.exportRates = [{ id:'outFix', label:'Outgoing Fixed (example)', rate: 15 }, { id:'agileOut', label:'Agile Outgoing (example avg)', rate: 12 }];
    else { try { state.exportRates = await loadExportRates(state.region); } catch(e){ state.exportRates = []; } if (!state.exportRates.length) state.exportRates = [{ id:'guess', label:'Assumed 15p export', rate: 15 }]; }
  }
  if (!state.pv && NET.proxy){
    try {
      const angle = +$('#sAngle').value || 35;
      state.pv = { south: await loadPVGIS(1, 0, angle), north: await loadPVGIS(1, 180, angle), angle, src: 'PVGIS' };
    } catch(e){ state.pv = null; }
  }
  renderSolar();
}
function renderSolar(){
  const sel = $('#sExport'), prev = sel.value;
  const ex = state.exportRates || [{ id:'guess', label:'Assumed 15p export', rate: 15 }];
  sel.innerHTML = ex.map(e => `<option value="${e.id}">${esc(e.label)} · ${pence(e.rate)}${e.variable ? ' avg' : ''}</option>`).join('');
  if (ex.some(e => e.id === prev)) sel.value = prev;
  const exp = ex.find(e => e.id === sel.value) || ex[0];
  const south = +$('#sSouth').value || 0, north = +$('#sNorth').value || 0, watt = +$('#sWatt').value || 430, batt = +$('#sBatt').value || 0, cost = +$('#sCost').value || 0;
  const usePv = state.pv && state.pv.angle === (+$('#sAngle').value || 35);
  const sy = usePv ? state.pv.south : SOLAR_SOUTH, ny = usePv ? state.pv.north : SOLAR_NORTH;
  $('#solarSrc').textContent = usePv ? 'Uses your average day of electricity use and PVGIS sunshine data for Stockport.' : 'Uses your average day of electricity use and typical sunshine for Stockport. Run the page from your home server helper for PVGIS figures for your exact roof pitch.';
  const monthly = sy.map((v, i) => v*south*watt/1000 + ny[i]*north*watt/1000);
  const m = state.model, out = $('#sOut');
  if (!m.profDays){ $('#solarChart').innerHTML = ''; out.innerHTML = '<div class="empty">Needs electricity readings to match panel output to when you use power.</div>'; return; }
  const imp = eRateNow() ?? 25;
  const r = simulateSolar({ profile: m.profile, monthlyKwh: monthly, importP: imp, exportP: exp.rate, batteryKwh: batt });
  barChart($('#solarChart'), {
    key: 'solar', aria: 'Monthly solar generation, used at home and exported', height: 190, defaultSel: 5,
    items: r.months.map(x => ({ label: MON[x.m], segs: [{ v: x.used, cls: 'bar-e' }, { v: x.exported, cls: 'bar-n' }] })),
    onRead: i => { const x = r.months[i]; $('#solarRead').textContent = `${MON[x.m]} — ${kwh(x.gen)} generated · ${kwh(x.used)} used at home · ${kwh(x.exported)} exported`; }
  });
  const pay = r.savedP > 0 ? cost*100 / r.savedP : null;
  out.innerHTML = `<div class="legend"><span><i style="background:var(--elec)"></i>Used at home</span><span><i style="background:var(--nebula)"></i>Exported</span></div>
    <div class="chips">
      <div class="chip"><span class="v">${kwh(r.gen)}</span><span class="k">Generated a year from ${((south + north)*watt/1000).toFixed(2)} kWp</span></div>
      <div class="chip"><span class="v">${pct(r.useShare)}</span><span class="k">Used at home${batt ? ', with the battery' : ''}</span></div>
      <div class="chip"><span class="v good">${gbp0(r.savedP)}</span><span class="k">Saved and earned a year${isDemo() ? ' · example' : ''}</span></div>
      <div class="chip"><span class="v">${pay ? pay.toFixed(1) + ' years' : '—'}</span><span class="k">To pay back ${gbp0(cost*100)}</span></div>
    </div>
    <p class="muted small">Assumes your current average day all year (${m.insights ? m.insights.perDay.toFixed(1) : '—'} kWh), electricity at ${pence(imp)} and export at ${pence(exp.rate)}. North-facing panels produce roughly half as much as south-facing ones. Get a quote and a roof survey before deciding.</p>`;
}

/* ---------- home ---------- */
function avgDaily(rows, from, to){
  const s = +from, e = +to, days = new Set(); let t = 0;
  for (const x of rows) if (x.t >= s && x.t < e){ t += x.v; days.add(dayKey(x.t)); }
  return days.size >= 5 ? { v: t/days.size, n: days.size } : null;
}
function renderChangelog(){
  const out = $('#clOut'), raw = state.raw, today = startOfDay(new Date());
  if (!$('#clDate').value) $('#clDate').value = dayKey(Date.now());
  if (!state.changelog.length){ out.innerHTML = '<p class="muted small">No entries yet. Try logging the date you switched to Octopus, or the next thing you change.</p>'; return; }
  const items = state.changelog.slice().sort((a, b) => b.date.localeCompare(a.date)).map(c => {
    const d = keyDate(c.date);
    const parts = [];
    for (const [label, rows] of [['Electricity', raw.elec], ['Gas', raw.gas]]){
      const b = avgDaily(rows, addDays(d, -14), d), a = avgDaily(rows, d, Math.min(+addDays(d, 14), +today));
      if (b && a) parts.push(`${label} ${b.v.toFixed(1)} → ${a.v.toFixed(1)} kWh/day <span class="${a.v < b.v ? 'good' : 'bad'}">(${a.v < b.v ? '−' : '+'}${Math.round(Math.abs(a.v - b.v)/b.v*100)}%)</span>`);
    }
    return `<li><span><span class="when">${longDate(d)}</span><br>${esc(c.text)}</span><span class="small">${parts.length ? parts.join('<br>') : '<span class="muted">Before and after appears once there are readings on both sides.</span>'} <button class="btn small" type="button" data-del="${c.id}" aria-label="Delete entry">Delete</button></span></li>`;
  });
  out.innerHTML = `<ul class="list">${items.join('')}</ul><p class="muted small">Gas comparisons don't account for the weather, so a colder fortnight will look worse.</p>`;
}
function renderPlan(){
  const box = $('#measures');
  if (!box.children.length) box.innerHTML = MEASURES.map(m => `<label class="check" for="m-${m.id}"><span><input id="m-${m.id}" type="checkbox" data-measure="${m.id}"${state.measures.includes(m.id) ? ' checked' : ''}> ${esc(m.label)}</span><span>−${Math.round(m.cut*100)}% heating</span></label>`).join('');
  const gr = gRateNow() ?? 7;
  const p = insulationPlan(state.reg, state.measures, gr), out = $('#planOut');
  if (!p){ out.innerHTML = '<div class="empty">Needs about 10 days of gas readings to estimate how much of your gas goes on heating.</div>'; return; }
  out.innerHTML = `<p>In a typical year your heating uses about <b>${kwh(p.year.heat)}</b> of gas (${gbp0(p.year.heat*gr)}), plus <b>${kwh(p.year.base)}</b> for hot water and cooking.${exampleTag()}</p>
    ${state.measures.length ? `<p>The ticked measures could cut heating by about <b>${pct(p.cutShare)}</b>: roughly <b>${kwh(p.saved)}</b> and <b>${gbp0(p.savedP)}</b> a year at today's gas price.</p>` : '<p class="muted">Tick the measures you\'re considering to see the combined saving.</p>'}`;
}
const EPC_COL = { A:'#11a14b', B:'#2fb34a', C:'#8cc63e', D:'#ffcc00', E:'#f7a41d', F:'#ef7d2d', G:'#e5232c' };
function renderEPC(){
  for (const id of ['epcCur', 'epcPot']){ const s = $('#' + id); if (!s.options.length) s.innerHTML = '<option value="">Not set</option>' + 'ABCDEFG'.split('').map(b => `<option>${b}</option>`).join(''); }
  $('#epcCur').value = state.epc.cur || ''; $('#epcPot').value = state.epc.pot || '';
  if (document.activeElement !== $('#epcNotes')) $('#epcNotes').value = state.epc.notes || '';
  const c = state.epc.cur, p = state.epc.pot;
  $('#epcBadge').innerHTML = c ? `<div class="epc"><span style="background:${EPC_COL[c]}">${c}</span><span class="muted" style="color:var(--muted);background:none">now</span>${p ? `<span style="color:var(--muted);background:none">→</span><span style="background:${EPC_COL[p]}">${p}</span><span style="color:var(--muted);background:none">potential</span>` : ''}</div>` : '';
}
async function searchEPCUI(ev){
  ev.preventDefault();
  const pc = $('#epcPostcode').value.trim(), tok = $('#epcToken').value.trim(), out = $('#epcOut');
  if (!pc || !tok){ out.innerHTML = '<p class="muted">Enter a postcode and your EPC data service token.</p>'; return; }
  out.innerHTML = '<p class="muted">Searching…</p>';
  try {
    const j = await searchEPC(pc, tok);
    const rows = Array.isArray(j) ? j : j.data || j.results || j.rows || j.certificates || [];
    if (!rows.length){ out.innerHTML = '<p class="muted">No certificates found for that postcode.</p>'; return; }
    const keys = Object.keys(rows[0]).filter(k => /address|postcode|rating|band|current|potential|date|lodg|certificate.?(number|id)|rrn/i.test(k)).slice(0, 6);
    out.innerHTML = `<div class="tbl-wrap"><table><thead><tr>${keys.map(k => `<th>${esc(k.replace(/[_-]/g, ' '))}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 25).map(r => `<tr>${keys.map(k => `<td>${esc(typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="muted small">Showing what the data service returned. Copy your rating and recommendations into the fields above.</p>`;
  } catch(e){ out.innerHTML = `<p class="bad">${esc(errorText(e).join(' '))}</p>`; }
}
function renderServer(){
  $('#srvOut').innerHTML = NET.proxy
    ? '<p class="good">Running through your home server helper. Octopus, PVGIS and EPC requests go through it.</p>'
    : `<p><b>Home server helper.</b> Some services, PVGIS solar data and the EPC register, don't let a browser page call them directly. Copy this file and <span class="mono">server.py</span> to your home server, run <span class="mono">python3 server.py</span>, then open <span class="mono">http://&lt;server address&gt;:8787</span> on any device at home. It also lets you add the app to your phone's home screen.</p>`;
}

/* ---------- loading ---------- */
async function loadPrices(){
  const today = startOfDay(new Date());
  try { state.agileToday = await loadAgile(state.region, today, addDays(today, 2), 1); state.agileErr = null; }
  catch(e){ state.agileToday = null; state.agileErr = e; }
  try { state.carbonFc = await loadCarbonForecast(CI_REGION[state.region]); state.carbonErr = null; }
  catch(e){ state.carbonFc = null; state.carbonErr = e; }
  if (state.tab === 'prices'){ renderAgile(); renderCarbon(); renderBest(); renderActivities(); }
  else if (state.agileToday) updateAlert(state.agileToday.unit.filter(r => isFinite(r.to) && r.to > Date.now() && r.p < 0));
}
async function loadExtras(){
  const raw = state.raw;
  if (raw.demo) return;
  const end = startOfDay(new Date());
  const jobs = [
    loadWeather().then(w => { raw.weather = w; }).catch(() => {}),
    raw.elec.length ? loadAgile(raw.region, new Date(raw.elec[0].t), end, 4).then(a => { raw.agileHist = a; }).catch(() => {}) : null,
    raw.elec.length ? loadCarbonHistory(CI_REGION[raw.region], new Date(raw.elec[0].t), end).then(c => { raw.carbonHist = c; }).catch(() => {}) : null
  ].filter(Boolean);
  await Promise.all(jobs);
  if (state.raw === raw) renderAll();
  try { state.rewards = await loadRewards(); } catch(e){ state.rewards = { sessions: null, points: null }; }
  if (state.tab === 'overview') renderRewards();
}
async function refresh(){
  state.compare = null; state.compareOpts = null; state.exportRates = null; state.pv = null; state.rewards = null;
  state.live = { deviceId: null, data: null, err: null, checked: false };
  clearInterval(liveTimer); liveTimer = null;
  if (NET.creds){
    setStatus('loading'); showNotice(null);
    try {
      const raw = await loadAccount({ gasUnit: state.gasUnit, pay: state.pay, fallbackRegion: state.region });
      state.raw = raw;
      if (raw.region !== state.region){ state.region = raw.region; store.set('region', raw.region); }
      setStatus('live');
      if (!raw.elec.length && !raw.gas.length) showNotice('warn', 'Connected. No smart meter readings yet.', 'Readings show up a day or two after your smart meter starts sending data. Tariffs, prices, the grid forecast and the cost tables work already.');
    } catch(e){
      const [t, b] = errorText(e); setStatus('err'); showNotice('err', t, b);
      if (!state.raw) state.raw = makeDemo();
    }
  } else { state.raw = makeDemo(); setStatus('demo'); }
  regionOptions();
  renderAll();
  if (state.tab === 'prices') startLive();
  loadPrices();
  loadExtras();
  loadSolarInputs();
}
function regionOptions(){ $('#region').innerHTML = Object.entries(REGIONS).map(([k, v]) => `<option value="${k}"${k === state.region ? ' selected' : ''}>${k} · ${v}</option>`).join(''); }

/* ---------- events ---------- */
$$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('.tabs').addEventListener('keydown', ev => {
  if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
  const tabs = $$('.tabs button'), i = tabs.findIndex(b => b.dataset.tab === state.tab);
  const n = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; showTab(n.dataset.tab); n.focus();
});
$$('[data-days]').forEach(b => b.addEventListener('click', () => {
  state.days = +b.dataset.days; state.sel.prof = state.sel.gasprof = null;
  $$('[data-days]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderAll();
}));
$$('[data-unit]').forEach(b => b.addEventListener('click', () => {
  state.unit = b.dataset.unit; $$('[data-unit]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderDaily();
}));
$('#region').addEventListener('change', e => { state.region = e.target.value; store.set('region', state.region); state.sel.agile = state.sel.ci = null; state.compare = state.compareOpts = state.exportRates = null; loadPrices(); });
$('#settingsBtn').addEventListener('click', () => {
  const s = $('#settings'); s.hidden = !s.hidden;
  if (!s.hidden){ $('#acct').value = NET.creds?.account || store.get('account') || ''; $('#apikey').value = NET.creds?.key || ''; $('#gasunit').value = state.gasUnit; $('#paymethod').value = state.pay; $('#acct').focus(); }
});
$('#closeSettings').addEventListener('click', () => { $('#settings').hidden = true; });
$('#forgetBtn').addEventListener('click', () => {
  ['account', 'key', 'gasUnit', 'pay'].forEach(k => store.del(k));
  NET.creds = null; NET.token = null; $('#apikey').value = ''; $('#acct').value = '';
  refresh(); showNotice('warn', 'Your details have been removed from this browser.', 'Showing example data again.');
});
$('#settingsForm').addEventListener('submit', e => {
  e.preventDefault();
  const account = $('#acct').value.trim().toUpperCase(), key = $('#apikey').value.trim();
  if (!account || !key) return;
  NET.creds = { account, key }; NET.token = null;
  state.gasUnit = $('#gasunit').value; state.pay = $('#paymethod').value;
  if ($('#remember').checked){ store.set('account', account); store.set('key', key); store.set('gasUnit', state.gasUnit); store.set('pay', state.pay); }
  else ['account', 'key'].forEach(k => store.del(k));
  $('#settings').hidden = true; refresh();
});
$('#refreshBtn').addEventListener('click', () => refresh());
$('#ddAmount').value = store.get('dd') || '';
$('#ddAmount').addEventListener('input', () => { store.set('dd', $('#ddAmount').value); renderDD(); });
$('#copyLog').addEventListener('click', async () => {
  const t = logText(); if (!t) return;
  try { await navigator.clipboard.writeText(t); $('#copyLog').textContent = 'Copied'; }
  catch(e){ const r = document.createRange(); r.selectNodeContents($('#logOut .log')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('#copyLog').textContent = 'Selected'; }
  setTimeout(() => { $('#copyLog').textContent = 'Copy'; }, 1800);
});
$('#notifyBtn').addEventListener('click', async () => {
  if (store.get('notify') === 'on'){ store.set('notify', 'off'); renderNotify(); return; }
  try { const p = await Notification.requestPermission(); if (p === 'granted'){ store.set('notify', 'on'); new Notification('Notifications on', { body: 'You\'ll hear about negative Agile prices while this page is open.' }); } } catch(e){}
  renderNotify();
});
$('#bestSel').addEventListener('change', renderBest);
$('#actTable').addEventListener('change', e => {
  const id = e.target.dataset && e.target.dataset.act; if (!id) return;
  const v = parseFloat(e.target.value); if (!(v >= 0)) return;
  state.acts[id] = v; store.setJ('acts', state.acts); renderActivities(); renderBest();
});
$('#cmpBtn').addEventListener('click', runCompare);
['#bCap', '#bPow', '#bEff', '#bCost', '#bTariff'].forEach(s => $(s).addEventListener('input', renderBattery));
['#sSouth', '#sNorth', '#sWatt', '#sBatt', '#sCost', '#sExport'].forEach(s => $(s).addEventListener('input', renderSolar));
$('#sAngle').addEventListener('change', () => { state.pv = null; loadSolarInputs(); });
$('#clForm').addEventListener('submit', e => {
  e.preventDefault();
  const date = $('#clDate').value, text = $('#clText').value.trim(); if (!date || !text) return;
  state.changelog.push({ id: String(Date.now()), date, text }); store.setJ('changelog', state.changelog);
  $('#clText').value = ''; renderChangelog();
});
$('#clOut').addEventListener('click', e => {
  const id = e.target.dataset && e.target.dataset.del; if (!id) return;
  state.changelog = state.changelog.filter(c => c.id !== id); store.setJ('changelog', state.changelog); renderChangelog();
});
$('#measures').addEventListener('change', e => {
  const id = e.target.dataset && e.target.dataset.measure; if (!id) return;
  state.measures = e.target.checked ? [...new Set([...state.measures, id])] : state.measures.filter(x => x !== id);
  store.setJ('measures', state.measures); renderPlan();
});
['#epcCur', '#epcPot', '#epcNotes'].forEach(s => $(s).addEventListener('input', () => {
  state.epc = { cur: $('#epcCur').value, pot: $('#epcPot').value, notes: $('#epcNotes').value }; store.setJ('epc', state.epc); renderEPC();
}));
$('#epcForm').addEventListener('submit', searchEPCUI);
$('#csvBtn').addEventListener('click', () => {
  if (!state.raw) return;
  const blob = new Blob([toCSV(state.raw)], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `harold-street-energy-${dayKey(Date.now())}${isDemo() ? '-example' : ''}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.tab === 'prices') startLive(); });
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => renderTab(state.tab), 150); });
setInterval(() => { if (!document.hidden) loadPrices(); }, 30*60e3);

/* ---------- start ---------- */
(async () => {
  const k = store.get('key'), a = store.get('account');
  if (k && a) NET.creds = { account: a, key: k };
  state.raw = makeDemo(); regionOptions(); renderNotify();
  showTab((location.hash || '').slice(1) || 'overview');
  await detectProxy();
  renderServer();
  refresh();
})();
