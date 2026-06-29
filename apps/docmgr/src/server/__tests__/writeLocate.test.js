// 014 US2: update/delete định vị dòng bằng _findRowIndexById — không quét cả sheet.
require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets } = require('./helpers')

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  for (let i = 1; i <= 5; i++) { addRow(SHEETS.HO_SO, { 'ID': i, 'Tên hồ sơ': 'Doc ' + i, 'Ghi chú': '' }) }
  invalidateSheetCache(SHEETS.HO_SO)
})

describe('updateRow định vị đúng dòng', () => {
  test('chỉ dòng đích đổi, các dòng khác nguyên', () => {
    updateRow(SHEETS.HO_SO, 3, { 'Ghi chú': 'sửa-3' })
    const all = getSheetData(SHEETS.HO_SO)
    expect(all.find(d => String(d.ID) === '3')['Ghi chú']).toBe('sửa-3')
    expect(all.find(d => String(d.ID) === '2')['Ghi chú']).toBe('')
    expect(all.find(d => String(d.ID) === '4')['Ghi chú']).toBe('')
  })

  test('ID không tồn tại → ném "Không tìm thấy bản ghi ID"', () => {
    expect(() => updateRow(SHEETS.HO_SO, 999, { 'Ghi chú': 'x' }))
      .toThrow('Không tìm thấy bản ghi ID: 999')
  })
})

describe('deleteRow định vị đúng dòng', () => {
  test('xoá đúng dòng giữa sheet, không lệch index', () => {
    deleteRow(SHEETS.HO_SO, 3)
    const ids = getSheetData(SHEETS.HO_SO).map(d => String(d.ID))
    expect(ids).toEqual(['1', '2', '4', '5'])
  })

  test('ID không tồn tại → ném "Không tìm thấy bản ghi ID"', () => {
    expect(() => deleteRow(SHEETS.HO_SO, 999)).toThrow('Không tìm thấy bản ghi ID: 999')
  })
})
