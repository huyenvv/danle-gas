require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, seedUser, createSession } = require('./helpers')

let vanThuToken, nhanVienToken

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()

  // Categories: Công văn (root) → Đến (child)
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([1, 'Công văn', '', '', '', '', '', ''])
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([2, 'Đến', '', '', 1, '', '', ''])
  invalidateSheetCache(SHEETS.DANH_MUC)

  seedUser(10, 'vanthu', 'vt@test.com', 'Văn thư')
  seedUser(20, 'nv', 'nv@test.com', 'Nhân viên')
  vanThuToken = createSession(10, 'vanthu', 'vt@test.com', 'Văn thư')
  nhanVienToken = createSession(20, 'nv', 'nv@test.com', 'Nhân viên')
})

describe('_mapImportRows — header normalization', () => {
  test('maps headers with (tự động) suffixes, skips empty + headerless cols', () => {
    const values = [
      ['Tên hồ sơ', 'Tên file (tự động lấy)', 'link (tự động lấy, để xem)', 'G_ID (Tự động)', 'Size (Tự động)', 'Danh mục (tự động lấy)', ''],
      ['HĐ A', 'a.pdf', 'http://x', 'gid-1', '1542', 'Công văn / Đến', 46181.6],
      ['', '', '', '', '', '', ''], // fully empty → skipped
    ]
    const rows = _mapImportRows(values)
    expect(rows.length).toBe(1)
    expect(rows[0].tenHoSo).toBe('HĐ A')
    expect(rows[0].tenFile).toBe('a.pdf')
    expect(rows[0].gId).toBe('gid-1')
    expect(rows[0].size).toBe(1542)
    expect(rows[0].danhMuc).toBe('Công văn / Đến')
    expect(rows[0].rowIndex).toBe(2) // 1-based, header is row 1
    expect(rows[0].link).toBe('http://x') // link column mapped (used for preview)
  })

  test('returns empty for header-only sheet', () => {
    expect(_mapImportRows([['Tên hồ sơ', 'G_ID (Tự động)']])).toEqual([])
  })
})

describe('bulkImportDocuments', () => {
  function group(overrides) {
    return Object.assign({
      docData: { 'Tên hồ sơ': 'HĐ A', 'Danh mục': 2 },
      files: [{ fileId: 'gid-1', fileName: 'a.pdf', mimeType: 'application/pdf', size: 100 }],
      warnings: [],
      rowIndices: [2],
    }, overrides)
  }

  test('Văn thư creates documents with status Hoàn thành', () => {
    const res = bulkImportDocuments(vanThuToken, { groups: [group()] })
    expect(res.created).toBe(1)
    expect(res.totalFiles).toBe(1)
    expect(res.errors.length).toBe(0)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs.length).toBe(1)
    expect(docs[0]['Tình trạng']).toBe('Hoàn thành')
    expect(JSON.parse(docs[0]['Tệp đính kèm'])[0].fileId).toBe('gid-1')
  })

  test('Nhân viên is rejected', () => {
    expect(() => bulkImportDocuments(nhanVienToken, { groups: [group()] })).toThrow('không có quyền')
  })

  test('partial success: invalid category and empty name collected as errors', () => {
    const res = bulkImportDocuments(vanThuToken, {
      groups: [
        group(),
        group({ docData: { 'Tên hồ sơ': 'HĐ B', 'Danh mục': 999 } }), // bad category
        group({ docData: { 'Tên hồ sơ': '', 'Danh mục': 2 } }),        // empty name
        group({ docData: { 'Tên hồ sơ': 'HĐ C', 'Danh mục': 2 }, files: [] }), // no files
      ],
    })
    expect(res.created).toBe(1)
    expect(res.errors.length).toBe(3)
    expect(getSheetData(SHEETS.HO_SO).length).toBe(1)
  })

  test('propagates client warnings to result', () => {
    const res = bulkImportDocuments(vanThuToken, {
      groups: [group({ warnings: ['Dòng 3: "Ghi chú" khác dòng đầu'] })],
    })
    expect(res.warnings.length).toBe(1)
    expect(res.warnings[0].message).toContain('Ghi chú')
  })

  test('throws when no groups', () => {
    expect(() => bulkImportDocuments(vanThuToken, { groups: [] })).toThrow('Không có dữ liệu')
  })
})

describe('parseImportFileFromDrive', () => {
  test('rejects a non-importer role before touching Drive', () => {
    expect(() => parseImportFileFromDrive(nhanVienToken, 'someFileId')).toThrow('không có quyền')
  })

  test('throws when no fileId given', () => {
    expect(() => parseImportFileFromDrive(vanThuToken, '')).toThrow('Chưa chọn file')
  })
})

describe('_parseImportBlob validation (empty / over-limit)', () => {
  beforeEach(() => {
    global.MimeType = { MICROSOFT_EXCEL: 'application/vnd.ms-excel', GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet' }
    global.Drive = { Files: { insert: function () { return { id: 'tempImportSS' } } } }
  })

  test('empty file (header only) → throws "không có dữ liệu"', () => {
    SpreadsheetApp._addExternalSheet('tempImportSS', 'FileMoi', [['Tên hồ sơ', 'Tên file']])
    expect(() => parseImportFile(vanThuToken, 'AQID', 'empty.xlsx')).toThrow('không có dữ liệu')
  })

  test('over 1000 data rows → throws "quá lớn"', () => {
    const rows = [['Tên hồ sơ', 'Tên file']]
    for (let i = 0; i < 1001; i++) rows.push(['HS ' + i, 'f' + i + '.pdf'])
    SpreadsheetApp._addExternalSheet('tempImportSS', 'FileMoi', rows)
    expect(() => parseImportFile(vanThuToken, 'AQID', 'big.xlsx')).toThrow('quá lớn')
  })

  test('Drive variant validates the same (empty → throws)', () => {
    SpreadsheetApp._addExternalSheet('tempImportSS', 'FileMoi', [['Tên hồ sơ', 'Tên file']])
    DriveApp._files['driveXlsx'] = { id: 'driveXlsx', name: 'empty.xlsx', mimeType: 'application/vnd.ms-excel', size: 100 }
    expect(() => parseImportFileFromDrive(vanThuToken, 'driveXlsx')).toThrow('không có dữ liệu')
  })
})
