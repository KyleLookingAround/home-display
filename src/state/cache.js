/*
 * A small IndexedDB cache, so moving between the dashboard's pages doesn't fetch the account again. IndexedDB keeps
 * Maps and Infinity as they are (JSON wouldn't). Everything fails quietly: without it, pages just fetch afresh.
 */
const DB = 'hse-dashboard', STORE = 'cache';
let dbp = null;
function db(){
  if (!dbp) dbp = new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  return dbp;
}
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((ok, no) => { const t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE)); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); });
};
/** The value saved under key, if it was saved within maxAge milliseconds: { value, at }. */
export async function cacheGet(key, maxAge = Infinity){
  try { const v = await tx('readonly', s => s.get(key)); return v && Date.now() - v.at < maxAge ? v : null; } catch { return null; }
}
export async function cacheSet(key, value){ try { await tx('readwrite', s => s.put({ value, at: Date.now() }, key)); } catch {} }
export async function cacheClear(){ try { await tx('readwrite', s => s.clear()); } catch {} }
