require('./setup.js')
const { resetAll, setupUserSheets, setupDocSheets, CAT_HEADERS, seedUser, loginAs } = require('./helpers')

let editorToken

beforeEach(() => {
  resetAll()
  setupUserSheets()
  setupDocSheets()

  seedUser(1, 'editor', 'pass123', 'e@test.com', 'Biên tập viên')
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(
    [1, 'Hợp đồng', '', '', '']
  )
  invalidateSheetCache(SHEETS.DANH_MUC)

  editorToken = loginAs('editor', 'pass123')
})

describe('createDocument', () => {
  test('creates document and returns record with ID', () => {
    const result = createDocument(editorToken, {
      'Tên hồ sơ': 'HĐ Mua sắm',
      'Danh mục': 1,
    }, null)
    expect(result.data['ID']).toBe(1)
    // Phụ trách is now a JSON array string
    const assignees = JSON.parse(result.data['Phụ trách'])
    expect(assignees.map(String)).toContain('1')
  })

  test('throws without Tên hồ sơ', () => {
    expect(() => createDocument(editorToken, { 'Danh mục': 1 }, null)).toThrow('bắt buộc')
  })

  test('calculates Chênh lệch correctly', () => {
    const result = createDocument(editorToken, {
      'Tên hồ sơ': 'HĐ Test',
      'Danh mục': 1,
      'Giá trị HĐ': 100,
      'Giá trị thực hiện': 60,
    }, null)
    expect(result.data['Chênh lệch']).toBe(40)
  })
})

describe('getDocuments', () => {
  beforeEach(() => {
    createDocument(editorToken, { 'Tên hồ sơ': 'Doc A', 'Danh mục': 1, 'Tình trạng': 'Hiệu lực' }, null)
    createDocument(editorToken, { 'Tên hồ sơ': 'Doc B', 'Danh mục': 1, 'Tình trạng': 'Hết hạn' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('returns all docs for editor', () => {
    const result = getDocuments(editorToken, {})
    expect(result.data).toHaveLength(2)
  })

  test('filters by trangThai', () => {
    const result = getDocuments(editorToken, { tinhTrang: 'Hết hạn' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]['Tên hồ sơ']).toBe('Doc B')
  })

  test('filters by keyword', () => {
    const result = getDocuments(editorToken, { keyword: 'doc a' })
    expect(result.data).toHaveLength(1)
  })
})

describe('updateDocument', () => {
  test('updates field and recalculates Chênh lệch', () => {
    createDocument(editorToken, {
      'Tên hồ sơ': 'Hợp đồng A',
      'Danh mục': 1,
      'Giá trị HĐ': 100,
      'Giá trị thực hiện': 50,
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    updateDocument(editorToken, 1, { 'Giá trị thực hiện': 80 }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs[0]['Chênh lệch']).toBe(20)
  })
})

describe('deleteDocument', () => {
  let adminToken

  beforeEach(() => {
    seedUser(2, 'admin', 'admin123', 'a@test.com', 'admin')
    adminToken = loginAs('admin', 'admin123')
    createDocument(editorToken, { 'Tên hồ sơ': 'To Delete', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('admin can delete document', () => {
    const result = deleteDocument(adminToken, 1)
    expect(result.success).toBe(true)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(getSheetData(SHEETS.HO_SO)).toHaveLength(0)
  })

  test('removes the row from sheet', () => {
    createDocument(editorToken, { 'Tên hồ sơ': 'Keep', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    deleteDocument(adminToken, 1)
    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs).toHaveLength(1)
    expect(docs[0]['Tên hồ sơ']).toBe('Keep')
  })

  test('throws when document not found', () => {
    expect(() => deleteDocument(adminToken, 999)).toThrow('Không tìm thấy')
  })

  test('non-admin cannot delete', () => {
    expect(() => deleteDocument(editorToken, 1)).toThrow()
  })
})

describe('getDocumentStats', () => {
  test('returns correct totals and breakdown', () => {
    createDocument(editorToken, {
      'Tên hồ sơ': 'A', 'Danh mục': 1, 'Tình trạng': 'Hiệu lực',
      'Giá trị HĐ': 100, 'Giá trị thực hiện': 60,
    }, null)
    createDocument(editorToken, {
      'Tên hồ sơ': 'B', 'Danh mục': 1, 'Tình trạng': 'Hết hạn',
      'Giá trị HĐ': 200, 'Giá trị thực hiện': 200,
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    const stats = getDocumentStats(editorToken)
    expect(stats.total).toBe(2)
    expect(stats.byStatus['Hiệu lực']).toBe(1)
    expect(stats.byStatus['Hết hạn']).toBe(1)
    expect(stats.totalValue).toBe(300)
    expect(stats.totalExecuted).toBe(260)
    expect(stats.totalDiff).toBe(40)
  })
})
