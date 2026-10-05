/* ===================== analysis: pure functions, no DOM ===================== */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function makeDemo(){
  const rnd = mulberry32(19);
  const end = startOfDay(new Date()), from = addDays(end, -90);
  const elec = [], gas = [], agile = [], carbon = [];
  const weather = new Map();
  for (let d = new Date(from); d < addDays(end, 7); d = addDays(d, 1)){
    const i = Math.round((d - from) / 864e5);
    weather.set(dayKey(d), { t: +(15.5 - i * 0.09 + (rnd() - 0.5) * 4).toFixed(1), forecast: d >= end });
  }
  for (let t = +from; t < +end; t += 1800e3){
    const d = new Date(t), h = d.getHours() + d.getMinutes()/60;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    let e = 0.075 + rnd()*0.03;
    if (h >= 7 && h < 9) e += 0.12 + rnd()*0.15;
    if (h >= 12 && h < 14 && weekend) e += 0.15*rnd();
    if (h >= 17 && h < 19.5) e += 0.30 + rnd()*0.35;
    if (h >= 19.5 && h < 23) e += 0.15 + rnd()*0.12;
    if (rnd() < 0.012) e += 0.9 + rnd();
    elec.push({ t, v: +e.toFixed(3) });
    const temp = weather.get(dayKey(t)).t;
    const need = Math.max(0, 15.5 - temp) / 8;
    let g = 0;
    if ((h >= 6 && h < 8.5) || (h >= 17 && h < 22)) g = (0.5 + rnd()*0.5) * need * 1.4;
    if (h >= 7 && h < 7.5) g += 0.6 + rnd()*0.4;
    if (h >= 2 && h < 3 && rnd() < 0.08) g += 0.8;
    gas.push({ t, v: +g.toFixed(3) });
    let a = 16 + 6*Math.sin((h-4)/24*2*Math.PI) + (rnd()-0.5)*5;
    if (h >= 16 && h < 19) a += 14;
    if (h >= 1 && h < 5) a -= 6;
    if (rnd() < 0.01) a = -2 - rnd()*4;
    agile.push({ from: t, to: t + 1800e3, p: +a.toFixed(2) });
    carbon.push({ from: t, to: t + 1800e3, p: Math.round(120 + 60*Math.sin((h-6)/24*2*Math.PI) + (rnd()-0.5)*60) });
  }
  const flat = (code, name, unit, sc) => ({ code, name, product:'EXAMPLE', twoRate:false, unit:[{from:0,to:Infinity,p:unit}], sc:[{from:0,to:Infinity,p:sc}], aFrom:0, aTo:Infinity });
  const since = from.toISOString();
  return {
    demo: true, region: 'G',
    elecPts: [{ id:'Example MPAN', serials:['Example meter'], agreement:{ tariff_code:'E-1R-EXAMPLE-G', valid_from: since } }],
    gasPts: [{ id:'Example MPRN', serials:['Example meter'], agreement:{ tariff_code:'G-1R-EXAMPLE-G', valid_from: since } }],
    eSets: [flat('E-1R-EXAMPLE-G','Example flexible tariff', 24.86, 53.80)],
    gSets: [flat('G-1R-EXAMPLE-G','Example flexible tariff', 6.29, 32.67)],
    elec, gas, weather,
    agileHist: { product:'EXAMPLE', unit: agile, sc:[{from:0,to:Infinity,p:48.0}] },
    carbonHist: carbon
  };
}

/* ---------- main roll-up for the selected period ---------- */
function buildModel(raw, days){
  const end = startOfDay(new Date()), start = addDays(end, -days);
  const s = +start, e = +end;
  const list = [], idx = new Map();
  for (let d = new Date(start); d < end; d = addDays(d, 1)){
    idx.set(dayKey(d), list.length);
    list.push({ k: dayKey(d), date: new Date(d), e:0, ec:0, g:0, gc:0, eHas:false, gHas:false, co2:0 });
  }
  const eProf = new Array(48).fill(0), gProf = new Array(48).fill(0), eDays = new Set(), gDays = new Set();
  const ehh = [], ghh = [];
  const ch = raw.carbonHist && raw.carbonHist.length ? raw.carbonHist : null;
  let co2e = 0, co2g = 0, ciCovered = 0;
  for (const x of raw.elec){
    if (x.t < s || x.t >= e) continue;
    const d = list[idx.get(dayKey(x.t))]; if (!d) continue;
    d.e += x.v; d.eHas = true;
    const p = unitPriceAt(raw.eSets, x.t); if (p != null) d.ec += x.v * p;
    eProf[slotOf(x.t)] += x.v; eDays.add(d.k); ehh.push(x);
    const ci = ch ? lookup(ch, x.t) : null;
    const c = x.v * (ci != null ? ci/1000 : CO2_ELEC_FALLBACK);
    if (ci != null) ciCovered++;
    co2e += c; d.co2 += c;
  }
  for (const x of raw.gas){
    if (x.t < s || x.t >= e) continue;
    const d = list[idx.get(dayKey(x.t))]; if (!d) continue;
    d.g += x.v; d.gHas = true;
    const p = unitPriceAt(raw.gSets, x.t); if (p != null) d.gc += x.v * p;
    gProf[slotOf(x.t)] += x.v; gDays.add(d.k); ghh.push(x);
    co2g += x.v * CO2_GAS; d.co2 += x.v * CO2_GAS;
  }
  for (const d of list){
    const mid = +d.date + 12*3600e3;
    if (d.eHas){ const sc = standingAt(raw.eSets, mid); if (sc != null) d.ec += sc; }
    if (d.gHas){ const sc = standingAt(raw.gSets, mid); if (sc != null) d.gc += sc; }
  }
  const tot = { e: sum(list.map(d=>d.e)), ec: sum(list.map(d=>d.ec)), g: sum(list.map(d=>d.g)), gc: sum(list.map(d=>d.gc)),
                nE: list.filter(d=>d.eHas).length, nG: list.filter(d=>d.gHas).length };
  const nE = eDays.size, nG = gDays.size;
  const profile = eProf.map(v => nE ? v/nE : 0);
  const gasProfile = gProf.map(v => nG ? v/nG : 0);
  const totalE = sum(ehh.map(x=>x.v));
  const inSlots = (lo, hi) => sum(ehh.filter(x => { const i = slotOf(x.t); return i >= lo && i <= hi; }).map(x=>x.v));
  const sorted = ehh.map(x=>x.v).sort((a,b)=>a-b);
  const insights = nE && totalE > 0 ? {
    baseW: sorted[Math.floor(sorted.length*0.1)] * 2000,
    overnightShare: inSlots(1, 10)/totalE, peakShare: inSlots(32, 37)/totalE,
    evening: inSlots(32, 47)/nE, perDay: totalE/nE, rateNow: unitPriceAt(raw.eSets, Date.now())
  } : null;

  // Agile versus your tariff over the same readings
  let agileCmp = null;
  const ah = raw.agileHist;
  if (ah && ah.unit && ehh.length){
    let aP = 0, yP = 0; const cov = new Set();
    for (const x of ehh){ const a = lookup(ah.unit, x.t), y = unitPriceAt(raw.eSets, x.t); if (a == null || y == null) continue; aP += x.v*a; yP += x.v*y; cov.add(dayKey(x.t)); }
    for (const k of cov){ const mid = +keyDate(k) + 12*3600e3; aP += lookup(ah.sc, mid) ?? 0; yP += standingAt(raw.eSets, mid) ?? 0; }
    if (cov.size) agileCmp = { agile: aP, yours: yP, days: cov.size };
  }

  return { start, end, days: list, tot, profile, gasProfile, profDays: nE, gasDays: nG, insights, agileCmp,
           spikes: findSpikes(ehh), oddDays: oddDays(list), heating: heatingWindows(gasProfile, ghh),
           co2: { e: co2e, g: co2g, regional: ch && ciCovered > ehh.length*0.8 } };
}

/* ---------- patterns ---------- */
function findSpikes(ehh){
  if (ehh.length < 48*5) return [];
  const bySlot = Array.from({length:48}, () => []);
  for (const x of ehh) bySlot[slotOf(x.t)].push(x.v);
  const med = bySlot.map(median);
  return ehh.map(x => ({ ...x, base: med[slotOf(x.t)] }))
    .filter(x => x.v > 3*x.base && x.v - x.base > 0.35)
    .sort((a, b) => (b.v - b.base) - (a.v - a.base)).slice(0, 8);
}
function oddDays(list){
  const e = list.filter(d => d.eHas), g = list.filter(d => d.gHas);
  const me = median(e.map(d => d.e)), mg = median(g.map(d => d.g));
  const out = [];
  for (const d of e) if (me > 0 && d.e > me*1.4) out.push({ date: d.date, fuel:'Electricity', v: d.e, ratio: d.e/me });
  for (const d of g) if (mg > 1 && d.g > mg*1.5) out.push({ date: d.date, fuel:'Gas', v: d.g, ratio: d.g/mg });
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, 6);
}
function heatingWindows(gasProfile, ghh){
  const max = Math.max(...gasProfile);
  if (!(max > 0.05)) return null;
  const on = gasProfile.map(v => v > max*0.3);
  const runs = []; let st = null;
  for (let i = 0; i <= 48; i++){ if (i < 48 && on[i]){ if (st == null) st = i; } else if (st != null){ runs.push([st, i]); st = null; } }
  const nights = new Map();
  for (const x of ghh){ if (slotOf(x.t) < 10){ const k = dayKey(x.t); nights.set(k, (nights.get(k) || 0) + x.v); } }
  const nightDays = [...nights.entries()].filter(([, v]) => v > 0.3).map(([k]) => k);
  return { runs, nightDays, totalNights: nights.size };
}

/* ---------- weather and gas ---------- */
function gasRegression(raw){
  if (!raw.weather) return null;
  const byDay = new Map();
  for (const x of raw.gas) byDay.set(dayKey(x.t), (byDay.get(dayKey(x.t)) || 0) + x.v);
  const pts = [];
  for (const [k, g] of byDay){ const w = raw.weather.get(k); if (w && !w.forecast) pts.push({ k, temp: w.t, hdd: Math.max(0, 15.5 - w.t), g }); }
  if (pts.length < 10) return pts.length ? { pts, a: null, b: null } : null;
  const n = pts.length, mx = sum(pts.map(p=>p.hdd))/n, my = sum(pts.map(p=>p.g))/n;
  const sxx = sum(pts.map(p => (p.hdd-mx)**2)), sxy = sum(pts.map(p => (p.hdd-mx)*(p.g-my)));
  let b = sxx > 0 ? sxy/sxx : 0, a = my - b*mx;
  if (a < 0){ a = 0; b = sum(pts.map(p=>p.hdd*p.g)) / Math.max(1e-9, sum(pts.map(p=>p.hdd**2))); }
  const ssr = sum(pts.map(p => (p.g - (a + b*p.hdd))**2)), sst = sum(pts.map(p => (p.g-my)**2));
  return { pts, a, b: Math.max(0, b), r2: sst > 0 ? 1 - ssr/sst : 0 };
}
/** Typical-year gas use from the regression: base (hot water, cooking) + heating × degree days. */
function annualGas(reg, heatScale = 1){
  if (!reg || reg.a == null) return null;
  let base = 0, heat = 0;
  for (let m = 0; m < 12; m++){ const dm = DAYS_IN_MONTH(m); base += reg.a*dm; heat += reg.b * Math.max(0, 15.5 - TEMP_NORMALS[m]) * dm * heatScale; }
  return { base, heat, total: base + heat };
}
const MEASURES = [
  { id:'loft',    label:'Top up loft insulation to 270mm', cut:.10 },
  { id:'cavity',  label:'Cavity wall insulation', cut:.20 },
  { id:'draught', label:'Draught-proof doors, windows and floors', cut:.07 },
  { id:'glazing', label:'Replace remaining single glazing', cut:.08 },
  { id:'thermo',  label:'Turn the thermostat down 1°C', cut:.08 },
  { id:'flow',    label:'Lower boiler flow temperature to 55°C', cut:.05 },
  { id:'trv',     label:'Smart radiator valves, heat rooms only when used', cut:.06 }
];
function insulationPlan(reg, chosen, gasRate){
  const yr = annualGas(reg); if (!yr) return null;
  const keep = chosen.reduce((k, id) => { const m = MEASURES.find(x => x.id === id); return m ? k*(1-m.cut) : k; }, 1);
  const saved = yr.heat * (1 - keep);
  return { year: yr, saved, savedP: saved * gasRate, cutShare: 1 - keep };
}

/* ---------- money ---------- */
function monthProjection(raw){
  const today = startOfDay(new Date()), first = new Date(today.getFullYear(), today.getMonth(), 1);
  const dim = DAYS_IN_MONTH(today.getMonth());
  const m = buildModelRange(raw, first, today);
  const recent = buildModelRange(raw, addDays(today, -14), today);
  const avg = (recent.nE ? recent.ec/recent.nE : 0) + (recent.nG ? recent.gc/recent.nG : 0);
  const remaining = dim - (today.getDate() - 1);
  return { soFar: m.ec + m.gc, daysSoFar: today.getDate() - 1, remaining, projected: m.ec + m.gc + avg*remaining, avgDay: avg, month: MON[today.getMonth()] };
}
function buildModelRange(raw, from, to){
  const s = +from, e = +to; let ec = 0, gc = 0; const ed = new Set(), gd = new Set();
  for (const x of raw.elec) if (x.t >= s && x.t < e){ const p = unitPriceAt(raw.eSets, x.t); if (p != null) ec += x.v*p; ed.add(dayKey(x.t)); }
  for (const x of raw.gas) if (x.t >= s && x.t < e){ const p = unitPriceAt(raw.gSets, x.t); if (p != null) gc += x.v*p; gd.add(dayKey(x.t)); }
  for (const k of ed) ec += standingAt(raw.eSets, +keyDate(k) + 432e5) ?? 0;
  for (const k of gd) gc += standingAt(raw.gSets, +keyDate(k) + 432e5) ?? 0;
  return { ec, gc, nE: ed.size, nG: gd.size };
}
function annualProjection(raw, reg){
  const now = Date.now(), end = startOfDay(new Date());
  const r30 = buildModelRange(raw, addDays(end, -30), end);
  const eRate = unitPriceAt(raw.eSets, now), gRate = unitPriceAt(raw.gSets, now);
  const eSc = standingAt(raw.eSets, now) ?? 0, gSc = standingAt(raw.gSets, now) ?? 0;
  if (!r30.nE && !r30.nG) return null;
  const eUse = r30.nE ? sum(raw.elec.filter(x => x.t >= +addDays(end,-30) && x.t < +end).map(x=>x.v)) / r30.nE * 365 : 0;
  const elecP = r30.nE ? (eRate != null ? eUse*eRate : r30.ec/r30.nE*365) + eSc*365 : 0;
  const yr = annualGas(reg);
  let gasP = 0, gasMethod = 'none';
  if (raw.gasPts.length){
    if (yr && gRate != null){ gasP = yr.total*gRate + gSc*365; gasMethod = 'weather'; }
    else if (r30.nG){ gasP = r30.gc/r30.nG*365; gasMethod = 'recent'; }
  }
  return { elecP, gasP, total: elecP + gasP, gasMethod, eUse, gasUse: yr ? yr.total : null };
}
function nextCapChange(now = new Date()){
  const y = now.getFullYear();
  const cands = [0,3,6,9].map(m => new Date(y, m, 1)).concat([new Date(y+1, 0, 1)]).filter(d => d > now);
  const next = cands[0];
  const announce = addDays(next, -36);
  return { next, announce, days: Math.ceil((next - now)/864e5), announceDays: Math.ceil((announce - now)/864e5) };
}

/* ---------- comparisons and simulations ---------- */
function compareTariffs(raw, options, days = 90){
  const end = +startOfDay(new Date()), start = +addDays(end, -days);
  const rows = raw.elec.filter(x => x.t >= start && x.t < end);
  if (!rows.length) return null;
  const plans = [{ id:'current', label:'Your tariff now', note:'', price: t => unitPriceAt(raw.eSets, t), sc: t => standingAt(raw.eSets, t) }]
    .concat(options.map(o => ({ ...o, price: t => lookup(o.unit, t), sc: t => lookup(o.sc, t) })));
  const per = plans.map(() => new Map());
  const dayOK = new Map();
  for (const x of rows){
    const k = dayKey(x.t);
    plans.forEach((p, i) => {
      const r = p.price(x.t);
      const m = per[i];
      const cur = m.get(k) || { p: 0, ok: true };
      if (r == null) cur.ok = false; else cur.p += x.v * r;
      m.set(k, cur);
    });
  }
  const keys = [...per[0].keys()].filter(k => per.every(m => m.get(k)?.ok));
  if (!keys.length) return null;
  const res = plans.map((p, i) => {
    let tot = 0;
    for (const k of keys){ tot += per[i].get(k).p + (p.sc(+keyDate(k) + 432e5) ?? 0); }
    return { id: p.id, label: p.label, note: p.note, product: p.product, total: tot, year: tot / keys.length * 365 };
  });
  return { days: keys.length, rows: res.sort((a, b) => a.total - b.total) };
}

/** One charge-discharge cycle a day: buy cheap slots, cover dearer later demand. Estimate only. */
function simulateBattery(raw, priceAt, cap, powerKw, eff, days = 90){
  const end = +startOfDay(new Date()), start = +addDays(end, -days);
  const byDay = new Map();
  for (const x of raw.elec){ if (x.t < start || x.t >= end) continue; const p = priceAt(x.t); if (p == null) continue; const k = dayKey(x.t); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push({ t: x.t, d: x.v, p }); }
  const lim = powerKw * 0.5;
  let base = 0, saved = 0, cycled = 0;
  for (const slots of byDay.values()){
    slots.sort((a, b) => a.t - b.t);
    base += sum(slots.map(s => s.d*s.p));
    const chargeLeft = slots.map(() => lim), disLeft = slots.map(s => Math.min(s.d, lim));
    let budget = cap;
    const order = slots.map((s, i) => i).sort((a, b) => slots[b].p - slots[a].p);
    for (const j of order){
      while (disLeft[j] > 1e-6 && budget > 1e-6){
        let best = -1;
        for (let i = 0; i < j; i++) if (chargeLeft[i] > 1e-6 && slots[i].p/eff < slots[j].p && (best < 0 || slots[i].p < slots[best].p)) best = i;
        if (best < 0) break;
        const deliver = Math.min(disLeft[j], chargeLeft[best]*eff, budget*eff);
        const grid = deliver/eff;
        chargeLeft[best] -= grid; disLeft[j] -= deliver; budget -= grid;
        saved += deliver*slots[j].p - grid*slots[best].p; cycled += deliver;
      }
    }
  }
  const n = byDay.size;
  return n ? { days: n, base, saved, year: saved/n*365, cycledPerDay: cycled/n } : null;
}

/** Share of a day's sunshine falling in each half hour, for a mid-month day. */
function solarShape(month){
  const n = Math.round(30.4*month + 15), lat = HOME.lat * Math.PI/180;
  const dec = 23.44*Math.PI/180 * Math.sin(2*Math.PI*(284+n)/365);
  const w0 = Math.acos(clamp(-Math.tan(lat)*Math.tan(dec), -1, 1));
  const len = 2*w0*180/Math.PI/15;
  const noon = (month >= 3 && month <= 9) ? 13.1 : 12.1;   // clock time, BST in summer months
  const rise = noon - len/2;
  const w = Array.from({length:48}, (_, i) => { const t = i/2 + 0.25; return t > rise && t < rise + len ? Math.pow(Math.sin(Math.PI*(t-rise)/len), 1.5) : 0; });
  const s = sum(w) || 1;
  return w.map(v => v/s);
}
function simulateSolar({ profile, monthlyKwh, importP, exportP, batteryKwh = 0, eff = 0.9 }){
  let gen = 0, self = 0, fromBatt = 0, exp = 0;
  const months = [];
  for (let m = 0; m < 12; m++){
    const dm = DAYS_IN_MONTH(m), daily = monthlyKwh[m]/dm, shape = solarShape(m);
    let s = 0, b = 0, x = 0, soc = 0;
    for (let i = 0; i < 48; i++){
      const g = daily*shape[i], d = profile[i];
      if (g >= d){ s += d; let sur = g - d; const c = Math.min(sur, batteryKwh - soc); soc += c; sur -= c; x += sur; }
      else { s += g; const out = Math.min(d - g, soc*eff); b += out; soc -= out/eff; }
    }
    gen += monthlyKwh[m]; self += s*dm; fromBatt += b*dm; exp += x*dm;
    months.push({ m, gen: monthlyKwh[m], used: (s+b)*dm, exported: x*dm });
  }
  const savedP = (self + fromBatt)*importP + exp*exportP;
  return { gen, self, fromBatt, exp, savedP, useShare: gen ? (self+fromBatt)/gen : 0, months };
}

function cheapestWindow(rates, slots, now = Date.now()){
  const fut = rates.filter(r => r.to > now && r.from >= now - 1800e3);
  let best = null;
  for (let i = 0; i + slots - 1 < fut.length; i++){
    const w = fut.slice(i, i + slots);
    if (w.some((r, j) => j && r.from !== w[j-1].to)) continue;
    const avg = sum(w.map(r => r.p ?? r.v)) / slots;
    if (!best || avg < best.avg) best = { avg, from: w[0].from, to: w[slots-1].to };
  }
  return best;
}

/* ---------- weekly log ---------- */
function weekLog(raw){
  const end = startOfDay(new Date());
  const wk = (a, b) => {
    const s = +addDays(end, a), e = +addDays(end, b);
    const dayE = new Map(), dayG = new Map();
    let ec = 0, gc = 0;
    for (const x of raw.elec) if (x.t >= s && x.t < e){ dayE.set(dayKey(x.t), (dayE.get(dayKey(x.t))||0) + x.v); const p = unitPriceAt(raw.eSets, x.t); if (p != null) ec += x.v*p; }
    for (const x of raw.gas) if (x.t >= s && x.t < e){ dayG.set(dayKey(x.t), (dayG.get(dayKey(x.t))||0) + x.v); const p = unitPriceAt(raw.gSets, x.t); if (p != null) gc += x.v*p; }
    for (const k of dayE.keys()) ec += standingAt(raw.eSets, +keyDate(k)+432e5) ?? 0;
    for (const k of dayG.keys()) gc += standingAt(raw.gSets, +keyDate(k)+432e5) ?? 0;
    const tot = new Map([...dayE.keys(), ...dayG.keys()].map(k => [k, 0]));
    for (const [k, v] of dayE) tot.set(k, tot.get(k) + v);
    for (const [k, v] of dayG) tot.set(k, tot.get(k) + v);
    const ranked = [...tot.entries()].sort((a, b) => a[1] - b[1]);
    return { e: sum([...dayE.values()]), g: sum([...dayG.values()]), cost: ec + gc, days: tot.size,
             best: ranked[0] || null, worst: ranked[ranked.length-1] || null, from: addDays(end, a), to: addDays(end, b-1) };
  };
  return { cur: wk(-7, 0), prev: wk(-14, -7) };
}

/* ---------- activities ---------- */
const ACTIVITIES = [
  { id:'kettle', label:'Kettle, full boil', fuel:'e', kwh:0.11 },
  { id:'wash', label:'Washing machine, 40°C load', fuel:'e', kwh:0.8, hours:2 },
  { id:'dish', label:'Dishwasher, eco cycle', fuel:'e', kwh:0.9, hours:3 },
  { id:'dryer', label:'Tumble dryer load', fuel:'e', kwh:2.4, hours:1.5 },
  { id:'oven', label:'Electric oven, 1 hour', fuel:'e', kwh:1.6, hours:1 },
  { id:'hob', label:'Electric hob, 30 minutes', fuel:'e', kwh:0.7, hours:0.5 },
  { id:'fridge', label:'Fridge-freezer, a day', fuel:'e', kwh:0.6 },
  { id:'tv', label:'TV, 3 hours', fuel:'e', kwh:0.25 },
  { id:'laptop', label:'Laptop, a working day', fuel:'e', kwh:0.3 },
  { id:'phone', label:'Phone charge', fuel:'e', kwh:0.015 },
  { id:'shower', label:'Shower, 8 minutes (gas combi)', fuel:'g', kwh:3.0 },
  { id:'bath', label:'Bath (gas)', fuel:'g', kwh:5.0 },
  { id:'heat', label:'Central heating, 1 hour', fuel:'g', kwh:4.0 }
];

function toCSV(raw){
  const g = new Map(raw.gas.map(x => [x.t, x.v]));
  const times = [...new Set([...raw.elec.map(x=>x.t), ...raw.gas.map(x=>x.t)])].sort((a,b)=>a-b);
  const e = new Map(raw.elec.map(x => [x.t, x.v]));
  const lines = ['interval_start,electricity_kwh,electricity_p_per_kwh,gas_kwh,gas_p_per_kwh'];
  for (const t of times){
    const ep = unitPriceAt(raw.eSets, t), gp = unitPriceAt(raw.gSets, t);
    lines.push([new Date(t).toISOString(), e.get(t) ?? '', ep ?? '', g.has(t) ? g.get(t).toFixed(4) : '', gp ?? ''].join(','));
  }
  return lines.join('\n');
}
