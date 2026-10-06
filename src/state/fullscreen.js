/*
 * Full screen on a phone: the browser's bars hidden, the app edge to edge. Browsers end full screen whenever a page
 * changes, and every tab here is its own page, so once you've chosen it (hse.fullscreen) each new page goes back to
 * full screen at your first tap. iPhones can't do full screen in Safari at all; there, the answer is Add to Home
 * Screen, which opens the app with no bars (manifest.webmanifest, "standalone").
 */
import { store } from '../lib/browser.js';

const doc = () => document;
export const canFull = () => !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
export const isFull = () => !!(doc().fullscreenElement || doc().webkitFullscreenElement);
/** Opened from the home screen, where there are no bars to hide. */
export const isApp = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e){ return false; } };
export const wantsFull = () => store.get('fullscreen') === '1';
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function enter(){
  const el = doc().documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return Promise.resolve(false);
  try { const p = req.call(el, { navigationUI: 'hide' }); return Promise.resolve(p).then(() => true, () => false); }
  catch (e){ return Promise.resolve(false); }
}
export function exit(){
  const f = doc().exitFullscreen || doc().webkitExitFullscreen;
  try { if (f && isFull()) return Promise.resolve(f.call(doc())).catch(() => {}); } catch (e){}
  return Promise.resolve();
}
/** The button: on goes full screen and remembers it; off leaves and forgets. */
export async function toggleFull(){
  if (isFull()){ store.set('fullscreen', '0'); await exit(); return false; }
  const ok = await enter();
  store.set('fullscreen', ok ? '1' : '0');
  return ok;
}

let leaving = false, watching = false;
/**
 * Once per page: when full screen was chosen, the first tap or key on this page goes back into it. Leaving full
 * screen yourself (Back, or a swipe) forgets the choice; leaving because the page changed doesn't.
 */
export function keepFull(onChange){
  if (watching || typeof document === 'undefined') return;
  watching = true;
  addEventListener('pagehide', () => { leaving = true; });
  addEventListener('beforeunload', () => { leaving = true; });
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href]'); if (a && !a.target && a.origin === location.origin && !/^#/.test(a.getAttribute('href'))) leaving = true; }, true);
  const changed = () => {
    if (!isFull() && !leaving && document.visibilityState === 'visible' && wantsFull()) store.set('fullscreen', '0');
    if (onChange) onChange(isFull());
  };
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);
  if (!wantsFull() || !canFull() || isFull() || isApp()) return;
  const again = () => {
    document.removeEventListener('click', again, true); document.removeEventListener('keydown', again, true);
    if (wantsFull() && !isFull() && !leaving) enter();
  };
  document.addEventListener('click', again, true);
  document.addEventListener('keydown', again, true);
}
