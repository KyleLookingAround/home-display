/* The network layer: requests, the home server helper, and errors in plain words. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.

/* ---------- network ---------- */
export class ApiError extends Error { constructor(code, msg){ super(msg || code); this.code = code; } }
export const NET = { proxy: false, creds: null, token: null, tokenAt: 0, keys: {} };

export async function request(url, opts = {}){
  let res;
  try { res = await fetch(url, opts); }
  catch(e){ throw new ApiError('NETWORK'); }
  if (res.status === 401 || res.status === 403) throw new ApiError('AUTH');
  if (res.status === 404) throw new ApiError('NOTFOUND');
  if (res.status === 502 || res.status === 504) throw new ApiError('NETWORK');
  if (!res.ok) throw new ApiError('HTTP', `The service returned an error (${res.status}).`);
  return res.json();
}
export async function detectProxy(){
  if (location.protocol === 'file:') return false;
  try { const r = await fetch('./proxy/ping', { cache: 'no-store' }); NET.proxy = r.ok && (await r.text()).trim() === 'ok'; }
  catch(e){ NET.proxy = false; }
  if (NET.proxy){
    // Which service keys the helper holds (trains, trams). Older helpers don't answer this.
    try { const r = await fetch('./proxy/status', { cache: 'no-store' }); if (r.ok) NET.keys = (await r.json()).keys || {}; } catch(e){}
  }
  return NET.proxy;
}

export function errorText(e){
  switch (e && e.code){
    case 'NETWORK': return ['No signal.', NET.proxy ? 'The home server helper couldn\'t reach the service. Check its internet connection.' : 'Your browser couldn\'t reach the service. If this keeps happening, run the page through the home server helper (see the Home tab).'];
    case 'AUTH': return ['Access was refused.', 'Check your Octopus API key. It starts with sk_live_ and the whole key is needed.'];
    case 'NOTFOUND': return ['Not found.', 'Check your account number. It looks like A-1234ABCD.'];
    case 'NOPROXY': return ['Needs the home server helper.', 'This service doesn\'t allow browsers to call it directly. Run server.py on your home server and open the page from there.'];
    default: return ['Something went wrong.', (e && e.message) || ''];
  }
}
