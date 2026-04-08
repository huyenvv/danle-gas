require('./setup.js')
const { resetAll, DOC_HEADERS } = require('./helpers')

const HEADERS = ['ID', 'Tên danh mục', 'Mô tả', 'Ngày tạo']

beforeEach(() => {
  resetAll()
  SpreadsheetApp._addSheet(SHEETS.DANH_MUC, [HEADERS])
  SpreadsheetApp._addSheet(SHEETS.HO_SO, [
    ['ID', 'Tên hồ sơ', 'Danh mục', 'Người tạo', 'Trạng thái', 'Ngày tạo']
  ])
})

describe('addRow', () => {
  test('appends a row and returns the object with ID', () => {
    const record = { 'Tên danh mục': 'Hợp đồng', 'Mô tả': 'Hợp đồng kinh tế' }
    const result = addRow(SHEETS.DANH_MUC, record)
    expect(result['ID']).toBe(1)
    const data = getSheetData(SHEETS.DANH_MUC)
    expect(data).toHaveLength(1)
    expect(data[0]['Tên danh mục']).toBe('Hợp đồng')
  })

  test('sequential IDs increment correctly', () => {
    addRow(SHEETS.DANH_MUC, { 'Tên danh mục': 'A' })
    const r2 = addRow(SHEETS.DANH_MUC, { 'Tên danh mục': 'B' })
    expect(r2['ID']).toBe(2)
  })
})

describe('updateRow', () => {
  test('updates specified field', () => {
    addRow(SHEETS.DANH_MUC, { 'Tên danh mục': 'Old' })
    updateRow(SHEETS.DANH_MUC, 1, { 'Tên danh mục': 'New' })
    // Invalidate cache and re-read
    invalidateSheetCache(SHEETS.DANH_MUC)
    const data = getSheetData(SHEETS.DANH_MUC)
    expect(data[0]['Tên danh mục']).toBe('New')
  })

  test('throws when ID not found', () => {
    expect(() => updateRow(SHEETS.DANH_MUC, 999, {})).toThrow('Không tìm thấy')
  })
})

describe('deleteRow', () => {
  test('removes the row', () => {
    addRow(SHEETS.DANH_MUC, { 'Tên danh mục': 'Del' })
    invalidateSheetCache(SHEETS.DANH_MUC)
    deleteRow(SHEETS.DANH_MUC, 1)
    invalidateSheetCache(SHEETS.DANH_MUC)
    expect(getSheetData(SHEETS.DANH_MUC)).toHaveLength(0)
  })

  test('throws when category is in use', () => {
    addRow(SHEETS.DANH_MUC, { 'Tên danh mục': 'Hợp đồng', ID: 1 })
    invalidateSheetCache(SHEETS.DANH_MUC)
    // Add a document referencing this category
    SpreadsheetApp._sheets[SHEETS.HO_SO]._rows.push([10, 'Doc A', '1', 'user1', 'Hiệu lực', ''])
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => deleteRow(SHEETS.DANH_MUC, 1)).toThrow('đang được sử dụng')
  })
})

describe('batchWrite', () => {
  test('processes multiple operations atomically', () => {
    batchWrite(SHEETS.DANH_MUC, [
      { type: 'add', data: { 'Tên danh mục': 'X' } },
      { type: 'add', data: { 'Tên danh mục': 'Y' } },
    ])
    invalidateSheetCache(SHEETS.DANH_MUC)
    expect(getSheetData(SHEETS.DANH_MUC)).toHaveLength(2)
  })
})
