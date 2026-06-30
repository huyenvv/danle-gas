// gas-cache: Cache port implementation over GAS CacheService.
// Ported from v1 src/server/core/cache.js (CacheService wrapper).
// Simplification note: v1 had chunk-splitting for values >20 000 chars.
// SP0 values (label lists) are small (<1 KB), so we skip chunking here.
// If large payloads arise in future, re-add chunking from v1 cache.js.

import type { Cache } from '../../core/ports/cache'

const DEFAULT_TTL = 600 // 10 min

export function createGasCache(): Cache {
  const scriptCache = CacheService.getScriptCache()
  return {
    get<T = unknown>(key: string): T | null {
      const raw = scriptCache.get(key)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as T
      } catch {
        return raw as unknown as T
      }
    },
    put<T = unknown>(key: string, value: T, ttlSeconds?: number): void {
      const ttl = ttlSeconds ?? DEFAULT_TTL
      try {
        scriptCache.put(key, JSON.stringify(value), ttl)
      } catch (e) {
        // GAS may throw if value is too large; log and skip
        if (typeof Logger !== 'undefined') {
          Logger.log('gas-cache put skip ' + key + ': ' + String(e))
        }
      }
    },
    remove(key: string): void {
      scriptCache.remove(key)
    },
  }
}
