/**
 * Key/value cache port used by {@link CachingDataStore} to wrap a slow
 * {@link DataStore} with an in-memory (or GAS CacheService) backing store.
 *
 * Implementations must be safe to inject in tests (e.g. a plain `Map`).
 */
export interface Cache {
  /**
   * Retrieve a cached value by key.
   *
   * @param key Cache key (must be a non-empty string).
   * @returns The cached value cast to `T`, or `null` on a cache miss.
   */
  get<T = unknown>(key: string): T | null

  /**
   * Store a value under the given key.
   *
   * @param key        Cache key.
   * @param value      Value to store. Must be JSON-serialisable for
   *                   GAS CacheService-backed implementations.
   * @param ttlSeconds Optional time-to-live in **seconds**. When omitted the
   *                   implementation may use a default TTL or keep the entry
   *                   indefinitely.
   */
  put<T = unknown>(key: string, value: T, ttlSeconds?: number): void

  /**
   * Evict a single entry from the cache.
   *
   * No-op if the key does not exist.
   *
   * @param key Cache key to evict.
   */
  remove(key: string): void
}
