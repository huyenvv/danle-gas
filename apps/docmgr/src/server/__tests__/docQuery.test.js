require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets } = require('./helpers')

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
})

// Dựng body phản hồi gviz từ danh sách object hồ sơ.
function gvizBody(docs, status) {
  const cols = DOC_QUERY_HEADERS.map(label => ({ label }))
  const rows = docs.map(d => ({ c: DOC_QUERY_HEADERS.map(h => ({ v: d[h] != null ? d[h] : null })) }))
  const obj = status === 'error'
    ? { status: 'error', errors: [{ detailed_message: 'bad query' }] }
    : { status: 'ok', table: { cols, rows } }
  return "/*O_o*/\ngoogle.visualization.Query.setResponse(" + JSON.stringify(obj) + ');'
}
function setGviz(code, body) { UrlFetchApp._nextResponse = { code: code, body: body } }
function makeDocs(n) {
  const out = []
  for (let i = 1; i <= n; i++) out.push({ ID: i, 'Tên hồ sơ': 'Doc ' + i })
  return out
}

describe('_colLetter', () => {
  test('0→A, 25→Z, 26→AA, 27→AB', () => {
    expect(_colLetter(0)).toBe('A')
    expect(_colLetter(25)).toBe('Z')
    expect(_colLetter(26)).toBe('AA')
    expect(_colLetter(27)).toBe('AB')
  })
})

describe('_sheetCols — chữ cái theo thứ tự HÀNG TIÊU ĐỀ THẬT (fix lệch cột)', () => {
  test('Token xem KHÔNG ở AA khi sheet có cột thêm/đảo thứ tự', () => {
    // Mô phỏng sheet thật: thêm "Nhóm được xem" + đảo Người được xem/Nội dung phối hợp
    const realHdr = [
      'ID', 'Tên hồ sơ', 'Danh mục', 'Ngày ban hành', 'Ngày kết thúc', 'Tệp đính kèm', 'Tên file',
      'Số hồ sơ', 'Dự án (Phòng ban)', 'Nhà cung cấp (Nơi ban hành)', 'Giá trị HĐ', 'Tình trạng',
      'Phụ trách', 'Người phối hợp', 'Ghi chú', 'Nơi lưu hồ sơ cứng', 'Ngày cập nhật', 'Người tạo',
      'Người cập nhật', 'Lịch sử phát hành', 'Lý do từ chối', 'Khẩn', 'Nội dung giao việc',
      'Người được xem', 'Nhóm được xem', 'Nội dung phối hợp', 'Hạng ưu tiên', 'Token xem', 'Blob tìm kiếm',
    ]
    SpreadsheetApp._addSheet(SHEETS.HO_SO, [realHdr])
    const cols = _sheetCols()
    expect(cols['Hạng ưu tiên']).toBe('AA')   // index 26
    expect(cols['Token xem']).toBe('AB')      // index 27 — KHÔNG phải AA
    expect(cols['Blob tìm kiếm']).toBe('AC')  // index 28
    expect(cols['Tình trạng']).toBe('L')
    // _buildDocTq dùng cols thật → lọc token đúng cột AB
    const tq = _buildDocTq({ role: 'Nhân viên', userId: 21, username: 'nv' }, {}, null, 1, cols)
    expect(tq).toContain("AB contains '|21|'")
  })
})

describe('_buildDocTq', () => {
  test('full quyền: có guard Nháp + ORDER/LIMIT, KHÔNG có token', () => {
    const tq = _buildDocTq({ role: 'Giám đốc', userId: 1, username: 'gd' }, {}, null, 1)
    expect(tq).toContain("L != 'Nháp' or L is null or R = 'gd'")
    expect(tq).toContain('order by Z asc, Q desc, A desc')
    expect(tq).toContain('limit ' + (DOC_PAGE_SIZE + 1) + ' offset 0')
    expect(tq).not.toContain('AA contains')
  })
  test('vai trò thường: lọc theo userId (token đã map về id, delimiter |)', () => {
    const tq = _buildDocTq({ role: 'Nhân viên', userId: 5, username: 'nv@x.com' }, {}, null, 1)
    expect(tq).toContain("AA contains '|5|'")
    expect(tq).not.toContain("AA contains '|nv@x.com|'") // token KHÔNG lọc theo username (chỉ draftGuard R= dùng)
  })
  test('keyword → blob contains (đã bỏ dấu)', () => {
    const tq = _buildDocTq({ role: 'Nhân viên', userId: 5, username: 'nv' }, { keyword: 'Kế hoạch' }, null, 1)
    expect(tq).toContain("AB contains 'ke hoach'")
  })
  test('escape nháy đơn trong username', () => {
    const tq = _buildDocTq({ role: 'Nhân viên', userId: 5, username: "o'brien" }, {}, null, 1)
    expect(tq).toContain("R = 'o''brien'")
  })
  test('danh mục → chuỗi OR (gviz không có IN), khớp cả số lẫn chuỗi', () => {
    const tq = _buildDocTq({ role: 'Giám đốc', userId: 1, username: 'gd' }, { danhMucId: 1 }, ['1', '2'], 1)
    expect(tq).not.toContain(' in (')
    expect(tq).toContain("(C = 1 or C = '1')")
    expect(tq).toContain("(C = 2 or C = '2')")
  })
  test('offset theo trang', () => {
    const tq = _buildDocTq({ role: 'Giám đốc', userId: 1, username: 'gd' }, {}, null, 2)
    expect(tq).toContain('limit ' + (DOC_PAGE_SIZE + 1) + ' offset ' + DOC_PAGE_SIZE)
  })
})

describe('_parseGvizResponse', () => {
  test('bóc setResponse → table', () => {
    const table = _parseGvizResponse(gvizBody(makeDocs(2)))
    expect(table.rows.length).toBe(2)
  })
  test('status error → throw', () => {
    expect(() => _parseGvizResponse(gvizBody([], 'error'))).toThrow('Lỗi truy vấn nguồn')
  })
  test('body rác → throw', () => {
    expect(() => _parseGvizResponse('not json at all')).toThrow('không hợp lệ')
  })
})

describe('_gvizRowsToDocs', () => {
  test('map theo nhãn cột; ô null → rỗng', () => {
    const table = { cols: [{ label: 'ID' }, { label: 'Tên hồ sơ' }], rows: [{ c: [{ v: 7 }, { v: null }] }] }
    const docs = _gvizRowsToDocs(table)
    expect(docs[0]['ID']).toBe(7)
    expect(docs[0]['Tên hồ sơ']).toBe('')
  })
  test('ô ngày "Date(y,m,d)" → YYYY-MM-DD (tháng +1)', () => {
    const table = { cols: [{ label: 'Ngày ban hành' }, { label: 'Ngày cập nhật' }],
      rows: [{ c: [{ v: 'Date(2026,5,20)' }, { v: 'Date(2026,5,27,9,30,0)' }] }] }
    const docs = _gvizRowsToDocs(table)
    expect(docs[0]['Ngày ban hành']).toBe('2026-06-20')          // tháng 5 (0-based) → 06
    expect(docs[0]['Ngày cập nhật']).toBe('2026-06-27 09:30:00')
  })
})

describe('_queryDocPage', () => {
  const ctx = { role: 'Giám đốc', userId: 1, username: 'gd' }
  test('dư 1 dòng → hasNext true, trả đúng page size', () => {
    setGviz(200, gvizBody(makeDocs(DOC_PAGE_SIZE + 1)))
    const r = _queryDocPage(ctx, { page: 1 })
    expect(r.data.length).toBe(DOC_PAGE_SIZE)
    expect(r.hasNext).toBe(true)
    expect(r.page).toBe(1)
  })
  test('ít hơn page size → hasNext false', () => {
    setGviz(200, gvizBody(makeDocs(DOC_PAGE_SIZE - 1)))
    const r = _queryDocPage(ctx, { page: 1 })
    expect(r.data.length).toBe(DOC_PAGE_SIZE - 1)
    expect(r.hasNext).toBe(false)
  })
  test('FR-011: trang vượt quá (rỗng) → snap về trang 1', () => {
    setGviz(200, gvizBody([]))
    const r = _queryDocPage(ctx, { page: 5 })
    expect(r.page).toBe(1)
    expect(r.data.length).toBe(0)
  })
  test('lỗi HTTP → ném Error (FR-018)', () => {
    setGviz(401, '')
    expect(() => _queryDocPage(ctx, { page: 1 })).toThrow('Lỗi tải danh sách')
  })
  test('lỗi truy vấn gviz → ném Error', () => {
    setGviz(200, gvizBody([], 'error'))
    expect(() => _queryDocPage(ctx, { page: 1 })).toThrow('Lỗi truy vấn nguồn')
  })
})
