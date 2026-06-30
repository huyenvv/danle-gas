// Kiểm tra find() pushdown + pagination trên SQLite adapter.

import Database from 'better-sqlite3'
import { createSqliteTables } from '../src/adapters/sqlite/sqlite-schema'
import { createSqliteDataStore } from '../src/adapters/sqlite/sqlite-data-store'
import type { DataStore } from '../src/core/ports/data-store'

function makeDb(): DataStore {
  const db = new Database(':memory:')
  createSqliteTables(db, ['labels'])
  return createSqliteDataStore(db)
}

// Seed 25 labels: 5 with color '#fff', 20 with '#000'.
// Names: 'bug-01' .. 'bug-05' (color #fff), 'item-06' .. 'item-25' (color #000).
function seedLabels(ds: DataStore): void {
  for (let i = 1; i <= 25; i++) {
    const name = i <= 5 ? `bug-${String(i).padStart(2, '0')}` : `item-${String(i).padStart(2, '0')}`
    const color = i <= 5 ? '#fff' : '#000'
    ds.insert('labels', { name, color })
  }
}

describe('SqliteDataStore.find', () => {
  test('where = filtriert korrekt, total = Trefferanzahl', () => {
    const ds = makeDb()
    seedLabels(ds)

    const page = ds.find('labels', { where: [{ field: 'color', op: '=', value: '#fff' }] })

    // Chỉ 5 bản ghi có color #fff.
    expect(page.total).toBe(5)
    expect(page.rows).toHaveLength(5)
    for (const row of page.rows) {
      expect(row.color).toBe('#fff')
    }
  })

  test('pagination: limit+offset, total bỏ qua limit', () => {
    const ds = makeDb()
    seedLabels(ds)

    // Sắp xếp theo name asc, lấy rows 6–10 (offset=5, limit=5).
    const page = ds.find('labels', {
      orderBy: [{ field: 'name', dir: 'asc' }],
      limit: 5,
      offset: 5,
    })

    // total = 25 (không bị ảnh hưởng bởi limit/offset).
    expect(page.total).toBe(25)
    expect(page.rows).toHaveLength(5)

    // name asc: bug-01..bug-05, item-06..item-25 → offset 5 = item-06..item-10
    expect(page.rows[0].name).toBe('item-06')
    expect(page.rows[4].name).toBe('item-10')
  })

  test('contains: tìm substring trong name', () => {
    const ds = makeDb()
    seedLabels(ds)

    const page = ds.find('labels', { where: [{ field: 'name', op: 'contains', value: 'bug' }] })

    // 5 rows có tên bắt đầu bằng 'bug-'.
    expect(page.total).toBe(5)
    expect(page.rows).toHaveLength(5)
    for (const row of page.rows) {
      expect(String(row.name)).toContain('bug')
    }
  })

  test('id trả về là number (int-coercion)', () => {
    const ds = makeDb()
    ds.insert('labels', { name: 'Test', color: '#abc' })

    const page = ds.find('labels', {})

    expect(page.rows).toHaveLength(1)
    expect(typeof page.rows[0].id).toBe('number')
  })

  test('find trả về rows dạng domain ASCII (không phải cột SQL)', () => {
    const ds = makeDb()
    ds.insert('labels', { name: 'Ưu tiên', color: '#e53935' })

    const page = ds.find('labels', {})

    expect(page.rows[0]).toHaveProperty('name')
    expect(page.rows[0]).toHaveProperty('color')
    expect(page.rows[0]).toHaveProperty('id')
    // Không có cột SQL tên 'color' lẫn cột VN — chỉ có domain key.
    expect(page.rows[0]).not.toHaveProperty('Màu sắc')
  })

  test('find empty collection trả về total=0', () => {
    const ds = makeDb()
    const page = ds.find('labels', {})
    expect(page.total).toBe(0)
    expect(page.rows).toHaveLength(0)
  })
})
