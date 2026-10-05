/* National Grid's carbon intensity: the regional forecast and history. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
import { addDays, nz } from './format.js';
import { request } from './net.js';

/* ---------- other services ---------- */
export async function loadCarbonForecast(regionId){
  const from = new Date(Math.floor(Date.now() / 1800e3) * 1800e3).toISOString().replace(/:\d\d\.\d+Z$/, 'Z');
  const j = await request(`https://api.carbonintensity.org.uk/regional/intensity/${from}/fw48h/regionid/${regionId}`, { headers: { Accept: 'application/json' } });
  return parseCarbon(j);
}
export function parseCarbon(j){
  const d = j && j.data;
  const arr = Array.isArray(d) ? d.reduce((a, x) => a.concat(x.data || [x]), []) : (d && d.data) || [];
  return arr.filter(x => x.intensity).map(x => ({ from: +new Date(x.from), to: +new Date(x.to), v: nz(x.intensity.forecast, x.intensity.actual), index: x.intensity.index }))
            .filter(x => x.v != null).sort((a, b) => a.from - b.from);
}
export async function loadCarbonHistory(regionId, from, to){
  const out = [];
  for (let s = new Date(from); s < to; s = addDays(s, 13)){
    const e = new Date(Math.min(+addDays(s, 13), +to));
    const iso = d => d.toISOString().replace(/:\d\d\.\d+Z$/, 'Z');
    try { out.push(...parseCarbon(await request(`https://api.carbonintensity.org.uk/regional/intensity/${iso(s)}/${iso(e)}/regionid/${regionId}`))); } catch(err){}
  }
  return out.map(x => ({ from: x.from, to: x.to, p: x.v })).sort((a, b) => a.from - b.from);
}
