// TDD: SheetsDataStore adapter — pure I/O (no caching).
// Tests assert CRUD behaviour only; no cache assertions (caching is in CachingDataStore).
import './mocks/gas'
import { resetGAS, SpreadsheetAppMock } from './mocks/gas'
import { createSheetsDataStore } from '../src/adapters/gas/sheets-data-store'

beforeEach(() => {
  resetGAS()
  // Create 'Nhãn' sheet with VN headers — simulates ensureSheet behaviour
  SpreadsheetAppMock._addSheet('Nhãn', [['ID', 'Tên nhãn', 'Màu sắc']])
})

describe('SheetsDataStore — pure I/O', () => {
  test('insert gán id tự động + trả domain ASCII', () => {
    const ds = createSheetsDataStore()
    const rec = ds.insert('labels', { name: 'Bug', color: '#e53935' })
    expect(rec.id).toBe(1)
    expect(rec.name).toBe('Bug')
    expect(rec.color).toBe('#e53935')
  })

  test('insert hai lần gán id tăng dần', () => {
    const ds = createSheetsDataStore()
    const r1 = ds.insert('labels', { name: 'Bug', color: '#000' })
    const r2 = ds.insert('labels', { name: 'Feature', color: '#fff' })
    expect(r1.id).toBe(1)
    expect(r2.id).toBe(2)
  })

  test('getAll trả domain ASCII (ánh xạ từ header VN)', () => {
    const ds = createSheetsDataStore()
    ds.insert('labels', { name: 'Bug', color: '#e53935' })
    const all = ds.getAll('labels')
    expect(all).toEqual([{ id: 1, name: 'Bug', color: '#e53935' }])
  })

  test('getAll trả mảng rỗng khi chưa có dữ liệu', () => {
    const ds = createSheetsDataStore()
    expect(ds.getAll('labels')).toEqual([])
  })

  test('update theo id thay đổi field', () => {
    const ds = createSheetsDataStore()
    ds.insert('labels', { name: 'Bug', color: '#000' })
    ds.update('labels', 1, { color: '#fff' })
    expect(ds.getAll('labels')[0].color).toBe('#fff')
  })

  test('update không đổi field khác', () => {
    const ds = createSheetsDataStore()
    ds.insert('labels', { name: 'Bug', color: '#000' })
    ds.update('labels', 1, { color: '#fff' })
    expect(ds.getAll('labels')[0].name).toBe('Bug')
  })

  test('update id không tồn tại ném lỗi', () => {
    const ds = createSheetsDataStore()
    expect(() => ds.update('labels', 99, { color: '#fff' })).toThrow()
  })

  test('remove theo id xoá hàng', () => {
    const ds = createSheetsDataStore()
    ds.insert('labels', { name: 'Bug', color: '#000' })
    ds.remove('labels', 1)
    expect(ds.getAll('labels')).toEqual([])
  })

  test('remove id không tồn tại ném lỗi', () => {
    const ds = createSheetsDataStore()
    expect(() => ds.remove('labels', 99)).toThrow()
  })

  test('insert khi sheet chưa tồn tại — ensureSheet tự tạo sheet', () => {
    resetGAS() // không có sheet Nhãn
    const ds = createSheetsDataStore()
    const rec = ds.insert('labels', { name: 'Auto', color: '#abc' })
    expect(rec.id).toBe(1)
    expect(ds.getAll('labels')).toEqual([{ id: 1, name: 'Auto', color: '#abc' }])
  })
})
