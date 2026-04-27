// Persistent email-body cache backed by IndexedDB. Survives page reload,
// so re-opening an email you've seen before is ~instant instead of a
// network round-trip. Falls back to in-memory only if IndexedDB is
// unavailable (private browsing, old Safari, etc.) — never throws.
//
// Shape: key = `${accountId}:${messageId}` → { body, headers, attachments, ts }
// TTL: 7 days. We rely on backend Gmail truth to refresh stale bodies.
//
// Stale-while-revalidate is enforced by the caller — it should call get()
// to render immediately, then trigger the network fetch and call set()
// when fresh data arrives.

const DB_NAME = 'atm_email_cache';
const DB_VERSION = 1;
const STORE = 'bodies';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 2000;

let _dbPromise = null;
let _idbAvailable = typeof indexedDB !== 'undefined';
const _memFallback = new Map();

function openDb() {
  if (!_idbAvailable) return Promise.resolve(null);
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('ts', 'ts', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { _idbAvailable = false; resolve(null); };
    } catch {
      _idbAvailable = false;
      resolve(null);
    }
  });
  return _dbPromise;
}

function makeKey(accountId, messageId) { return `${accountId || ''}:${messageId}`; }

export async function getCached(accountId, messageId) {
  const key = makeKey(accountId, messageId);
  if (_memFallback.has(key)) {
    const entry = _memFallback.get(key);
    if (Date.now() - entry.ts < TTL_MS) return entry;
  }
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        if (!v || Date.now() - v.ts >= TTL_MS) return resolve(null);
        resolve(v);
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function setCached(accountId, messageId, body, headers, attachments) {
  if (!body) return;
  const key = makeKey(accountId, messageId);
  const entry = { key, accountId, messageId, body, headers: headers || null, attachments: attachments || [], ts: Date.now() };
  _memFallback.set(key, entry);
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
  } catch { /* ignore */ }
}

// Bulk write — used by the batch-prefetch path so we don't open one
// transaction per body when we just got 25-200 of them at once.
export async function setManyCached(items) {
  if (!items?.length) return;
  for (const it of items) {
    if (it?.body && it?.messageId) {
      _memFallback.set(makeKey(it.accountId, it.messageId), { ...it, ts: Date.now() });
    }
  }
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const it of items) {
      if (!it?.body || !it?.messageId) continue;
      store.put({ key: makeKey(it.accountId, it.messageId), accountId: it.accountId, messageId: it.messageId, body: it.body, headers: it.headers || null, attachments: it.attachments || [], ts: Date.now() });
    }
  } catch { /* ignore */ }
}

// Hydrate cached bodies for a list of messageIds. Returns three maps the
// caller can merge into React state. Skips entries that miss or are stale.
export async function hydrateForIds(ids) {
  const bodies = {}, headers = {}, attachments = {};
  if (!ids?.length) return { bodies, headers, attachments };
  const db = await openDb();
  // No DB → in-memory only
  if (!db) {
    for (const { accountId, messageId } of ids) {
      const e = _memFallback.get(makeKey(accountId, messageId));
      if (e && Date.now() - e.ts < TTL_MS) {
        bodies[messageId] = e.body;
        if (e.headers) headers[messageId] = e.headers;
        if (e.attachments) attachments[messageId] = e.attachments;
      }
    }
    return { bodies, headers, attachments };
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      let pending = ids.length;
      if (!pending) return resolve({ bodies, headers, attachments });
      const now = Date.now();
      for (const { accountId, messageId } of ids) {
        const r = store.get(makeKey(accountId, messageId));
        r.onsuccess = () => {
          const v = r.result;
          if (v && now - v.ts < TTL_MS) {
            bodies[messageId] = v.body;
            if (v.headers) headers[messageId] = v.headers;
            if (v.attachments) attachments[messageId] = v.attachments;
          }
          if (--pending === 0) resolve({ bodies, headers, attachments });
        };
        r.onerror = () => { if (--pending === 0) resolve({ bodies, headers, attachments }); };
      }
    } catch { resolve({ bodies, headers, attachments }); }
  });
}

// Cap-and-evict — run occasionally so the store doesn't grow unbounded.
// Removes oldest entries (by ts) past MAX_ENTRIES. Best-effort, never throws.
export async function maybeEvict() {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const total = countReq.result;
      if (total <= MAX_ENTRIES) return;
      const toRemove = total - MAX_ENTRIES;
      const idx = store.index('ts');
      let removed = 0;
      const cursorReq = idx.openCursor();
      cursorReq.onsuccess = (e) => {
        const cur = e.target.result;
        if (!cur || removed >= toRemove) return;
        cur.delete();
        removed++;
        cur.continue();
      };
    };
  } catch { /* ignore */ }
}
