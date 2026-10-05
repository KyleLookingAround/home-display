/* The EPC register's search, through the home server helper. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
import { ApiError, NET, request } from './net.js';

export async function searchEPC(postcode, token){
  if (!NET.proxy) throw new ApiError('NOPROXY');
  return request(`./proxy/epc/domestic/search?postcode=${encodeURIComponent(postcode)}`, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
}
