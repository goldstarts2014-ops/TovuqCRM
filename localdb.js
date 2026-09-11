// Mahalliy baza: butun ma'lumot qurilma xotirasida (IndexedDB), JSON jadvallar ko'rinishida.
export const TABLES = ['users', 'drivers', 'product_categories', 'products', 'product_images', 'inventory', 'customers', 'debts', 'orders', 'order_items', 'deliveries', 'daily_closings', 'payments', 'debt_transactions', 'purchases', 'purchase_items', 'expense_categories', 'expenses'];
const KEYED = { inventory: 'product_id', debts: 'customer_id' }; // avtomatik id o'rniga tashqi kalit

const DB_NAME = 'tovuq-crm', STORE = 'kv', KEY = 'db';
let state = null;
let idb = null;
let saveTimer = null;
let dirty = false;

function openIdb() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return res(null);
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idbGet(key) { return new Promise((res, rej) => { if (!idb) return res(undefined); const t = idb.transaction(STORE, 'readonly').objectStore(STORE).get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
function idbPut(key, val) { return new Promise((res, rej) => { if (!idb) return res(); const t = idb.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }

export function emptyState() { const t = {}; for (const n of TABLES) t[n] = []; return { v: 1, seq: {}, t }; }

export async function loadDb() {
  if (state) return state;
  try { idb = await openIdb(); } catch { idb = null; }
  let s = null;
  try { s = await idbGet(KEY); } catch {}
  if (!s) { try { const raw = localStorage.getItem('tovuq_db_backup'); if (raw) s = JSON.parse(raw); } catch {} }
  state = s && s.t ? s : emptyState();
  for (const n of TABLES) if (!state.t[n]) state.t[n] = [];
  await loadBlobs();
  return state;
}
export function getState() { return state; }
export function replaceState(s) { state = s; for (const n of TABLES) if (!state.t[n]) state.t[n] = []; markDirty(); return flush(); }

// Rasmlar alohida saqlanadi (katta data-URL'lar tranzaksiya nusxasiga kirmasin)
let blobs = {}; let blobsDirty = false;
export async function loadBlobs() { try { blobs = (await idbGet('blobs')) || {}; } catch { blobs = {}; } return blobs; }
export function putBlob(key, dataUrl) { blobs[key] = dataUrl; blobsDirty = true; markDirty(); }
export function getBlob(key) { return blobs[key]; }
export function allBlobs() { return blobs; }
export function replaceBlobs(b) { blobs = b || {}; blobsDirty = true; markDirty(); }
export const resolveImg = (url) => (url && url.startsWith('img:') ? blobs[url] || 'img/products/default.svg' : url ? url.replace(/^\//, '') : url);

export function markDirty() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 250); }
export async function flush() {
  if (!dirty || !state) return;
  dirty = false;
  try { await idbPut(KEY, state); if (blobsDirty) { await idbPut('blobs', blobs); blobsDirty = false; } } catch (e) { console.error('Saqlashda xato', e); }
  try { if (!idb) localStorage.setItem('tovuq_db_backup', JSON.stringify(state)); } catch {}
}
if (typeof window !== 'undefined') { window.addEventListener('pagehide', () => { if (dirty) { clearTimeout(saveTimer); flush(); } }); document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) { clearTimeout(saveTimer); flush(); } }); }

// ---- jadval amallari ----
export const nowIso = () => new Date().toISOString();
export function today(offsetDays = 0) { const d = new Date(Date.now() + offsetDays * 86400000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const T = (name) => state.t[name];
export function nextId(name) { state.seq[name] = (state.seq[name] || Math.max(0, ...state.t[name].map((r) => r.id || 0))) + 1; return state.seq[name]; }
export function insert(name, row) {
  const r = { ...row };
  if (!KEYED[name]) r.id = nextId(name);
  if (r.created_at === undefined) r.created_at = nowIso();
  for (const k of Object.keys(r)) if (r[k] === undefined) r[k] = null;
  state.t[name].push(r); markDirty(); return r;
}
export function get(name, id) { const k = KEYED[name] || 'id'; return state.t[name].find((r) => r[k] === Number(id)) || null; }
export function update(name, id, patch) { const r = get(name, id); if (!r) return null; Object.assign(r, patch); markDirty(); return r; }
export function remove(name, id) { const k = KEYED[name] || 'id'; const i = state.t[name].findIndex((r) => r[k] === Number(id)); if (i >= 0) { state.t[name].splice(i, 1); markDirty(); } }
export function where(name, pred) { return state.t[name].filter(pred); }
export const byId = (name) => { const k = KEYED[name] || 'id'; const m = new Map(); for (const r of state.t[name]) m.set(r[k], r); return m; };
export const sum = (rows, f) => round2(rows.reduce((s, r) => s + (Number(typeof f === 'function' ? f(r) : r[f]) || 0), 0));
export const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);

// Tranzaksiya: xato bo'lsa holatni qaytarish
export function transaction(fn) {
  const snapshot = JSON.stringify(state);
  try { const r = fn(); markDirty(); return r; }
  catch (e) { state = JSON.parse(snapshot); throw e; }
}

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
