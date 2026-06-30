import type { DataStore, Collection, DomainRecord } from '../src/core/ports/data-store'
import type { Cache } from '../src/core/ports/cache'
import { CachingDataStore } from '../src/core/caching-data-store'

// Fake inner DataStore that counts calls
function makeFakeInner(data: DomainRecord[] = []): DataStore & { calls: Record<string, number> } {
  const calls: Record<string, number> = {
    getAll: 0, insert: 0, update: 0, remove: 0, find: 0,
  }
  let store = [...data]
  let nextId = store.length + 1
  return {
    calls,
    getAll(_collection: Collection) { calls.getAll++; return [...store] },
    insert(_collection: Collection, rec: DomainRecord) {
      calls.insert++
      const r = { ...rec, id: nextId++ }
      store.push(r)
      return r
    },
    update(_collection: Collection, id: string | number, fields: DomainRecord) {
      calls.update++
      const idx = store.findIndex(r => String(r.id) === String(id))
      if (idx === -1) throw new Error('Không tìm thấy bản ghi ID: ' + id)
      store[idx] = { ...store[idx], ...fields }
    },
    remove(_collection: Collection, id: string | number) {
      calls.remove++
      const idx = store.findIndex(r => String(r.id) === String(id))
      if (idx === -1) throw new Error('Không tìm thấy bản ghi ID: ' + id)
      store.splice(idx, 1)
    },
    find(_collection: Collection, _query: import('../src/core/ports/data-store').Query) {
      calls.find++
      return { rows: [], total: 0 }
    },
  }
}

// Fake in-memory Cache
function makeFakeCache(): Cache & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  return {
    store,
    get<T = unknown>(key: string): T | null {
      return store.has(key) ? (store.get(key) as T) : null
    },
    put<T = unknown>(key: string, value: T, _ttlSeconds?: number): void {
      store.set(key, value)
    },
    remove(key: string): void {
      store.delete(key)
    },
  }
}

const C: Collection = 'labels'

describe('CachingDataStore', () => {
  test('getAll lần 2 không gọi inner (cache hit)', () => {
    const inner = makeFakeInner([{ id: 1, name: 'A' }])
    const cache = makeFakeCache()
    const ds = new CachingDataStore(inner, cache)

    const first = ds.getAll(C)
    const second = ds.getAll(C)

    expect(first).toEqual([{ id: 1, name: 'A' }])
    expect(second).toEqual(first)
    expect(inner.calls.getAll).toBe(1) // inner gọi 1 lần, lần 2 dùng cache
  })

  test('getAll sau insert gọi lại inner (cache invalidated)', () => {
    const inner = makeFakeInner([{ id: 1, name: 'A' }])
    const cache = makeFakeCache()
    const ds = new CachingDataStore(inner, cache)

    ds.getAll(C) // lần 1 → cache data
    ds.insert(C, { name: 'B' }) // invalidate
    ds.getAll(C) // lần 2 → phải gọi inner lại

    expect(inner.calls.getAll).toBe(2)
  })

  test('insert trả kết quả từ inner', () => {
    const inner = makeFakeInner()
    const cache = makeFakeCache()
    const ds = new CachingDataStore(inner, cache)

    const result = ds.insert(C, { name: 'Z' })
    expect(result).toMatchObject({ name: 'Z' })
    expect(inner.calls.insert).toBe(1)
  })

  test('update uỷ quyền inner + invalidate', () => {
    const inner = makeFakeInner([{ id: 1, name: 'A' }])
    const cache = makeFakeCache()
    const ds = new CachingDataStore(inner, cache)

    ds.getAll(C) // prime cache
    ds.update(C, 1, { name: 'B' })
    expect(inner.calls.update).toBe(1)
    ds.getAll(C) // must call inner again
    expect(inner.calls.getAll).toBe(2)
    expect(ds.getAll(C)[0].name).toBe('B') // effect: name changed
  })

  test('remove uỷ quyền inner + invalidate', () => {
    const inner = makeFakeInner([{ id: 1, name: 'A' }])
    const cache = makeFakeCache()
    const ds = new CachingDataStore(inner, cache)

    ds.getAll(C) // prime cache
    ds.remove(C, 1)
    expect(inner.calls.remove).toBe(1)
    ds.getAll(C) // must call inner again
    expect(inner.calls.getAll).toBe(2)
    expect(ds.getAll(C)).toHaveLength(0) // effect: gone
  })

  test('find uỷ quyền inner store (không cache)', () => {
    const inner = makeFakeInner([{ id: 1, name: 'A' }])
    const cache = makeFakeCache()
    const ds = new CachingDataStore(inner, cache)

    ds.find(C, {})

    expect(inner.calls.find).toBe(1)
  })
})
