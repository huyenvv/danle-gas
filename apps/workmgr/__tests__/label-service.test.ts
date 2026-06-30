import { createLabelRepository } from '../src/core/domain/label-repository'
import { createLabelService } from '../src/core/services/label-service'
import type { DataStore, DomainRecord, Collection } from '../src/core/ports/data-store'
import type { Label } from '../src/core/domain/models'
import type { Session } from '../src/core/domain/session'

// --- Fake DataStore (in-memory) ---
function makeFakeStore(): DataStore {
  const collections: Record<string, DomainRecord[]> = {}
  let nextId = 1
  function col(c: Collection): DomainRecord[] {
    if (!collections[c]) collections[c] = []
    return collections[c]
  }
  return {
    getAll: (c) => [...col(c)],
    insert: (c, rec) => {
      const r = { ...rec, id: nextId++ }
      col(c).push(r)
      return r
    },
    update: (c, id, fields) => {
      const rows = col(c)
      const idx = rows.findIndex((r) => r.id === id)
      if (idx === -1) throw new Error('Không tìm thấy bản ghi ID: ' + id)
      rows[idx] = { ...rows[idx], ...fields }
    },
    remove: (c, id) => {
      const rows = col(c)
      const idx = rows.findIndex((r) => r.id === id)
      if (idx === -1) throw new Error('Không tìm thấy bản ghi ID: ' + id)
      rows.splice(idx, 1)
    },
    find: () => ({ rows: [], total: 0 }),
  }
}

// --- Fake ActivityLog ---
function makeFakeActivityLog() {
  const calls: Array<{ type: string; objectType: string; objectId: string | number }> = []
  return {
    log: (session: Session, type: string, objectType: string, objectId: string | number, description: string) => {
      calls.push({ type, objectType, objectId })
    },
    calls,
  }
}

const session: Session = { userId: 1, name: 'Tester', username: 'tester', role: 'Admin' }

describe('LabelService', () => {
  test('labelAdd: ném lỗi nếu name trống', () => {
    const ds = makeFakeStore()
    const repo = createLabelRepository(ds)
    const actLog = makeFakeActivityLog()
    const svc = createLabelService(repo, actLog)
    expect(() => svc.labelAdd(session, { name: '' })).toThrow('Tên nhãn')
  })

  test('labelAdd: ném lỗi nếu name là khoảng trắng', () => {
    const ds = makeFakeStore()
    const repo = createLabelRepository(ds)
    const actLog = makeFakeActivityLog()
    const svc = createLabelService(repo, actLog)
    expect(() => svc.labelAdd(session, { name: '   ' })).toThrow('Tên nhãn')
  })

  test('labelAdd: trả về Label với id khi name hợp lệ', () => {
    const ds = makeFakeStore()
    const repo = createLabelRepository(ds)
    const actLog = makeFakeActivityLog()
    const svc = createLabelService(repo, actLog)
    const label = svc.labelAdd(session, { name: 'Ưu tiên', color: '#red' }) as Label
    expect(label.id).toBeDefined()
    expect(label.name).toBe('Ưu tiên')
    expect(label.color).toBe('#red')
  })

  test('labelAdd: ghi activity sau khi thêm thành công', () => {
    const ds = makeFakeStore()
    const repo = createLabelRepository(ds)
    const actLog = makeFakeActivityLog()
    const svc = createLabelService(repo, actLog)
    svc.labelAdd(session, { name: 'Khẩn cấp' })
    expect(actLog.calls).toHaveLength(1)
    expect(actLog.calls[0].type).toMatch('nhãn')
  })

  test('labelList: trả danh sách labels', () => {
    const ds = makeFakeStore()
    const repo = createLabelRepository(ds)
    const actLog = makeFakeActivityLog()
    const svc = createLabelService(repo, actLog)
    svc.labelAdd(session, { name: 'A' })
    svc.labelAdd(session, { name: 'B' })
    const list = svc.labelList(session) as Label[]
    expect(list).toHaveLength(2)
  })

  test('labelUpdate: cập nhật tên thành công', () => {
    const ds = makeFakeStore()
    const repo = createLabelRepository(ds)
    const actLog = makeFakeActivityLog()
    const svc = createLabelService(repo, actLog)
    const label = svc.labelAdd(session, { name: 'Cũ' }) as Label
    svc.labelUpdate(session, label.id, { name: 'Mới' })
    expect((svc.labelList(session) as Label[])[0].name).toBe('Mới')
  })

  test('labelUpdate: ném lỗi nếu name rỗng', () => {
    const ds = makeFakeStore()
    const repo = createLabelRepository(ds)
    const actLog = makeFakeActivityLog()
    const svc = createLabelService(repo, actLog)
    const label = svc.labelAdd(session, { name: 'X' }) as Label
    expect(() => svc.labelUpdate(session, label.id, { name: '' })).toThrow('Tên nhãn')
  })

  test('labelRemove: xóa nhãn, list rỗng', () => {
    const ds = makeFakeStore()
    const repo = createLabelRepository(ds)
    const actLog = makeFakeActivityLog()
    const svc = createLabelService(repo, actLog)
    const label = svc.labelAdd(session, { name: 'Xóa' }) as Label
    svc.labelRemove(session, label.id)
    expect((svc.labelList(session) as Label[])).toHaveLength(0)
  })
})
