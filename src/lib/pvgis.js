/* PVGIS solar estimates, through the home server helper (it doesn't allow browser calls). */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
import { HOME } from './format.js';
import { ApiError, NET, request } from './net.js';

export async function loadPVGIS(kwp, aspect, angle){
  if (!NET.proxy) throw new ApiError('NOPROXY');
  const j = await request(`./proxy/pvgis/v5_3/PVcalc?lat=${HOME.lat}&lon=${HOME.lon}&peakpower=${kwp}&loss=14&angle=${angle}&aspect=${aspect}&outputformat=json`);
  const m = j.outputs && j.outputs.monthly && j.outputs.monthly.fixed;
  if (!m || m.length !== 12) throw new ApiError('HTTP', 'PVGIS returned an unexpected answer.');
  return m.map(x => x.E_m / kwp);
}
