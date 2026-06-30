import { createActivityLog } from '../src/core/domain/activity-log'
import { createAuditLog } from '../src/core/domain/audit-log'
import type { DataStore, DomainRecord, Collection } from '../src/core/ports/data-store'
import type { Clock } from '../src/core/ports/clock'
import type { Session } from '../src/core/domain/session'

// --- Fake DataStore that records inserts ---
function makeFakeStore() {
  const inserted: Array<{ c: Collection; rec: DomainRecord }> = []
  const ds: DataStore = {
    getAll: () => [],
    insert: (c, rec) => {
      const r = { ...rec, id: inserted.length + 1 }
      inserted.push({ c, rec: r })
      return r
    },
    update: () => {},
    remove: () => {},
    find: () => ({ rows: [], total: 0 }),
  }
  return { ds, inserted }
}

// --- Throwing DataStore ---
function makeThrowingStore(): DataStore {
  return {
    getAll: () => { throw new Error('ds broken') },
    insert: () => { throw new Error('ds broken') },
    update: () => { throw new Error('ds broken') },
    remove: () => { throw new Error('ds broken') },
    find: () => { throw new Error('ds broken') },
  }
}

const fakeClock: Clock = { now: () => '2026-06-30T00:00:00Z' }
const session: Session = { userId: 42, name: 'Tester', username: 'tester', role: 'Admin' }

describe('ActivityLog', () => {
  test('log: lưu bản ghi vào collection activities với at từ clock', () => {
    const { ds, inserted } = makeFakeStore()
    const actLog = createActivityLog(ds, fakeClock)
    actLog.log(session, 'Tạo nhãn', 'Nhãn', 1, 'Nhãn X')
    expect(inserted).toHaveLength(1)
    expect(inserted[0].c).toBe('activities')
    expect(inserted[0].rec.at).toBe('2026-06-30T00:00:00Z')
    expect(inserted[0].rec.type).toBe('Tạo nhãn')
    expect(inserted[0].rec.objectType).toBe('Nhãn')
    expect(inserted[0].rec.objectId).toBe(1)
    expect(inserted[0].rec.userId).toBe(42)
    expect(inserted[0].rec.userName).toBe('Tester')
  })

  test('log: best-effort — throwing DataStore không ném ra ngoài', () => {
    const actLog = createActivityLog(makeThrowingStore(), fakeClock)
    expect(() => actLog.log(session, 'Tạo', 'Nhãn', 1, '')).not.toThrow()
  })
})

describe('AuditLog', () => {
  test('log: lưu bản ghi vào collection audit với at từ clock', () => {
    const { ds, inserted } = makeFakeStore()
    const auditLog = createAuditLog(ds, fakeClock)
    auditLog.log(session, 'DELETE', 'Nhãn', 'id=5', 'xóa nhãn cũ')
    expect(inserted).toHaveLength(1)
    expect(inserted[0].c).toBe('audit')
    expect(inserted[0].rec.at).toBe('2026-06-30T00:00:00Z')
    expect(inserted[0].rec.user).toBe('tester')
    expect(inserted[0].rec.action).toBe('DELETE')
    expect(inserted[0].rec.type).toBe('Nhãn')
    expect(inserted[0].rec.target).toBe('id=5')
    expect(inserted[0].rec.details).toBe('xóa nhãn cũ')
  })

  test('log: best-effort — throwing DataStore không ném ra ngoài', () => {
    const auditLog = createAuditLog(makeThrowingStore(), fakeClock)
    expect(() => auditLog.log(session, 'DELETE', 'Nhãn', 'id=1', '')).not.toThrow()
  })
})
