/*
 * Opens the phone pages straight away and with no signal. Pages and household.json come from the network when it
 * answers within a few seconds (so changes arrive), and from the copy kept here when it doesn't. Scripts, styles,
 * icons and fonts, whose names change when they do, come from the copy first. Readings and prices aren't touched:
 * the pages keep those in IndexedDB themselves. Lives next to the pages, so /preview/ keeps its own.
 */
const CACHE = 'hse-pages-v1', MAX = 150;
const PAGES = ['./', 'index.html', 'money.html', 'usage.html', 'home.html', 'screen.html', 'settings.html', 'household.json', 'manifest.webmanifest', 'icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(PAGES.map(p => c.add(p).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.indexOf('hse-pages-') === 0 && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
function keep(req, res){
  if (!res || !(res.ok || res.type === 'opaque')) return res;
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(req, copy).then(() => c.keys()).then(keys => { if (keys.length > MAX) return Promise.all(keys.slice(0, keys.length - MAX).map(k => c.delete(k))); })).catch(() => {});
  return res;
}
function networkFirst(req){
  const net = fetch(req).then(res => keep(req, res));
  const late = new Promise(r => setTimeout(r, 4000)).then(() => caches.match(req, { ignoreSearch: true }));
  return Promise.race([net.catch(() => null), late]).then(res => res || net.catch(() => caches.match(req, { ignoreSearch: true })))
    .then(res => res || caches.match(req, { ignoreSearch: true })).then(res => res || Response.error());
}
function cacheFirst(req){
  return caches.match(req).then(hit => hit || fetch(req).then(res => keep(req, res)));
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url), same = url.origin === self.location.origin;
  if (FONTS.test(req.url)) return e.respondWith(cacheFirst(req));
  if (!same || url.pathname.indexOf('/proxy/') >= 0 || /\/sw\.js$/.test(url.pathname)) return;
  if (req.mode === 'navigate' || /\.(html|json|webmanifest)$/.test(url.pathname) || /\/$/.test(url.pathname)) return e.respondWith(networkFirst(req));
  e.respondWith(cacheFirst(req));
});
