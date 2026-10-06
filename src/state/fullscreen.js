/*
 * Full screen on a phone, across every page, so the site feels like an app. Browsers leave full screen whenever the
 * page changes, and every tab here is its own page; so going full screen opens the site inside the full-screen page
 * (an "app shell": one frame filling the screen) and the tabs change inside it, while the page underneath rests.
 * Leaving full screen, by the button or by the phone's Back, opens the page you were on as itself. Once chosen
 * (hse.fullscreen), a fresh visit goes back to it at the first tap. iPhones can't do full screen in Safari at all;
 * there, the answer is Add to Home Screen, which opens the app with no bars (manifest.webmanifest, "standalone").
 */
import { store } from '../lib/browser.js';

const doc = () => document;
/** This page is inside the shell, rather than the page holding it. */
export function inShell(){ try { return window.self !== window.top && !!window.top.__hseShell; } catch (e){ return false; } }
const topDoc = () => (inShell() ? window.top.document : document);
export const canFull = () => { const d = topDoc(); return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled); };
export const isFull = () => { const d = topDoc(); return !!(d.fullscreenElement || d.webkitFullscreenElement); };
/** Opened from the home screen, where there are no bars to hide. */
export const isApp = () => {
  if (inShell() || isFull()) return false;           // full screen by the button counts as display-mode: fullscreen too
  try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e){ return false; }
};
export const wantsFull = () => store.get('fullscreen') === '1';
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function enter(){
  if (inShell()) return true;
  const el = doc().documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return false;
  try { await Promise.resolve(req.call(el, { navigationUI: 'hide' })); } catch (e){ return false; }
  openShell();
  return true;
}
export function exit(){
  const d = topDoc(), f = d.exitFullscreen || d.webkitExitFullscreen;
  try { if (f && isFull()) return Promise.resolve(f.call(d)).catch(() => {}); } catch (e){}
  return Promise.resolve();
}
/** The button: on goes full screen and remembers it; off leaves and forgets. */
export async function toggleFull(){
  if (isFull()){ store.set('fullscreen', '0'); await exit(); return false; }
  const ok = await enter();
  store.set('fullscreen', ok ? '1' : '0');
  return ok;
}

/* ---------- the app shell: the site in one frame filling the full-screen page ---------- */
function openShell(){
  if (window.__hseShell) return;
  window.__hseShell = true;
  const f = doc().createElement('iframe');
  f.id = 'app-shell'; f.title = doc().title; f.src = location.href;
  f.setAttribute('allow', 'fullscreen; clipboard-write; screen-wake-lock; web-share');
  f.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;border:0;margin:0;z-index:2147483647;background:#04050d';
  doc().body.appendChild(f);
  // The page underneath rests: everything that polls (prices, Spotify, the house) waits while the page is hidden,
  // and the starfield rests while the "cockpit" covers it.
  try {
    Object.defineProperty(doc(), 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(doc(), 'visibilityState', { configurable: true, get: () => 'hidden' });
  } catch (e){}
  doc().dispatchEvent(new Event('visibilitychange'));
  doc().body.classList.add('cockpit');
  doc().documentElement.classList.add('shelled');
  f.addEventListener('load', () => { try { doc().title = f.contentWindow.document.title; } catch (e){} });
}
/** Leaving full screen: the page you were on in the shell, opened as itself. */
function closeShell(){
  const f = doc().getElementById('app-shell');
  let url = location.href;
  try { url = f.contentWindow.location.href; } catch (e){}
  location.replace(url);
}

let watching = false;
/**
 * Once per page. On the page holding the shell, leaving full screen any way closes the shell (and Back or a swipe
 * forgets the choice, as the button does). On a fresh visit with full screen chosen, the first tap or key goes
 * back into it.
 */
export function keepFull(onChange){
  if (watching || typeof document === 'undefined') return;
  watching = true;
  if (inShell()){ if (onChange) onChange(true); return; }
  const changed = () => {
    if (!isFull() && window.__hseShell){ store.set('fullscreen', '0'); closeShell(); return; }
    if (onChange) onChange(isFull());
  };
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);
  if (!wantsFull() || !canFull() || isFull() || isApp()) return;
  const again = e => {
    if (e.target && e.target.closest && e.target.closest('.fs')) return;           // the button itself decides
    document.removeEventListener('click', again, true); document.removeEventListener('keydown', again, true);
    if (wantsFull() && !isFull()) enter().then(ok => { if (onChange) onChange(ok); });
  };
  document.addEventListener('click', again, true);
  document.addEventListener('keydown', again, true);
}
