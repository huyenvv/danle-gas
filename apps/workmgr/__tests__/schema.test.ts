import {
  getSchema,
  sheetHeaders,
  domainToSheet,
  sheetToDomain,
  domainToSqlRow,
  sqlRowToDomain,
} from '../src/core/schema'

test('labels: map domain ASCII ↔ header sheet VN', () => {
  const dom = { id: 5, name: 'Bug', color: '#e53935' }
  const row = domainToSheet('labels', dom)
  expect(row).toEqual({ 'ID': 5, 'Tên nhãn': 'Bug', 'Màu sắc': '#e53935' })
  expect(sheetToDomain('labels', row)).toEqual(dom)
})

test('labels: sheetHeaders đúng thứ tự', () => {
  expect(sheetHeaders('labels')).toEqual(['ID', 'Tên nhãn', 'Màu sắc'])
})

test('labels: map domain ↔ cột SQL', () => {
  const dom = { id: 5, name: 'Bug', color: '#e53935' }
  const row = domainToSqlRow('labels', dom)
  expect(row).toEqual({ id: 5, name: 'Bug', color: '#e53935' })
  expect(sqlRowToDomain('labels', row)).toEqual(dom)
})

test('activities: round-trip domainToSqlRow/sqlRowToDomain với snake_case + t=int cho objectId', () => {
  const dom = {
    id: 1,
    type: 'create',
    description: 'tạo task',
    objectType: 'task',
    objectId: 42,
    userId: 'u001',
    userName: 'Nguyễn A',
    at: '2026-01-01T00:00:00Z',
  }
  const sqlRow = domainToSqlRow('activities', dom)
  expect(sqlRow).toEqual({
    id: 1,
    type: 'create',
    description: 'tạo task',
    object_type: 'task',
    object_id: 42,
    user_id: 'u001',
    user_name: 'Nguyễn A',
    at: '2026-01-01T00:00:00Z',
  })
  expect(sqlRowToDomain('activities', sqlRow)).toEqual(dom)

  // Kiểm tra cờ t: 'int' cho id và objectId
  const schema = getSchema('activities')
  const idField = schema.fields.find(f => f.d === 'id')
  const objectIdField = schema.fields.find(f => f.d === 'objectId')
  const typeField = schema.fields.find(f => f.d === 'type')
  expect(idField?.t).toBe('int')
  expect(objectIdField?.t).toBe('int')
  expect(typeField?.t).toBe('text')
})
