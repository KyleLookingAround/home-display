/* Browser helpers: element lookups, and per-device storage (keys prefixed hse.). */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.

export const $ = sel => document.querySelector(sel);
export const $$ = sel => [...document.querySelectorAll(sel)];
/* Per-device storage. The dashboard and the display share it, so a key entered on one works on the other. */
export const store = {
  get(k){ try { return localStorage.getItem('hse.' + k); } catch(e){ return null; } },
  set(k, v){ try { localStorage.setItem('hse.' + k, v); } catch(e){} },
  del(k){ try { localStorage.removeItem('hse.' + k); } catch(e){} },
  getJ(k, d){ try { const v = localStorage.getItem('hse.' + k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  setJ(k, v){ try { localStorage.setItem('hse.' + k, JSON.stringify(v)); } catch(e){} }
};
