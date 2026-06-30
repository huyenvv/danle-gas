import type { DataStore } from '../src/core/ports/data-store'
test('port DataStore là type, fake thoả mãn shape', () => {
  const fake: DataStore = {
    getAll: () => [],
    insert: (_c, r) => r, update: () => {}, remove: () => {},
    find: () => ({ rows: [], total: 0 }),
  }
  expect(fake.getAll('labels')).toEqual([])
})
