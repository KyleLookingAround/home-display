/* Octopus Energy: REST (tariffs, consumption, products) and GraphQL (Home Mini, Saving Sessions, Octoplus). */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
import { addDays, GAS_M3_TO_KWH, REGIONS, startOfDay, sum } from './format.js';
import { ApiError, NET, request } from './net.js';

export const OCTO = 'https://api.octopus.energy';
export const octoUrl = path => {
  if (path.startsWith('http')) path = path.replace(/^http:/, 'https:').replace(OCTO, '');
  return (NET.proxy ? './proxy/octopus' : OCTO) + path;
};
export async function octoGet(path, auth = false){
  const headers = { Accept: 'application/json' };
  if (auth){ if (!NET.creds) throw new ApiError('AUTH'); headers.Authorization = 'Basic ' + btoa(NET.creds.key + ':'); }
  return request(octoUrl(path), { headers });
}
export async function octoAll(path, auth = false, maxPages = 8){
  let out = [], next = path, n = 0;
  while (next && n < maxPages){ const j = await octoGet(next, auth); out = out.concat(j.results || []); next = j.next; n++; }
  return out;
}

/* ---------- rates ---------- */
export const productOf = code => code.split('-').slice(2, -1).join('-');
export const regionOf = code => code ? code.slice(-1).toUpperCase() : null;
export function prepRates(list, pay = 'DIRECT_DEBIT'){
  if (!list) return null;
  let l = list.filter(r => r.payment_method === pay || r.payment_method == null);
  if (!l.length) l = list;
  return l.map(r => ({ from: +new Date(r.valid_from), to: r.valid_to ? +new Date(r.valid_to) : Infinity, p: r.value_inc_vat }))
          .sort((a, b) => a.from - b.from);
}
export function lookup(list, t){
  if (!list || !list.length) return null;
  let lo = 0, hi = list.length - 1, ans = -1;
  while (lo <= hi){ const mid = (lo + hi) >> 1; if (list[mid].from <= t){ ans = mid; lo = mid + 1; } else hi = mid - 1; }
  for (let i = ans; i >= 0 && i > ans - 6; i--){ const r = list[i]; if (r.from <= t && t < r.to) return r.p; }
  return null;
}
export function pickAgreement(list){
  const now = Date.now();
  const a = (list || []).slice().sort((x, y) => new Date(x.valid_from) - new Date(y.valid_from));
  return a.find(g => +new Date(g.valid_from) <= now && (!g.valid_to || +new Date(g.valid_to) > now)) || a[a.length-1] || null;
}
export const tariffAt = (sets, t) => (sets || []).find(s => s.aFrom <= t && t < s.aTo) || null;
export function unitPriceAt(sets, t){
  const s = tariffAt(sets, t); if (!s) return null;
  if (s.twoRate){ const d = new Date(t), m = d.getHours()*60 + d.getMinutes(); return lookup(m >= 30 && m < 450 ? s.night : s.day, t); }
  return lookup(s.unit, t);
}
export function standingAt(sets, t){ const s = tariffAt(sets, t); return s ? lookup(s.sc, t) : null; }
export function currentRates(sets){
  const now = Date.now();
  const s = tariffAt(sets, now) || (sets && sets[sets.length-1]);
  if (!s) return null;
  return { name: s.name, code: s.code, twoRate: s.twoRate,
    unit: s.twoRate ? null : lookup(s.unit, now), day: s.twoRate ? lookup(s.day, now) : null,
    night: s.twoRate ? lookup(s.night, now) : null, standing: lookup(s.sc, now) };
}

export async function loadTariff(fuel, code, from, pay){
  const product = productOf(code);
  const base = `/v1/products/${product}/${fuel}-tariffs/${code}`;
  const q = `?period_from=${from.toISOString()}&page_size=1500`;
  const twoRate = /^E-2R/.test(code);
  const t = { code, product, name: code, twoRate, unit: null, day: null, night: null, sc: null };
  if (twoRate){
    t.day = prepRates(await octoAll(`${base}/day-unit-rates/${q}`), pay);
    t.night = prepRates(await octoAll(`${base}/night-unit-rates/${q}`), pay);
  } else t.unit = prepRates(await octoAll(`${base}/standard-unit-rates/${q}`), pay);
  t.sc = prepRates(await octoAll(`${base}/standing-charges/${q}`), pay);
  try { const p = await octoGet(`/v1/products/${product}/`); t.name = p.display_name || p.full_name || code; } catch(e){}
  return t;
}
export async function loadTariffSets(fuel, agreements, from, pay){
  const now = Date.now();
  const rel = (agreements || []).filter(a => (!a.valid_to || +new Date(a.valid_to) > +from) && +new Date(a.valid_from) < now);
  const sets = [];
  for (const a of rel){
    const t = await loadTariff(fuel, a.tariff_code, from, pay);
    t.aFrom = +new Date(a.valid_from); t.aTo = a.valid_to ? +new Date(a.valid_to) : Infinity;
    sets.push(t);
  }
  return sets;
}
export async function loadConsumption(fuel, points, from, to){
  const seg = fuel === 'electricity' ? 'electricity-meter-points' : 'gas-meter-points';
  const map = new Map();
  for (const pt of points) for (const serial of pt.serials){
    let rows = [];
    try {
      rows = await octoAll(`/v1/${seg}/${encodeURIComponent(pt.id)}/meters/${encodeURIComponent(serial)}/consumption/?period_from=${from.toISOString()}&period_to=${to.toISOString()}&page_size=25000&order_by=period`, true, 3);
    } catch(e){ if (e.code === 'AUTH' || e.code === 'NETWORK') throw e; continue; }
    for (const r of rows){ const t = +new Date(r.interval_start); map.set(t, (map.get(t) || 0) + r.consumption); }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v }));
}

export let productsCache = null;
export async function listProducts(){
  if (!productsCache) productsCache = await octoAll('/v1/products/?brand=OCTOPUS_ENERGY&is_business=false&page_size=100', false, 4);
  return productsCache;
}
export async function findProduct(re){
  const list = (await listProducts()).filter(p => re.test(p.code));
  list.sort((a, b) => new Date(b.available_from) - new Date(a.available_from));
  return list[0] || null;
}
/** Unit rates + standing charges for any electricity product in a region. Public data. */
export async function loadProductRates(product, region, from, to, pages = 4, pay = 'DIRECT_DEBIT'){
  const tariff = `E-1R-${product}-${region}`;
  const base = `/v1/products/${product}/electricity-tariffs/${tariff}`;
  const q = `?period_from=${from.toISOString()}${to ? '&period_to=' + to.toISOString() : ''}&page_size=1500`;
  const unit = prepRates(await octoAll(`${base}/standard-unit-rates/${q}`, false, pages), pay);
  let sc = null;
  try { sc = prepRates(await octoAll(`${base}/standing-charges/${q}`, false, 1), pay); } catch(e){}
  return { product, tariff, unit, sc };
}
export async function loadAgile(region, from, to, pages = 4){
  const p = await findProduct(/^AGILE-(?!OUTGOING)/);
  if (!p) throw new ApiError('NOPRODUCT', 'Octopus isn\'t listing an Agile tariff right now.');
  return loadProductRates(p.code, region, from, to, pages);
}

/* Tariffs to compare. Eligibility notes are general, Octopus has the final rules. */
export const COMPARE = [
  { id:'agile',  re:/^AGILE-(?!OUTGOING)/, label:'Agile', note:'Price changes every half hour, capped at 100p.' },
  { id:'go',     re:/^GO-VAR-/,            label:'Octopus Go', note:'Usually needs an electric vehicle.' },
  { id:'iog',    re:/^INTELLI-VAR-/,       label:'Intelligent Octopus Go', note:'Needs a compatible EV, charger or home battery.' },
  { id:'flux',   re:/^FLUX-IMPORT-/,       label:'Octopus Flux', note:'Needs solar panels and a home battery.' },
  { id:'cosy',   re:/^COSY-/,              label:'Cosy Octopus', note:'Needs a heat pump.' },
  { id:'tracker',re:/^SILVER-/,            label:'Octopus Tracker', note:'Price changes daily with wholesale costs.' }
];
/* Gas tariffs to compare. Gas costs the same all day, so it's priced at today's rates over a usual year. */
export const GAS_COMPARE = [
  { id:'flex',    re:/^VAR-\d/,       label:'Flexible Octopus', note:'Moves with the price cap each quarter.' },
  { id:'fix12',   re:/^OE-FIX-12M-/,  label:'Octopus 12M Fixed', note:'Fixed for a year; leaving early can cost.' },
  { id:'fix18',   re:/^OE-FIX-18M-/,  label:'Octopus 18M Fixed', note:'Fixed for 18 months; leaving early can cost.' },
  { id:'tracker', re:/^SILVER-/,      label:'Octopus Tracker', note:'Changes daily with wholesale prices.' }
];
/** A gas tariff's unit rate and standing charge today, in a region. Public data. */
export async function loadGasOffer(product, region, pay = 'DIRECT_DEBIT'){
  const base = `/v1/products/${product}/gas-tariffs/G-1R-${product}-${region}`, now = Date.now();
  const unit = prepRates(await octoAll(`${base}/standard-unit-rates/?page_size=10`, false, 1), pay);
  const sc = prepRates(await octoAll(`${base}/standing-charges/?page_size=10`, false, 1), pay);
  return { product, unit: lookup(unit, now), sc: lookup(sc, now) };
}
export const EXPORTS = [
  { id:'agileOut', re:/^AGILE-OUTGOING-/, label:'Agile Outgoing' },
  { id:'fluxOut',  re:/^FLUX-EXPORT-/,    label:'Flux export' },
  { id:'outFix',   re:/^OUTGOING-(PRIME-)?FIX-/, label:'Outgoing Fixed' },
  { id:'outVar',   re:/^OUTGOING-VAR-/,   label:'Outgoing Octopus' }
];
export async function loadExportRates(region){
  const out = [];
  const from = addDays(startOfDay(new Date()), -1);
  for (const e of EXPORTS){
    try {
      const p = await findProduct(e.re); if (!p) continue;
      const r = await loadProductRates(p.code, region, from, null, 1);
      const vals = (r.unit || []).filter(x => x.to > Date.now() - 864e5).map(x => x.p);
      if (vals.length) out.push({ ...e, product: p.code, rate: sum(vals)/vals.length, variable: new Set(vals).size > 1 });
    } catch(err){}
  }
  return out;
}

/* ---------- account ---------- */
export async function loadProperty(){
  const acc = await octoGet(`/v1/accounts/${encodeURIComponent(NET.creds.account)}/`, true);
  const props = acc.properties || [];
  const prop = props.find(p => !p.moved_out_at) || props[props.length-1];
  if (!prop) throw new ApiError('NOPROP', 'No property is listed on this account yet.');
  return prop;
}
export async function loadAccount({ gasUnit, pay, fallbackRegion }){
  const prop = await loadProperty();
  const pts = (list, idKey) => (list || []).map(m => ({
    id: m[idKey], serials: (m.meters || []).map(x => x.serial_number).filter(Boolean),
    agreements: m.agreements || [], agreement: pickAgreement(m.agreements)
  }));
  const elecPts = pts((prop.electricity_meter_points || []).filter(m => !m.is_export), 'mpan');
  const gasPts = pts(prop.gas_meter_points, 'mprn');
  const end = startOfDay(new Date()), from = addDays(end, -90);
  const eSets = elecPts[0] ? await loadTariffSets('electricity', elecPts[0].agreements, from, pay) : [];
  const gSets = gasPts[0] ? await loadTariffSets('gas', gasPts[0].agreements, from, pay) : [];
  const elec = elecPts.length ? await loadConsumption('electricity', elecPts, from, end) : [];
  let gas = gasPts.length ? await loadConsumption('gas', gasPts, from, end) : [];
  if (gasUnit === 'm3') gas = gas.map(r => ({ t: r.t, v: r.v * GAS_M3_TO_KWH }));
  const region = regionOf(elecPts[0] && elecPts[0].agreement && elecPts[0].agreement.tariff_code) || fallbackRegion;
  return { demo: false, region: REGIONS[region] ? region : fallbackRegion, elecPts, gasPts, eSets, gSets, elec, gas };
}
/** Today's electricity tariff only, without readings: what the display needs to price the Home Mini's figures. */
export async function loadTodayTariff(pay){
  const prop = await loadProperty();
  const pt = (prop.electricity_meter_points || []).filter(m => !m.is_export)[0];
  if (!pt) return { region: null, eSets: [] };
  const a = pickAgreement(pt.agreements);
  return { region: regionOf(a && a.tariff_code), eSets: await loadTariffSets('electricity', pt.agreements, startOfDay(new Date()), pay) };
}

/* ---------- Octopus GraphQL (Home Mini, Saving Sessions, Octoplus) ---------- */
export async function gql(query, variables = {}, auth = true){
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (auth) headers.Authorization = 'JWT ' + await krakenToken();
  const j = await request(octoUrl('/v1/graphql/'), { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  if (j.errors && !j.data) throw new ApiError('GQL', j.errors.map(e => e.message).join('; '));
  return j.data;
}
export async function krakenToken(){
  if (NET.token && Date.now() - NET.tokenAt < 50*60e3) return NET.token;
  const d = await gql('mutation($k:String!){obtainKrakenToken(input:{APIKey:$k}){token}}', { k: NET.creds.key }, false);
  NET.token = d.obtainKrakenToken.token; NET.tokenAt = Date.now();
  return NET.token;
}
export async function findHomeMini(){
  const d = await gql(`query($a:String!){account(accountNumber:$a){electricityAgreements(active:true){meterPoint{meters(includeInactive:false){serialNumber smartImportElectricityMeter{deviceId}}}}}}`, { a: NET.creds.account });
  for (const ag of (d.account && d.account.electricityAgreements) || [])
    for (const m of (ag.meterPoint && ag.meterPoint.meters) || []) if (m.smartImportElectricityMeter && m.smartImportElectricityMeter.deviceId) return m.smartImportElectricityMeter.deviceId;
  return null;
}
/** Live draw from the Home Mini. withToday adds the day's half hours: a second GraphQL call, so the display asks for it less often. */
export async function liveReading(deviceId, withToday = true){
  const now = new Date(), q = `query($d:String!,$s:DateTime!,$e:DateTime!,$g:TelemetryGrouping){smartMeterTelemetry(deviceId:$d,grouping:$g,start:$s,end:$e){readAt consumptionDelta demand}}`;
  const recent = await gql(q, { d: deviceId, s: new Date(now - 10*60e3).toISOString(), e: now.toISOString(), g: 'TEN_SECONDS' });
  const tens = (recent.smartMeterTelemetry || []).filter(r => r.demand != null);
  const last = tens[tens.length-1] || null;
  let today = null, halfHours = null;
  if (withToday) try {
    const hh = await gql(q, { d: deviceId, s: startOfDay(now).toISOString(), e: now.toISOString(), g: 'HALF_HOURLY' });
    halfHours = (hh.smartMeterTelemetry || []).map(r => ({ t: +new Date(r.readAt), v: (+r.consumptionDelta || 0) / 1000 }));
    today = sum(halfHours.map(r => r.v));
  } catch(e){}
  return { demand: last ? +last.demand : null, at: last ? +new Date(last.readAt) : null, today, rows: halfHours };
}
export async function loadRewards(){
  const out = { sessions: null, points: null };
  try {
    const d = await gql(`query($a:String!){savingSessions{events(includeDev:false){id startAt endAt rewardPerKwhInOctoPoints} account(accountNumber:$a){hasJoinedCampaign joinedEvents{eventId startAt endAt rewardGivenInOctoPoints}}}}`, { a: NET.creds.account });
    out.sessions = d.savingSessions || null;
  } catch(e){}
  try {
    const d = await gql('{loyaltyPointLedgers{balanceCarriedForward}}');
    const l = d.loyaltyPointLedgers || [];
    if (l.length) out.points = +l[0].balanceCarriedForward;
  } catch(e){}
  return out;
}
