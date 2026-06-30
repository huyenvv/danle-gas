// composition-node.test.ts — end-to-end wire test for node composition root.
// Proves service→repo→sqlite chain works correctly.

import Database from 'better-sqlite3'
import { createSqliteTables } from '../src/adapters/sqlite/sqlite-schema'
import { makeApp } from '../src/composition/node'
import type { Label } from '../src/core/domain/models'

const ALL_COLLECTIONS = ['labels', 'activities', 'audit'] as const

const session = { userId: 1, name: 'Tester', username: 'tester', role: 'admin' }

describe('composition/node — end-to-end wiring', () => {
  function makeDb() {
    const db = new Database(':memory:')
    createSqliteTables(db, [...ALL_COLLECTIONS])
    return db
  }

  test('labelAdd then labelList returns the added label', () => {
    const db = makeDb()
    const { labelService } = makeApp(db)

    const added = labelService.labelAdd(session, { name: 'Ưu tiên', color: '#ff0000' }) as Label
    expect(added.id).toBeDefined()
    expect(added.name).toBe('Ưu tiên')
    expect(added.color).toBe('#ff0000')

    const list = labelService.labelList(session) as Label[]
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Ưu tiên')
  })

  test('labelAdd then labelRemove leaves empty list', () => {
    const db = makeDb()
    const { labelService } = makeApp(db)

    const added = labelService.labelAdd(session, { name: 'Tạm' }) as Label
    labelService.labelRemove(session, added.id)
    expect(labelService.labelList(session)).toHaveLength(0)
  })

  test('labelUpdate changes name', () => {
    const db = makeDb()
    const { labelService } = makeApp(db)

    const added = labelService.labelAdd(session, { name: 'Cũ', color: '' }) as Label
    labelService.labelUpdate(session, added.id, { name: 'Mới' })
    const list = labelService.labelList(session) as Label[]
    expect(list[0].name).toBe('Mới')
  })
})
