import { useState, useEffect, useRef, useCallback } from 'react'
import { cache, persistentCache } from '../utils/cache.js'

// Stale-while-revalidate hook.
//   - Returns cached value immediately (no loading flash on revisit).
//   - Fires `fetcher` in the background and updates state when fresh data arrives.
//   - Optional `refreshInterval` keeps data live while the component is mounted.
//
// `key` is a stable string. If `key` changes, the cached entry for the OLD key
// stays in storage (still valid until TTL) — that's intentional so navigating
// back is instant.
export function useCachedFetch(key, fetcher, options = {}) {
  const {
    ttl = 60_000,
    persistent = false,
    refreshInterval = 0,
    enabled = true,
  } = options
  const store = persistent ? persistentCache : cache

  const [data, setData] = useState(() => (enabled ? store.get(key) : null))
  const [loading, setLoading] = useState(() => enabled && store.get(key) == null)
  const [error, setError] = useState(null)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const fresh = await fetcherRef.current()
      if (fresh !== undefined && fresh !== null) {
        setData(fresh)
        store.set(key, fresh, ttl)
      }
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [key, ttl, enabled, store])

  useEffect(() => {
    if (!enabled) return
    // Show cached immediately if any, then refresh in background.
    const cached = store.get(key)
    if (cached != null) {
      setData(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    refresh()
    if (refreshInterval > 0) {
      const id = setInterval(refresh, refreshInterval)
      return () => clearInterval(id)
    }
  }, [key, enabled, refresh, refreshInterval, store])

  return { data, loading, error, refresh, setData }
}
