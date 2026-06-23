require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, DOC_HEADERS, createSession } = require('./helpers')

function pushDoc(obj) {
  const row = DOC_HEADERS.map(h => (obj[h] !== undefined ? obj[h] : ''))
  SpreadsheetApp._sheets[SHEETS.HO_SO]._rows.push(row)
}
function pushCat(id, name, parent) {
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([id, name, '', '', parent || '', '', '', ''])
}
function refresh() {
  invalidateSheetCache(SHEETS.HO_SO)
  invalidateSheetCache(SHEETS.DANH_MUC)
}

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
})

// ── US1: lọc (loại Nháp) / đệ quy / sắp xếp / STT / ánh xạ cột ──────────────
describe('_buildCatalogRows — filter, recursion, sort, mapping', () => {
  beforeEach(() => {
    pushCat(1, 'Hợp đồng', '')
    pushCat(2, 'Hợp đồng con', 1)   // con của 1
    pushCat(3, 'Báo cáo', '')
    pushDoc({ ID: 1, 'Tên hồ sơ': 'A', 'Danh mục': 1, 'Số hồ sơ': 'SH-02', 'Tình trạng': 'Hoàn thành', 'Ghi chú': 'g1', 'Nơi lưu hồ sơ cứng': 'Kệ 1', 'Ngày ban hành': '2026-01-02 09:00' })
    pushDoc({ ID: 2, 'Tên hồ sơ': 'B', 'Danh mục': 2, 'Số hồ sơ': 'SH-01', 'Tình trạng': 'Hoàn thành' }) // danh mục con
    pushDoc({ ID: 3, 'Tên hồ sơ': 'C', 'Danh mục': 1, 'Số hồ sơ': 'SH-03', 'Tình trạng': 'Đang xử lý' }) // không phải Nháp → ĐƯỢC xuất
    pushDoc({ ID: 4, 'Tên hồ sơ': 'D', 'Danh mục': 3, 'Số hồ sơ': 'SH-00', 'Tình trạng': 'Hoàn thành' }) // danh mục khác
    pushDoc({ ID: 5, 'Tên hồ sơ': 'N', 'Danh mục': 1, 'Số hồ sơ': 'SH-99', 'Tình trạng': 'Nháp' }) // Nháp → loại
    refresh()
  })

  test('loại Nháp + gộp đệ quy danh mục con, không lẫn danh mục khác', () => {
    const rows = _buildCatalogRows(1)
    expect(rows.length).toBe(3) // A, C (cat1) + B (cat2 con) ; loại N (Nháp) ; loại D (cat khác)
    expect(rows.map(r => r[2])).toEqual(['B', 'A', 'C']) // sắp Số hồ sơ: SH-01 < SH-02 < SH-03
  })

  test('STT liên tục 1..n theo thứ tự đã sắp', () => {
    const rows = _buildCatalogRows(1)
    expect(rows.map(r => r[0])).toEqual([1, 2, 3])
  })

  test('ánh xạ đúng 8 cột: tên danh mục theo ID, ngày định dạng dd/mm/yyyy (bỏ giờ)', () => {
    const rows = _buildCatalogRows(1)
    const a = rows.find(r => r[2] === 'A')
    expect(a).toEqual([2, 'SH-02', 'A', '02/01/2026', 'g1', 'Hợp đồng', 'Kệ 1', ''])
  })

  test('cột Link google drive: nhiều file → URL văn bản mỗi link 1 dòng (\\n); không file → rỗng', () => {
    pushDoc({ ID: 8, 'Tên hồ sơ': 'L', 'Danh mục': 1, 'Số hồ sơ': 'SH-10', 'Tình trạng': 'Hoàn thành',
      'Tệp đính kèm': JSON.stringify([{ fileId: 'aaa' }, { fileId: 'bbb' }]) })
    refresh()
    const rows = _buildCatalogRows(1)
    const l = rows.find(r => r[2] === 'L')
    expect(l[7]).toBe('https://drive.google.com/file/d/aaa/view\nhttps://drive.google.com/file/d/bbb/view')
    const a = rows.find(r => r[2] === 'A')
    expect(a[7]).toBe('')
  })

  test('cột Link google drive: 1 file → công thức HYPERLINK bấm được', () => {
    pushDoc({ ID: 11, 'Tên hồ sơ': 'One', 'Danh mục': 1, 'Số hồ sơ': 'SH-12', 'Tình trạng': 'Hoàn thành',
      'Tệp đính kèm': JSON.stringify([{ fileId: 'xyz' }]) })
    refresh()
    const rows = _buildCatalogRows(1)
    const r = rows.find(x => x[2] === 'One')
    expect(r[7]).toBe('=HYPERLINK("https://drive.google.com/file/d/xyz/view","https://drive.google.com/file/d/xyz/view")')
  })

  test('cột Link google drive: định dạng cũ (fileId chuỗi đơn) → HYPERLINK 1 file', () => {
    pushDoc({ ID: 10, 'Tên hồ sơ': 'Legacy', 'Danh mục': 1, 'Số hồ sơ': 'SH-11', 'Tình trạng': 'Hoàn thành',
      'Tệp đính kèm': 'plainFileId123' })
    refresh()
    const rows = _buildCatalogRows(1)
    const r = rows.find(x => x[2] === 'Legacy')
    expect(r[7]).toBe('=HYPERLINK("https://drive.google.com/file/d/plainFileId123/view","https://drive.google.com/file/d/plainFileId123/view")')
  })

  test('cột Danh mục là đường dẫn từ danh mục được chọn xuống (Cha / Con)', () => {
    const rows = _buildCatalogRows(1)
    const b = rows.find(r => r[2] === 'B') // doc thuộc danh mục con (ID 2)
    expect(b[5]).toBe('Hợp đồng / Hợp đồng con')
  })

  test('đường dẫn dừng ở danh mục được chọn, không truy ngược lên trên nó', () => {
    pushCat(4, 'Hợp đồng cháu', 2) // cháu của 1, con của 2
    pushDoc({ ID: 7, 'Tên hồ sơ': 'G', 'Danh mục': 4, 'Số hồ sơ': 'SH-50', 'Tình trạng': 'Hoàn thành' })
    refresh()
    const rows = _buildCatalogRows(2) // xuất từ danh mục con (ID 2)
    const g = rows.find(r => r[2] === 'G')
    expect(g[5]).toBe('Hợp đồng con / Hợp đồng cháu') // không có 'Hợp đồng' ở đầu
    const b = rows.find(r => r[2] === 'B')
    expect(b[5]).toBe('Hợp đồng con')
  })

  test('chọn danh mục gốc → đường dẫn đầy đủ nhiều cấp (Ông / Cha / Cháu)', () => {
    pushCat(4, 'Hợp đồng cháu', 2) // cháu của 1, con của 2
    pushDoc({ ID: 7, 'Tên hồ sơ': 'G', 'Danh mục': 4, 'Số hồ sơ': 'SH-50', 'Tình trạng': 'Hoàn thành' })
    refresh()
    const rows = _buildCatalogRows(1) // xuất từ danh mục gốc (ID 1)
    const g = rows.find(r => r[2] === 'G')
    expect(g[5]).toBe('Hợp đồng / Hợp đồng con / Hợp đồng cháu')
  })

  test('hồ sơ ngay tại danh mục được chọn → đường dẫn chỉ là tên danh mục đó', () => {
    const rows = _buildCatalogRows(1)
    const a = rows.find(r => r[2] === 'A') // doc ở chính danh mục 1
    expect(a[5]).toBe('Hợp đồng')
  })

  test('chỉ lấy đúng danh mục được chọn + con, không lấy danh mục khác', () => {
    const rows = _buildCatalogRows(3) // 'Báo cáo' — chỉ doc 4 (D), Hoàn thành
    expect(rows.map(r => r[2])).toEqual(['D'])
  })

  test('Số hồ sơ rỗng xếp cuối', () => {
    pushDoc({ ID: 6, 'Tên hồ sơ': 'E', 'Danh mục': 1, 'Số hồ sơ': '', 'Tình trạng': 'Hoàn thành' })
    refresh()
    const rows = _buildCatalogRows(1)
    expect(rows[rows.length - 1][2]).toBe('E')
  })
})

// ── _categoryPathMap: đường dẫn & chống lỗi dữ liệu cha-con ──────────────────
describe('_categoryPathMap — robustness', () => {
  test('cha tham chiếu danh mục không tồn tại → dừng an toàn, không treo', () => {
    pushCat(1, 'Gốc', '')
    pushCat(2, 'Con', 999) // cha 999 không có thật
    refresh()
    const m = _categoryPathMap('') // không giới hạn điểm dừng
    expect(m['1']).toBe('Gốc')
    expect(m['2']).toBe('Con') // chỉ chính nó, bỏ qua cha mồ côi
  })

  test('vòng lặp cha-con không gây treo, mỗi danh mục xuất hiện đúng 1 lần', () => {
    pushCat(1, 'A', 2) // A ⟶ cha B
    pushCat(2, 'B', 1) // B ⟶ cha A
    refresh()
    const m = _categoryPathMap('')
    expect(m['1'].split(' / ')).toEqual(['B', 'A'])
    expect(m['2'].split(' / ')).toEqual(['A', 'B'])
  })
})

// ── US1: sinh file .xlsx + dọn sheet tạm ────────────────────────────────────
describe('exportCatalog — sinh file & dọn sheet tạm', () => {
  beforeEach(() => {
    pushCat(1, 'Hợp đồng', '')
    pushDoc({ ID: 1, 'Tên hồ sơ': 'A', 'Danh mục': 1, 'Số hồ sơ': 'SH-01', 'Tình trạng': 'Hoàn thành' })
    refresh()
  })

  test('trả base64 + fileName + count; sheet tạm bị trashed', () => {
    const res = exportCatalog('tok', 1)
    expect(res.count).toBe(1)
    expect(typeof res.base64).toBe('string')
    expect(res.base64.length).toBeGreaterThan(0)
    expect(res.mimeType).toContain('spreadsheetml')
    expect(res.fileName).toMatch(/^danh-muc-ho-so-.*\.xlsx$/)
    const created = Object.values(DriveApp._files).filter(f => /^created-ss-/.test(f.id))
    expect(created.length).toBeGreaterThan(0)
    expect(created.every(f => f.trashed === true)).toBe(true)
  })

  test('thiếu danh mục (bắt buộc) → ném lỗi, không tạo file', () => {
    expect(() => exportCatalog('tok', '')).toThrow('Vui lòng chọn danh mục')
    const created = Object.values(DriveApp._files).filter(f => /^created-ss-/.test(f.id))
    expect(created.length).toBe(0)
  })

  test('chỉ có hồ sơ Nháp → ném lỗi, không tạo file', () => {
    SpreadsheetApp._sheets[SHEETS.HO_SO]._rows = [DOC_HEADERS.slice()]
    pushDoc({ ID: 9, 'Tên hồ sơ': 'Nháp 1', 'Danh mục': 1, 'Số hồ sơ': 'SH-01', 'Tình trạng': 'Nháp' })
    refresh()
    expect(() => exportCatalog('tok', 1)).toThrow('Không có hồ sơ để xuất')
    const created = Object.values(DriveApp._files).filter(f => /^created-ss-/.test(f.id))
    expect(created.length).toBe(0)
  })

  test('export thất bại (HTTP != 200) vẫn dọn sheet tạm', () => {
    const prev = UrlFetchApp._nextResponse
    UrlFetchApp._nextResponse = { code: 500, headers: {}, body: 'err' }
    try {
      expect(() => exportCatalog('tok', 1)).toThrow('Không tạo được file Excel')
      const created = Object.values(DriveApp._files).filter(f => /^created-ss-/.test(f.id))
      expect(created.length).toBeGreaterThan(0)
      expect(created.every(f => f.trashed === true)).toBe(true)
    } finally {
      UrlFetchApp._nextResponse = prev
    }
  })
})

// ── US2: phân quyền (server) ────────────────────────────────────────────────
describe('api_exportCatalog — phân quyền', () => {
  beforeEach(() => {
    pushCat(1, 'Hợp đồng', '')
    pushDoc({ ID: 1, 'Tên hồ sơ': 'A', 'Danh mục': 1, 'Số hồ sơ': 'SH-01', 'Tình trạng': 'Hoàn thành' })
    refresh()
  })
  const tok = (role) => createSession(1, 'u', 'u@test.com', role)

  test('Văn thư / admin / Quản trị viên / Giám đốc được phép', () => {
    ['Văn thư', 'admin', 'Quản trị viên', 'Giám đốc'].forEach(role => {
      const r = api_exportCatalog(tok(role), 1)
      expect(r.success).toBe(true)
      expect(r.payload.count).toBe(1)
    })
  })

  test('Nhân viên / Trưởng phòng bị chặn', () => {
    ['Nhân viên', 'Trưởng phòng'].forEach(role => {
      const r = api_exportCatalog(tok(role), 1)
      expect(r.success).toBe(false)
      expect(r.error).toContain('Không có quyền')
    })
  })
})
