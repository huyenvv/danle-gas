/**
 * DataCache — stale-while-revalidate cache for GAS data.
 * Returns stale data immediately, revalidates in background.
 *
 * STALE_MS: how long data is "fresh" (no revalidation)
 * MAX_AGE_MS: max age before forced re-fetch even if consumer hasn't asked
 */
const STALE_MS   = 30_000   // 30 s
const MAX_AGE_MS = 300_000  // 5 min

import gasCall from '../gasClient.js'

class DataCache {
  constructor() {
    this._store = {}         // { key: { data, fetchedAt, version } }
    this._inflight = {}      // key → Promise
    this._listeners = {}     // key → Set<fn>
  }

  subscribe(key, fn) {
    if (!this._listeners[key]) this._listeners[key] = new Set()
    this._listeners[key].add(fn)
    return () => this._listeners[key].delete(fn)
  }

  _notify(key) {
    const subs = this._listeners[key]
    if (subs) subs.forEach(fn => fn(this._store[key]?.data))
  }

  set(key, data, version = null) {
    this._store[key] = { data, fetchedAt: Date.now(), version }
    this._notify(key)
  }

  get(key) {
    return this._store[key]?.data
  }

  isStale(key) {
    const entry = this._store[key]
    if (!entry) return true
    return (Date.now() - entry.fetchedAt) > STALE_MS
  }

  isTooOld(key) {
    const entry = this._store[key]
    if (!entry) return true
    return (Date.now() - entry.fetchedAt) > MAX_AGE_MS
  }

  invalidate(key) {
    delete this._store[key]
  }

  /**
   * Fetch with stale-while-revalidate.
   * Returns stale data instantly if available, triggers background revalidation.
   */
  async fetch(key, fetchFn, { forceRefresh = false } = {}) {
    const entry = this._store[key]

    // Return stale data immediately, schedule background revalidation
    if (entry && !forceRefresh && !this.isTooOld(key)) {
      if (this.isStale(key) && !this._inflight[key]) {
        this._revalidate(key, fetchFn)
      }
      return entry.data
    }

    // No data or too old — must wait for fresh data
    if (!this._inflight[key]) {
      this._inflight[key] = fetchFn()
        .then(data => { this.set(key, data); return data })
        .finally(() => delete this._inflight[key])
    }
    return this._inflight[key]
  }

  _revalidate(key, fetchFn) {
    this._inflight[key] = fetchFn()
      .then(data => { this.set(key, data) })
      .catch(() => {/* keep stale */})
      .finally(() => delete this._inflight[key])
  }
}

export const dataCache = new DataCache()

// Helper: fetch all lookup data
export async function prefetchLookups(token) {
  return dataCache.fetch('lookups', () => gasCall('api_getAllData', token))
}
