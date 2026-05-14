// Browser cache helpers.
//   - `cache` (sessionStorage): short-lived, per-tab.
//   - `persistentCache` (localStorage): survives reloads / new tabs.
// Both store { value, expiry } with a TTL. On QuotaExceeded we clear ourselves
// and retry — never poison the user's storage with stale wm_* keys.

const PREFIX = 'wm_'

function safeGet(storage, key) {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.expiry && Date.now() > parsed.expiry) {
      storage.removeItem(key)
      return null
    }
    return parsed.value
  } catch {
    return null
  }
}

function safeSet(storage, key, value, ttlMs) {
  const payload = JSON.stringify({
    value,
    expiry: ttlMs ? Date.now() + ttlMs : null,
  })
  try {
    storage.setItem(key, payload)
  } catch {
    // Quota — drop wm_* keys then retry once
    try {
      Object.keys(storage).forEach(k => { if (k.startsWith(PREFIX)) storage.removeItem(k) })
      storage.setItem(key, payload)
    } catch { /* give up silently */ }
  }
}

function makeCache(storage) {
  return {
    get(key) { return safeGet(storage, PREFIX + key) },
    set(key, value, ttlMs) { safeSet(storage, PREFIX + key, value, ttlMs) },
    remove(key) { try { storage.removeItem(PREFIX + key) } catch {} },
    invalidate(prefix) {
      // Drop every wm_<prefix>* key
      const target = PREFIX + prefix
      try {
        Object.keys(storage).filter(k => k.startsWith(target)).forEach(k => storage.removeItem(k))
      } catch {}
    },
  }
}

export const cache = makeCache(typeof sessionStorage !== 'undefined' ? sessionStorage : new Map())
export const persistentCache = makeCache(typeof localStorage !== 'undefined' ? localStorage : new Map())
