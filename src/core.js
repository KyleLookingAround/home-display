/* ===================== core: constants, helpers, network, data loading ===================== */
const REGIONS = {A:'Eastern England',B:'East Midlands',C:'London',D:'Merseyside & North Wales',E:'West Midlands',F:'North East England',G:'North West England',H:'Southern England',J:'South East England',K:'South Wales',L:'South West England',M:'Yorkshire',N:'South Scotland',P:'North Scotland'};
// Octopus region letter -> Carbon Intensity API region id
const CI_REGION = {A:10,B:9,C:13,D:6,E:8,F:4,G:3,H:12,J:14,K:7,L:11,M:5,N:2,P:1};
const GAS_M3_TO_KWH = 1.02264 * 39.5 / 3.6;
const CO2_ELEC_FALLBACK = 0.2;   // kg/kWh, used when regional intensity is unavailable
const CO2_GAS = 0.183;           // kg/kWh, UK government conversion factor for natural gas (approx.)
const HOME = { lat: 53.41, lon: -2.16 }; // Stockport
// Long-term monthly mean temperatures near Manchester (°C), approximate
const TEMP_NORMALS = [4.6,4.8,6.6,8.9,12.0,14.8,16.6,16.3,14.0,10.8,7.3,4.9];
// Rough solar yield near Manchester, kWh per kWp per month, panels at ~35°. Used when PVGIS can't be reached.
const SOLAR_SOUTH = [24,42,74,104,122,118,117,101,81,54,29,19];
const SOLAR_NORTH = [6,13,32,60,82,88,84,66,40,19,8,5];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_IN_MONTH = m => new Date(2027, m + 1, 0).getDate();

const pad2 = n => String(n).padStart(2, '0');
const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
const keyDate = k => new Date(`${k}T00:00:00`);
const slotOf = t => { const d = new Date(t); return d.getHours()*2 + (d.getMinutes() >= 30 ? 1 : 0); };
const hhmm = t => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const slotLabel = i => `${pad2(Math.floor((i % 48)/2))}:${i % 2 ? '30' : '00'}`;
const fmtDate = d => `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
const shortDate = d => `${d.getDate()} ${MON[d.getMonth()]}`;
const longDate = d => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
const gbp = p => (p < 0 ? '−' : '') + '£' + Math.abs(p/100).toFixed(2);   // pence in, pounds out
const gbp0 = p => (p < 0 ? '−' : '') + '£' + Math.round(Math.abs(p/100)).toLocaleString('en-GB');
const kwh = v => `${v.toFixed(v >= 100 ? 0 : 1)} kWh`;
const pence = p => `${Math.abs(p) < 10 ? p.toFixed(2) : p.toFixed(1)}p`;
const kg = v => v >= 1000 ? `${(v/1000).toFixed(2)} t` : `${v.toFixed(v >= 100 ? 0 : 1)} kg`;
const pct = v => `${Math.round(v*100)}%`;
const fmtTick = v => { const r = Math.round(v*100)/100; return Math.abs(r) >= 10 ? String(Math.round(r)) : String(r); };
const sum = a => a.reduce((x, y) => x + y, 0);
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x,y)=>x-y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function niceStep(x){ if (!(x > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))); const n = x/p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
function niceScale(min, max, n = 4){ if (!(max > min)) max = min + 1; const step = niceStep((max-min)/n); return { lo: Math.floor(min/step)*step, hi: Math.ceil(max/step)*step, step }; }

/* ---------- network ---------- */
class ApiError extends Error { constructor(code, msg){ super(msg || code); this.code = code; } }
const NET = { proxy: false, creds: null, token: null, tokenAt: 0 };
const OCTO = 'https://api.octopus.energy';

async function request(url, opts = {}){
  let res;
  try { res = await fetch(url, opts); }
  catch(e){ throw new ApiError('NETWORK'); }
  if (res.status === 401 || res.status === 403) throw new ApiError('AUTH');
  if (res.status === 404) throw new ApiError('NOTFOUND');
  if (res.status === 502 || res.status === 504) throw new ApiError('NETWORK');
  if (!res.ok) throw new ApiError('HTTP', `The service returned an error (${res.status}).`);
  return res.json();
}
const octoUrl = path => {
  if (path.startsWith('http')) path = path.replace(/^http:/, 'https:').replace(OCTO, '');
  return (NET.proxy ? './proxy/octopus' : OCTO) + path;
};
async function octoGet(path, auth = false){
  const headers = { Accept: 'application/json' };
  if (auth){ if (!NET.creds) throw new ApiError('AUTH'); headers.Authorization = 'Basic ' + btoa(NET.creds.key + ':'); }
  return request(octoUrl(path), { headers });
}
async function octoAll(path, auth = false, maxPages = 8){
  let out = [], next = path, n = 0;
  while (next && n < maxPages){ const j = await octoGet(next, auth); out = out.concat(j.results || []); next = j.next; n++; }
  return out;
}
async function detectProxy(){
  if (location.protocol === 'file:') return false;
  try { const r = await fetch('./proxy/ping', { cache: 'no-store' }); NET.proxy = r.ok && (await r.text()).trim() === 'ok'; }
  catch(e){ NET.proxy = false; }
  return NET.proxy;
}

/* ---------- rates ---------- */
const productOf = code => code.split('-').slice(2, -1).join('-');
const regionOf = code => code ? code.slice(-1).toUpperCase() : null;
function prepRates(list, pay = 'DIRECT_DEBIT'){
  if (!list) return null;
  let l = list.filter(r => r.payment_method === pay || r.payment_method == null);
  if (!l.length) l = list;
  return l.map(r => ({ from: +new Date(r.valid_from), to: r.valid_to ? +new Date(r.valid_to) : Infinity, p: r.value_inc_vat }))
          .sort((a, b) => a.from - b.from);
}
function lookup(list, t){
  if (!list || !list.length) return null;
  let lo = 0, hi = list.length - 1, ans = -1;
  while (lo <= hi){ const mid = (lo + hi) >> 1; if (list[mid].from <= t){ ans = mid; lo = mid + 1; } else hi = mid - 1; }
  for (let i = ans; i >= 0 && i > ans - 6; i--){ const r = list[i]; if (r.from <= t && t < r.to) return r.p; }
  return null;
}
function pickAgreement(list){
  const now = Date.now();
  const a = (list || []).slice().sort((x, y) => new Date(x.valid_from) - new Date(y.valid_from));
  return a.find(g => +new Date(g.valid_from) <= now && (!g.valid_to || +new Date(g.valid_to) > now)) || a[a.length-1] || null;
}
const tariffAt = (sets, t) => (sets || []).find(s => s.aFrom <= t && t < s.aTo) || null;
function unitPriceAt(sets, t){
  const s = tariffAt(sets, t); if (!s) return null;
  if (s.twoRate){ const d = new Date(t), m = d.getHours()*60 + d.getMinutes(); return lookup(m >= 30 && m < 450 ? s.night : s.day, t); }
  return lookup(s.unit, t);
}
function standingAt(sets, t){ const s = tariffAt(sets, t); return s ? lookup(s.sc, t) : null; }
function currentRates(sets){
  const now = Date.now();
  const s = tariffAt(sets, now) || (sets && sets[sets.length-1]);
  if (!s) return null;
  return { name: s.name, code: s.code, twoRate: s.twoRate,
    unit: s.twoRate ? null : lookup(s.unit, now), day: s.twoRate ? lookup(s.day, now) : null,
    night: s.twoRate ? lookup(s.night, now) : null, standing: lookup(s.sc, now) };
}

async function loadTariff(fuel, code, from, pay){
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
async function loadTariffSets(fuel, agreements, from, pay){
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
async function loadConsumption(fuel, points, from, to){
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

let productsCache = null;
async function listProducts(){
  if (!productsCache) productsCache = await octoAll('/v1/products/?brand=OCTOPUS_ENERGY&is_business=false&page_size=100', false, 4);
  return productsCache;
}
async function findProduct(re){
  const list = (await listProducts()).filter(p => re.test(p.code));
  list.sort((a, b) => new Date(b.available_from) - new Date(a.available_from));
  return list[0] || null;
}
/** Unit rates + standing charges for any electricity product in a region. Public data. */
async function loadProductRates(product, region, from, to, pages = 4, pay = 'DIRECT_DEBIT'){
  const tariff = `E-1R-${product}-${region}`;
  const base = `/v1/products/${product}/electricity-tariffs/${tariff}`;
  const q = `?period_from=${from.toISOString()}${to ? '&period_to=' + to.toISOString() : ''}&page_size=1500`;
  const unit = prepRates(await octoAll(`${base}/standard-unit-rates/${q}`, false, pages), pay);
  let sc = null;
  try { sc = prepRates(await octoAll(`${base}/standing-charges/${q}`, false, 1), pay); } catch(e){}
  return { product, tariff, unit, sc };
}
async function loadAgile(region, from, to, pages = 4){
  const p = await findProduct(/^AGILE-(?!OUTGOING)/);
  if (!p) throw new ApiError('NOPRODUCT', 'Octopus isn\'t listing an Agile tariff right now.');
  return loadProductRates(p.code, region, from, to, pages);
}

/* Tariffs to compare. Eligibility notes are general, Octopus has the final rules. */
const COMPARE = [
  { id:'agile',  re:/^AGILE-(?!OUTGOING)/, label:'Agile', note:'Price changes every half hour, capped at 100p.' },
  { id:'go',     re:/^GO-VAR-/,            label:'Octopus Go', note:'Usually needs an electric vehicle.' },
  { id:'iog',    re:/^INTELLI-VAR-/,       label:'Intelligent Octopus Go', note:'Needs a compatible EV, charger or home battery.' },
  { id:'flux',   re:/^FLUX-IMPORT-/,       label:'Octopus Flux', note:'Needs solar panels and a home battery.' },
  { id:'cosy',   re:/^COSY-/,              label:'Cosy Octopus', note:'Needs a heat pump.' },
  { id:'tracker',re:/^SILVER-/,            label:'Octopus Tracker', note:'Price changes daily with wholesale costs.' }
];
const EXPORTS = [
  { id:'agileOut', re:/^AGILE-OUTGOING-/, label:'Agile Outgoing' },
  { id:'fluxOut',  re:/^FLUX-EXPORT-/,    label:'Flux export' },
  { id:'outFix',   re:/^OUTGOING-(PRIME-)?FIX-/, label:'Outgoing Fixed' },
  { id:'outVar',   re:/^OUTGOING-VAR-/,   label:'Outgoing Octopus' }
];
async function loadExportRates(region){
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
async function loadAccount({ gasUnit, pay, fallbackRegion }){
  const acc = await octoGet(`/v1/accounts/${encodeURIComponent(NET.creds.account)}/`, true);
  const props = acc.properties || [];
  const prop = props.find(p => !p.moved_out_at) || props[props.length-1];
  if (!prop) throw new ApiError('NOPROP', 'No property is listed on this account yet.');
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
  const region = regionOf(elecPts[0]?.agreement?.tariff_code) || fallbackRegion;
  return { demo: false, region: REGIONS[region] ? region : fallbackRegion, elecPts, gasPts, eSets, gSets, elec, gas };
}

/* ---------- Octopus GraphQL (Home Mini, Saving Sessions, Octoplus) ---------- */
async function gql(query, variables = {}, auth = true){
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (auth) headers.Authorization = 'JWT ' + await krakenToken();
  const j = await request(octoUrl('/v1/graphql/'), { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  if (j.errors && !j.data) throw new ApiError('GQL', j.errors.map(e => e.message).join('; '));
  return j.data;
}
async function krakenToken(){
  if (NET.token && Date.now() - NET.tokenAt < 50*60e3) return NET.token;
  const d = await gql('mutation($k:String!){obtainKrakenToken(input:{APIKey:$k}){token}}', { k: NET.creds.key }, false);
  NET.token = d.obtainKrakenToken.token; NET.tokenAt = Date.now();
  return NET.token;
}
async function findHomeMini(){
  const d = await gql(`query($a:String!){account(accountNumber:$a){electricityAgreements(active:true){meterPoint{meters(includeInactive:false){serialNumber smartImportElectricityMeter{deviceId}}}}}}`, { a: NET.creds.account });
  for (const ag of d.account?.electricityAgreements || [])
    for (const m of ag.meterPoint?.meters || []) if (m.smartImportElectricityMeter?.deviceId) return m.smartImportElectricityMeter.deviceId;
  return null;
}
async function liveReading(deviceId){
  const now = new Date(), q = `query($d:String!,$s:DateTime!,$e:DateTime!,$g:TelemetryGrouping){smartMeterTelemetry(deviceId:$d,grouping:$g,start:$s,end:$e){readAt consumptionDelta demand}}`;
  const recent = await gql(q, { d: deviceId, s: new Date(now - 10*60e3).toISOString(), e: now.toISOString(), g: 'TEN_SECONDS' });
  const rows = (recent.smartMeterTelemetry || []).filter(r => r.demand != null);
  const last = rows[rows.length-1] || null;
  let today = null;
  try {
    const hh = await gql(q, { d: deviceId, s: startOfDay(now).toISOString(), e: now.toISOString(), g: 'HALF_HOURLY' });
    today = sum((hh.smartMeterTelemetry || []).map(r => +r.consumptionDelta || 0)) / 1000;
  } catch(e){}
  return { demand: last ? +last.demand : null, at: last ? +new Date(last.readAt) : null, today };
}
async function loadRewards(){
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

/* ---------- other services ---------- */
async function loadCarbonForecast(regionId){
  const from = new Date(Math.floor(Date.now() / 1800e3) * 1800e3).toISOString().replace(/:\d\d\.\d+Z$/, 'Z');
  const j = await request(`https://api.carbonintensity.org.uk/regional/intensity/${from}/fw48h/regionid/${regionId}`, { headers: { Accept: 'application/json' } });
  return parseCarbon(j);
}
function parseCarbon(j){
  const d = j && j.data;
  const arr = Array.isArray(d) ? d.flatMap(x => x.data || [x]) : (d && d.data) || [];
  return arr.filter(x => x.intensity).map(x => ({ from: +new Date(x.from), to: +new Date(x.to), v: x.intensity.forecast ?? x.intensity.actual, index: x.intensity.index }))
            .filter(x => x.v != null).sort((a, b) => a.from - b.from);
}
async function loadCarbonHistory(regionId, from, to){
  const out = [];
  for (let s = new Date(from); s < to; s = addDays(s, 13)){
    const e = new Date(Math.min(+addDays(s, 13), +to));
    const iso = d => d.toISOString().replace(/:\d\d\.\d+Z$/, 'Z');
    try { out.push(...parseCarbon(await request(`https://api.carbonintensity.org.uk/regional/intensity/${iso(s)}/${iso(e)}/regionid/${regionId}`))); } catch(err){}
  }
  return out.map(x => ({ from: x.from, to: x.to, p: x.v })).sort((a, b) => a.from - b.from);
}
async function loadWeather(){
  const j = await request(`https://api.open-meteo.com/v1/forecast?latitude=${HOME.lat}&longitude=${HOME.lon}&daily=temperature_2m_mean&past_days=92&forecast_days=7&timezone=Europe%2FLondon`);
  const map = new Map(), today = dayKey(Date.now());
  (j.daily?.time || []).forEach((k, i) => { const v = j.daily.temperature_2m_mean[i]; if (v != null) map.set(k, { t: v, forecast: k >= today }); });
  return map;
}
async function loadPVGIS(kwp, aspect, angle){
  if (!NET.proxy) throw new ApiError('NOPROXY');
  const j = await request(`./proxy/pvgis/v5_3/PVcalc?lat=${HOME.lat}&lon=${HOME.lon}&peakpower=${kwp}&loss=14&angle=${angle}&aspect=${aspect}&outputformat=json`);
  const m = j.outputs?.monthly?.fixed;
  if (!m || m.length !== 12) throw new ApiError('HTTP', 'PVGIS returned an unexpected answer.');
  return m.map(x => x.E_m / kwp);
}
async function searchEPC(postcode, token){
  if (!NET.proxy) throw new ApiError('NOPROXY');
  return request(`./proxy/epc/domestic/search?postcode=${encodeURIComponent(postcode)}`, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
}

function errorText(e){
  switch (e && e.code){
    case 'NETWORK': return ['No signal.', NET.proxy ? 'The home server helper couldn\'t reach the service. Check its internet connection.' : 'Your browser couldn\'t reach the service. If this keeps happening, run the page through the home server helper (see the Home tab).'];
    case 'AUTH': return ['Access was refused.', 'Check your Octopus API key. It starts with sk_live_ and the whole key is needed.'];
    case 'NOTFOUND': return ['Not found.', 'Check your account number. It looks like A-1234ABCD.'];
    case 'NOPROXY': return ['Needs the home server helper.', 'This service doesn\'t allow browsers to call it directly. Run server.py on your home server and open the page from there.'];
    default: return ['Something went wrong.', (e && e.message) || ''];
  }
}
