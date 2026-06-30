// Kiểm tra QueryBuilder: deferred execution, spec accumulation, materializers, e2e SQLite.

import Database from 'better-sqlite3'
import { createSqliteTables } from '../src/adapters/sqlite/sqlite-schema'
import { createSqliteDataStore } from '../src/adapters/sqlite/sqlite-data-store'
import { query } from '../src/core/query-builder'
import type { Collection, DataStore, DomainRecord, Page, Query } from '../src/core/ports/data-store'

// ---------------------------------------------------------------------------
// Fake DataStore counting find() calls
// ---------------------------------------------------------------------------
interface FakeStore extends DataStore {
  findCalls: number
  lastQuery: Query | null
  rows: DomainRecord[]
}

function makeFakeStore(rows: DomainRecord[] = [], total?: number): FakeStore {
  let findCalls = 0
  let lastQuery: Query | null = null
  return {
    get findCalls() { return findCalls },
    get lastQuery() { return lastQuery },
    rows,
    getAll(_c: Collection) { return [...rows] },
    insert(_c: Collection, rec: DomainRecord) { return { ...rec, id: 1 } },
    update() { /* noop */ },
    remove() { /* noop */ },
    find(_c: Collection, q: Query): Page {
      findCalls++
      lastQuery = q
      return { rows: [...rows], total: total ?? rows.length }
    },
  }
}

const C: Collection = 'labels'

// ---------------------------------------------------------------------------
// 1. Deferred execution — nothing runs until a materializer is called
// ---------------------------------------------------------------------------
describe('QueryBuilder — deferred execution', () => {
  test('chaining builder methods does NOT call store.find', () => {
    const store = makeFakeStore()

    // Build query — should NOT touch the store.
    query(store, C).where('color', '=', '#fff').orderBy('name').limit(5).offset(0)

    expect(store.findCalls).toBe(0)
  })

  test('calling .page() triggers exactly one store.find call', () => {
    const store = makeFakeStore()
    const qb = query(store, C).where('color', '=', '#fff').limit(5)

    expect(store.findCalls).toBe(0)
    qb.page()
    expect(store.findCalls).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 2. Spec accumulation — Query object passed to store.find matches builder calls
// ---------------------------------------------------------------------------
describe('QueryBuilder — spec accumulation', () => {
  test('where + orderBy + limit + offset build correct Query', () => {
    const store = makeFakeStore()

    query(store, C)
      .where('color', '=', '#fff')
      .where('name', 'contains', 'bug')
      .orderBy('name', 'asc')
      .orderBy('color', 'desc')
      .limit(10)
      .offset(5)
      .page()

    expect(store.lastQuery).toEqual({
      where: [
        { field: 'color', op: '=', value: '#fff' },
        { field: 'name', op: 'contains', value: 'bug' },
      ],
      orderBy: [
        { field: 'name', dir: 'asc' },
        { field: 'color', dir: 'desc' },
      ],
      limit: 10,
      offset: 5,
    })
  })

  test('orderBy default direction is asc', () => {
    const store = makeFakeStore()
    query(store, C).orderBy('name').page()

    expect(store.lastQuery?.orderBy).toEqual([{ field: 'name', dir: 'asc' }])
  })

  test('empty builder passes empty spec {}', () => {
    const store = makeFakeStore()
    query(store, C).page()

    expect(store.lastQuery).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 3. Materializers
// ---------------------------------------------------------------------------
describe('QueryBuilder — materializers', () => {
  const rows: DomainRecord[] = [
    { id: 1, name: 'alpha', color: '#fff' },
    { id: 2, name: 'beta', color: '#000' },
  ]

  test('.page() returns { rows, total }', () => {
    const store = makeFakeStore(rows, 42)
    const result = query(store, C).page()

    expect(result.rows).toHaveLength(2)
    expect(result.total).toBe(42)
  })

  test('.toArray() returns rows only', () => {
    const store = makeFakeStore(rows, 42)
    const result = query(store, C).toArray()

    expect(result).toEqual(rows)
  })

  test('.first() passes limit:1 and returns first row', () => {
    const store = makeFakeStore(rows, 2)
    const result = query(store, C).where('color', '=', '#fff').first()

    expect(store.lastQuery?.limit).toBe(1)
    expect(result).toEqual(rows[0])
  })

  test('.first() returns null when no rows', () => {
    const store = makeFakeStore([], 0)
    const result = query(store, C).first()

    expect(result).toBeNull()
  })

  test('.count() returns total (ignoring limit/offset)', () => {
    const store = makeFakeStore(rows.slice(0, 1), 99)
    const result = query(store, C).limit(1).count()

    expect(result).toBe(99)
  })

  test('.count() strips limit and offset from the Query passed to store.find', () => {
    const store = makeFakeStore(rows, 42)
    query(store, C).where('color', '=', '#fff').limit(5).offset(10).count()

    // The query recorded by the fake store must NOT contain limit or offset.
    expect(store.lastQuery).not.toHaveProperty('limit')
    expect(store.lastQuery).not.toHaveProperty('offset')
    // But the where clause must be preserved.
    expect(store.lastQuery?.where).toEqual([{ field: 'color', op: '=', value: '#fff' }])
  })

  test('.first() does not mutate spec — subsequent .page() keeps original limit', () => {
    const store = makeFakeStore(rows, 2)
    const qb = query(store, C).limit(20)

    qb.first()
    qb.page()

    // .page() should use the original spec (limit: 20), not the limit:1 from .first()
    expect(store.lastQuery?.limit).toBe(20)
  })
})

// ---------------------------------------------------------------------------
// 4. End-to-end over SQLite — proves builder drives real pushdown
// ---------------------------------------------------------------------------
describe('QueryBuilder — end-to-end SQLite', () => {
  function makeDb() {
    const db = new Database(':memory:')
    createSqliteTables(db, ['labels'])
    return createSqliteDataStore(db)
  }

  function seedLabels(ds: DataStore): void {
    // 5 with color '#fff' (bug-01..bug-05), 5 with '#000' (item-06..item-10)
    for (let i = 1; i <= 10; i++) {
      const name = i <= 5 ? `bug-${String(i).padStart(2, '0')}` : `item-${String(i).padStart(2, '0')}`
      const color = i <= 5 ? '#fff' : '#000'
      ds.insert('labels', { name, color })
    }
  }

  test('where + orderBy + limit → correct subset via toArray()', () => {
    const ds = makeDb()
    seedLabels(ds)

    const rows = query(ds, 'labels')
      .where('color', '=', '#fff')
      .orderBy('name', 'asc')
      .limit(3)
      .toArray()

    // Expect first 3 of the 5 '#fff' labels in name order.
    expect(rows).toHaveLength(3)
    expect(rows[0].name).toBe('bug-01')
    expect(rows[1].name).toBe('bug-02')
    expect(rows[2].name).toBe('bug-03')
    for (const row of rows) {
      expect(row.color).toBe('#fff')
    }
  })

  test('count() returns full match count, ignoring limit', () => {
    const ds = makeDb()
    seedLabels(ds)

    const total = query(ds, 'labels').where('color', '=', '#fff').limit(2).count()

    // All 5 '#fff' labels match — limit does not reduce total.
    expect(total).toBe(5)
  })

  test('first() returns single record or null', () => {
    const ds = makeDb()
    seedLabels(ds)

    const found = query(ds, 'labels').where('name', '=', 'bug-03').first()
    expect(found).not.toBeNull()
    expect(found?.name).toBe('bug-03')

    const missing = query(ds, 'labels').where('name', '=', 'nonexistent').first()
    expect(missing).toBeNull()
  })

  test('page() with offset returns correct window + full total', () => {
    const ds = makeDb()
    seedLabels(ds)

    const page = query(ds, 'labels')
      .orderBy('name', 'asc')
      .limit(3)
      .offset(2)
      .page()

    // name asc: bug-01, bug-02, bug-03, bug-04, bug-05, item-06... → offset 2 = bug-03, bug-04, bug-05
    expect(page.total).toBe(10)
    expect(page.rows).toHaveLength(3)
    expect(page.rows[0].name).toBe('bug-03')
  })
})
