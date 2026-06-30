import type { DataStore, Collection, DomainRecord, Query, Page } from './ports/data-store'
import type { Cache } from './ports/cache'

const CACHE_TTL = 600  // 10 phút cho data

export class CachingDataStore implements DataStore {
  constructor(private inner: DataStore, private cache: Cache) {}

  private dataKey(collection: Collection): string { return `data_${collection}` }

  private invalidate(collection: Collection): void {
    this.cache.remove(this.dataKey(collection))
  }

  getAll(collection: Collection): DomainRecord[] {
    const cached = this.cache.get<DomainRecord[]>(this.dataKey(collection))
    if (cached !== null) return cached
    const data = this.inner.getAll(collection)
    this.cache.put(this.dataKey(collection), data, CACHE_TTL)
    return data
  }

  insert(collection: Collection, rec: DomainRecord): DomainRecord {
    const result = this.inner.insert(collection, rec)
    this.invalidate(collection)
    return result
  }

  update(collection: Collection, id: string | number, fields: DomainRecord): void {
    this.inner.update(collection, id, fields)
    this.invalidate(collection)
  }

  remove(collection: Collection, id: string | number): void {
    this.inner.remove(collection, id)
    this.invalidate(collection)
  }

  // Queries are parameterized — caching out of scope for now. Delegate straight to inner.
  find(collection: Collection, query: Query): Page {
    return this.inner.find(collection, query)
  }
}
