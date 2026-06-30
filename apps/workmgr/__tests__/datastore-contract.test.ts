// Kiểm tra hợp đồng DataStore: CRUD cơ bản hoạt động nhất quán trên mọi adapter.
// Ba builder được kiểm tra: SheetsDataStore, SqliteDataStore, CachingDataStore(Sheets).
// Bonus: kiểm tra ép kiểu int trên SQLite (objectId phải là number, không phải string).

import './mocks/gas'
import { resetGAS, SpreadsheetAppMock } from './mocks/gas'
import { createSheetsDataStore } from '../src/adapters/gas/sheets-data-store'
import { createSqliteDataStore } from '../src/adapters/sqlite/sqlite-data-store'
import { createSqliteTables } from '../src/adapters/sqlite/sqlite-schema'
import { CachingDataStore } from '../src/core/caching-data-store'
import type { DataStore, Collection } from '../src/core/ports/data-store'
import type { Cache } from '../src/core/ports/cache'
import Database from 'better-sqlite3'

// Fake in-memory Cache (pattern từ caching-data-store.test.ts)
function makeFakeCache(): Cache {
  const store = new Map<string, unknown>()
  return {
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

// Kịch bản CRUD cơ bản trên collection 'labels'
function runContract(make: () => DataStore): void {
  const ds = make()
  const C: Collection = 'labels'

  // insert
  const rec = ds.insert(C, { name: 'Bug', color: '#e53935' })
  expect(typeof rec.id).toBe('number')
  expect(rec.name).toBe('Bug')

  // getAll trả bản ghi vừa insert
  const all = ds.getAll(C)
  expect(all.length).toBe(1)
  expect(all[0].id).toBe(rec.id)
  expect(all[0].name).toBe('Bug')

  // insert thêm bản ghi
  ds.insert(C, { name: 'Feature', color: '#1e88e5' })

  // update: thay đổi field (chạy cho MỌI builder)
  ds.update(C, rec.id as number, { color: '#ffffff' })
  const updated = ds.getAll(C).find(r => r.id === rec.id)
  expect(updated?.color).toBe('#ffffff')

  // remove: biến mất khỏi getAll (chạy cho MỌI builder)
  ds.remove(C, rec.id as number)
  const after = ds.getAll(C)
  expect(after.find(r => r.id === rec.id)).toBeUndefined()
}

// ── (a) SheetsDataStore ────────────────────────────────────────────────────────
test('contract — SheetsDataStore', () => {
  resetGAS()
  SpreadsheetAppMock._addSheet('Nhãn', [['ID', 'Tên nhãn', 'Màu sắc']])
  runContract(() => createSheetsDataStore())
})

// ── (b) SqliteDataStore ────────────────────────────────────────────────────────
test('contract — SqliteDataStore', () => {
  const db = new Database(':memory:')
  createSqliteTables(db, ['labels'])
  runContract(() => createSqliteDataStore(db))
})

// ── (c) CachingDataStore wrapping SheetsDataStore ─────────────────────────────
test('contract — CachingDataStore(Sheets)', () => {
  resetGAS()
  SpreadsheetAppMock._addSheet('Nhãn', [['ID', 'Tên nhãn', 'Màu sắc']])
  runContract(() => new CachingDataStore(createSheetsDataStore(), makeFakeCache()))
})

// ── int-coercion: SQLite trả objectId là number, không phải string ─────────────
test('SQLite int-coercion — objectId và id là number', () => {
  const db = new Database(':memory:')
  createSqliteTables(db, ['activities'])
  const ds = createSqliteDataStore(db)

  ds.insert('activities', {
    type: 'x',
    objectType: 'Nhãn',
    objectId: 3,
    userId: 7,
    userName: 'A',
    description: 'd',
    at: '2026-06-29T00:00:00.000Z',
  })

  const all = ds.getAll('activities')
  expect(all.length).toBe(1)
  const got = all[0]
  expect(typeof got.id).toBe('number')
  expect(typeof got.objectId).toBe('number')
  expect(got.objectId).toBe(3)
})
