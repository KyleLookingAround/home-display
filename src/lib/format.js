/* Constants, dates and formatting, shared by the dashboard and the display. Money is in pence; rates are p/kWh including VAT. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.

export const REGIONS = {A:'Eastern England',B:'East Midlands',C:'London',D:'Merseyside & North Wales',E:'West Midlands',F:'North East England',G:'North West England',H:'Southern England',J:'South East England',K:'South Wales',L:'South West England',M:'Yorkshire',N:'South Scotland',P:'North Scotland'};
// Octopus region letter -> Carbon Intensity API region id
export const CI_REGION = {A:10,B:9,C:13,D:6,E:8,F:4,G:3,H:12,J:14,K:7,L:11,M:5,N:2,P:1};
export const GAS_M3_TO_KWH = 1.02264 * 39.5 / 3.6;
export const CO2_ELEC_FALLBACK = 0.2;   // kg/kWh, used when regional intensity is unavailable
export const CO2_GAS = 0.183;           // kg/kWh, UK government conversion factor for natural gas (approx.)
export const HOME = { lat: 53.41, lon: -2.16 }; // Stockport
// Long-term monthly mean temperatures near Manchester (°C), approximate
export const TEMP_NORMALS = [4.6,4.8,6.6,8.9,12.0,14.8,16.6,16.3,14.0,10.8,7.3,4.9];
// Rough solar yield near Manchester, kWh per kWp per month, panels at ~35°. Used when PVGIS can't be reached.
export const SOLAR_SOUTH = [24,42,74,104,122,118,117,101,81,54,29,19];
export const SOLAR_NORTH = [6,13,32,60,82,88,84,66,40,19,8,5];
export const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const DAYS_IN_MONTH = m => new Date(2027, m + 1, 0).getDate();

export const pad2 = n => String(n).padStart(2, '0');
export const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
export const keyDate = k => new Date(`${k}T00:00:00`);
export const slotOf = t => { const d = new Date(t); return d.getHours()*2 + (d.getMinutes() >= 30 ? 1 : 0); };
export const hhmm = t => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export const slotLabel = i => `${pad2(Math.floor((i % 48)/2))}:${i % 2 ? '30' : '00'}`;
export const fmtDate = d => `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
export const shortDate = d => `${d.getDate()} ${MON[d.getMonth()]}`;
export const longDate = d => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
/** A date as the UK writes it, 05/10/2026, from a Date or a 'YYYY-MM-DD' key. */
export const ukDate = d => { const x = typeof d === 'string' ? keyDate(d) : d; return isNaN(+x) ? '' : `${pad2(x.getDate())}/${pad2(x.getMonth()+1)}/${x.getFullYear()}`; };
/** Day first, always: '5/10/2026', '05-10-26', '5.10.2026' or '5 10 2026' to '2026-10-05'; null if it isn't a real date. */
export function parseUkDate(s){
  const m = /^\s*(\d{1,2})[\/.\- ]+(\d{1,2})[\/.\- ]+(\d{2}|\d{4})\s*$/.exec(String(s || ''));
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3], mo = +m[2], d = +m[1], x = new Date(y, mo - 1, d);
  return x.getFullYear() === y && x.getMonth() === mo - 1 && x.getDate() === d ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
}
export const gbp = p => (p < 0 ? '−' : '') + '£' + Math.abs(p/100).toFixed(2);   // pence in, pounds out
export const gbp0 = p => (p < 0 ? '−' : '') + '£' + Math.round(Math.abs(p/100)).toLocaleString('en-GB');
export const kwh = v => `${v.toFixed(v >= 100 ? 0 : 1)} kWh`;
export const pence = p => `${Math.abs(p) < 10 ? p.toFixed(2) : p.toFixed(1)}p`;
export const kg = v => v >= 1000 ? `${(v/1000).toFixed(2)} t` : `${v.toFixed(v >= 100 ? 0 : 1)} kg`;
export const pct = v => `${Math.round(v*100)}%`;
export const fmtTick = v => { const r = Math.round(v*100)/100; return Math.abs(r) >= 10 ? String(Math.round(r)) : String(r); };
export const sum = a => a.reduce((x, y) => x + y, 0);
export const median = a => { if (!a.length) return 0; const s = a.slice().sort((x,y)=>x-y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Nullish default, written out: shared code also runs on TV browsers older than Chromium 80.
export const nz = (v, d) => v == null ? d : v;

export function niceStep(x){ if (!(x > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))); const n = x/p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
export function niceScale(min, max, n = 4){ if (!(max > min)) max = min + 1; const step = niceStep((max-min)/n); return { lo: Math.floor(min/step)*step, hi: Math.ceil(max/step)*step, step }; }
