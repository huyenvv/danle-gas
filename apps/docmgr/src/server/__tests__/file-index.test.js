const { setSheetData } = require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, seedUser, createSession } = require('./helpers')

// _FileIndex: bản ghi sở hữu "file → hồ sơ", đồng bộ TỰ ĐỘNG qua override
// addRow/updateRow/deleteRow. Test bộ máy + đồng bộ "miễn phí" qua hàm nghiệp vụ.

let vanThuToken, adminToken

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([1, 'Công văn', '', '', '', '', '', ''])
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([2, 'Đến', '', '', 1, '', '', ''])
  invalidateSheetCache(SHEETS.DANH_MUC)

  seedUser(10, 'vanthu', 'vt@test.com', 'Văn thư')
  seedUser(5, 'admin', 'a@test.com', 'admin')
  vanThuToken = createSession(10, 'vanthu', 'vt@test.com', 'Văn thư')
  adminToken = createSession(5, 'admin', 'a@test.com', 'admin')
})

const files = (...ids) => JSON.stringify(ids.map(id => ({ fileId: id, fileName: id + '.pdf', linked: true })))

describe('helpers + auto-sync overrides', () => {
  test('addRow(HO_SO) tự thêm file vào index', () => {
    const doc = addRow(SHEETS.HO_SO, { 'Tên hồ sơ': 'A', 'Danh mục': 2, 'Tệp đính kèm': files('f1', 'f2') })
    expect(String(_indexFindDoc('f1'))).toBe(String(doc.ID))
    expect(String(_indexFindDoc('f2'))).toBe(String(doc.ID))
    _assertIndexMatchesDocs()
  })

  test('updateRow có Tệp đính kèm → đặt lại đúng tập (gỡ file biến mất, giữ file còn)', () => {
    const doc = addRow(SHEETS.HO_SO, { 'Tên hồ sơ': 'A', 'Danh mục': 2, 'Tệp đính kèm': files('f1', 'f2') })
    updateRow(SHEETS.HO_SO, doc.ID, { 'Tệp đính kèm': files('f1') })
    expect(String(_indexFindDoc('f1'))).toBe(String(doc.ID))
    expect(_indexFindDoc('f2')).toBeNull()
    _assertIndexMatchesDocs()
  })

  test('updateRow KHÔNG có Tệp đính kèm → index không đổi', () => {
    const doc = addRow(SHEETS.HO_SO, { 'Tên hồ sơ': 'A', 'Danh mục': 2, 'Tệp đính kèm': files('f1') })
    updateRow(SHEETS.HO_SO, doc.ID, { 'Tình trạng': 'Hoàn thành' })
    expect(String(_indexFindDoc('f1'))).toBe(String(doc.ID))
    _assertIndexMatchesDocs()
  })

  test('deleteRow(HO_SO) xoá mọi file của doc khỏi index', () => {
    const doc = addRow(SHEETS.HO_SO, { 'Tên hồ sơ': 'A', 'Danh mục': 2, 'Tệp đính kèm': files('f1', 'f2') })
    deleteRow(SHEETS.HO_SO, doc.ID)
    expect(_indexFindDoc('f1')).toBeNull()
    expect(_indexFindDoc('f2')).toBeNull()
    _assertIndexMatchesDocs()
  })

  test('hai hồ sơ khác file → mỗi file trỏ đúng chủ', () => {
    const a = addRow(SHEETS.HO_SO, { 'Tên hồ sơ': 'A', 'Danh mục': 2, 'Tệp đính kèm': files('f1') })
    const b = addRow(SHEETS.HO_SO, { 'Tên hồ sơ': 'B', 'Danh mục': 2, 'Tệp đính kèm': files('f2') })
    expect(String(_indexFindDoc('f1'))).toBe(String(a.ID))
    expect(String(_indexFindDoc('f2'))).toBe(String(b.ID))
    _assertIndexMatchesDocs()
  })

  test('[SC-003] _indexFindDoc chỉ đọc _FileIndex (không cần HO_SO có dữ liệu)', () => {
    // Ghi thẳng vào index cho doc không tồn tại trong HO_SO → vẫn tra cứu được.
    _indexSetDocFiles('doc-99', [{ fileId: 'fz' }])
    expect(String(_indexFindDoc('fz'))).toBe('doc-99')
    expect(_indexFindDoc('không-có')).toBeNull()
  })

  test('rebuildFileIndex backfill từ hồ sơ có sẵn (migration: dữ liệu ghi thẳng, index rỗng)', () => {
    // setSheetData ghi thẳng HO_SO (KHÔNG qua addRow) → override không chạy → index rỗng.
    setSheetData(SHEETS.HO_SO, [
      { ID: 1, 'Tên hồ sơ': 'Cũ 1', 'Danh mục': 2, 'Tệp đính kèm': JSON.stringify([{ fileId: 'old1' }, { fileId: 'old2' }]) },
      { ID: 2, 'Tên hồ sơ': 'Cũ 2', 'Danh mục': 2, 'Tệp đính kèm': JSON.stringify([{ fileId: 'old3' }]) },
    ])
    expect(_indexFindDoc('old1')).toBeNull()        // chưa backfill

    const stats = rebuildFileIndex()
    expect(stats.files).toBe(3)
    expect(String(_indexFindDoc('old1'))).toBe('1')
    expect(String(_indexFindDoc('old2'))).toBe('1')
    expect(String(_indexFindDoc('old3'))).toBe('2')
    _assertIndexMatchesDocs()
  })

  test('rebuildFileIndex self-heal khi index lệch', () => {
    const doc = addRow(SHEETS.HO_SO, { 'Tên hồ sơ': 'A', 'Danh mục': 2, 'Tệp đính kèm': files('f1') })
    // Làm lệch: chèn row rác vào _FileIndex
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.FILE_INDEX).appendRow(['rác', '999'])
    invalidateSheetCache(SHEETS.FILE_INDEX)
    expect(() => _assertIndexMatchesDocs()).toThrow('lệch')

    const stats = rebuildFileIndex()
    expect(stats.files).toBe(1)
    expect(String(_indexFindDoc('f1'))).toBe(String(doc.ID))
    expect(_indexFindDoc('rác')).toBeNull()
    _assertIndexMatchesDocs()
  })
})

describe('đồng bộ "miễn phí" qua hàm nghiệp vụ (không gọi index thủ công)', () => {
  function importGroup(fileId) {
    return { docData: { 'Tên hồ sơ': 'HS ' + fileId, 'Danh mục': 2 }, files: [{ fileId: fileId, fileName: fileId + '.pdf' }], warnings: [], rowIndices: [2] }
  }

  test('bulkImportDocuments giữ index đồng bộ', () => {
    bulkImportDocuments(vanThuToken, { groups: [importGroup('g1'), importGroup('g2')] })
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs.length).toBe(2)
    expect(_indexFindDoc('g1')).toBeTruthy()
    expect(_indexFindDoc('g2')).toBeTruthy()
    _assertIndexMatchesDocs()
  })

  test('deleteDocument giải phóng file (orphaned trở lại)', () => {
    bulkImportDocuments(vanThuToken, { groups: [importGroup('g1')] })
    const docId = getSheetData(SHEETS.HO_SO)[0].ID
    expect(_indexFindDoc('g1')).toBeTruthy()
    deleteDocument(adminToken, docId)
    expect(_indexFindDoc('g1')).toBeNull()
    _assertIndexMatchesDocs()
  })
})
