require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets } = require('./helpers')

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
})

// Dựng body phản hồi gviz từ danh sách object hồ sơ.
function gvizBody(docs, status) {
  const cols = HO_SO_HEADERS.map(label => ({ label }))
  const rows = docs.map(d => ({ c: HO_SO_HEADERS.map(h => ({ v: d[h] != null ? d[h] : null })) }))
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

// 014: map cột hardcode từ DOC_COLS_DEF (config.js) — không đọc header sống.
describe('DOC_COLS_DEF — literal letter↔tên', () => {
  // tự tính chữ cái từ chỉ số để bắt lỗi gõ nhầm letter trong literal (chỉ dùng trong test).
  function colLetter(i) { var n = i + 1, s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }
  test('chữ cái mỗi dòng đúng vị trí của nó', () => {
    DOC_COLS_DEF.forEach((p, i) => expect(p[0]).toBe(colLetter(i)))
  })
  test('letter dịch đúng theo thứ tự cột thật của sheet', () => {
    const cols = _docColLetters()
    expect(cols['Người được xem']).toBe('X')
    expect(cols['Nội dung phối hợp']).toBe('Y')
    expect(cols['Hạng ưu tiên']).toBe('Z')
    expect(cols['Token xem']).toBe('AA')
    expect(cols['Blob tìm kiếm']).toBe('AB')
    expect(cols['Người kiểm soát']).toBe('AC')   // cuối sheet (khớp thứ tự thật)
    expect(cols['Tình trạng']).toBe('L')
  })
  test('HO_SO_HEADERS khớp DOC_COLS_DEF', () => {
    expect(HO_SO_HEADERS).toEqual(DOC_COLS_DEF.map(p => p[1]))
  })
})

describe('_assertDocColsOrder — guard lệch cột', () => {
  test('header khớp DOC_COLS_DEF → không throw', () => {
    SpreadsheetApp._addSheet(SHEETS.HO_SO, [HO_SO_HEADERS.slice()])
    expect(() => _assertDocColsOrder()).not.toThrow()
  })
  test('header lệch thứ tự → throw nêu vị trí', () => {
    const bad = HO_SO_HEADERS.slice(); bad[24] = 'Người được xem'  // cột Y phải là "Nội dung phối hợp" → lệch
    SpreadsheetApp._addSheet(SHEETS.HO_SO, [bad])
    expect(() => _assertDocColsOrder()).toThrow('sai thứ tự cột')
  })
})

describe('_buildDocListQuery', () => {
  test('full quyền: có guard Nháp + ORDER/LIMIT, KHÔNG có token', () => {
    const tq = _buildDocListQuery({ role: 'Giám đốc', userId: 1, username: 'gd' }, {}, null, 1)
    expect(tq).toContain("L != 'Nháp' or L is null or R = 'gd'")
    expect(tq).toContain('order by Z asc, Q desc, A desc')    // Hạng ưu tiên = Z
    expect(tq).toContain('limit ' + (DOC_PAGE_SIZE + 1) + ' offset 0')
    expect(tq).not.toContain('AA contains')                   // full quyền: không có token (Token xem = AA)
  })
  test('vai trò thường: lọc theo userId (token đã map về id, delimiter |)', () => {
    const tq = _buildDocListQuery({ role: 'Nhân viên', userId: 5, username: 'nv@x.com' }, {}, null, 1)
    expect(tq).toContain("AA contains '|5|'")                 // Token xem = AA
    expect(tq).not.toContain("AA contains '|nv@x.com|'") // token KHÔNG lọc theo username (chỉ draftGuard R= dùng)
  })
  test('keyword → blob contains (đã bỏ dấu)', () => {
    const tq = _buildDocListQuery({ role: 'Nhân viên', userId: 5, username: 'nv' }, { keyword: 'Kế hoạch' }, null, 1)
    expect(tq).toContain("AB contains 'ke hoach'")            // Blob tìm kiếm = AB
  })
  test('username chứa nháy đơn → bọc bằng nháy kép (gviz KHÔNG doubling)', () => {
    const tq = _buildDocListQuery({ role: 'Nhân viên', userId: 5, username: "o'brien" }, {}, null, 1)
    expect(tq).toContain('R = "o\'brien"')
  })
  test('keyword chứa nháy đơn → blob contains bọc nháy kép (không PARSE_ERROR "full\'")', () => {
    const tq = _buildDocListQuery({ role: 'Nhân viên', userId: 5, username: 'nv' }, { keyword: "full'" }, null, 1)
    expect(tq).toContain('AB contains "full\'"')
    expect(tq).not.toContain("''")            // KHÔNG còn doubling sai cú pháp gviz
  })
  test('danh mục → chuỗi OR (gviz không có IN), khớp cả số lẫn chuỗi', () => {
    const tq = _buildDocListQuery({ role: 'Giám đốc', userId: 1, username: 'gd' }, { danhMucId: 1 }, ['1', '2'], 1)
    expect(tq).not.toContain(' in (')
    expect(tq).toContain("(C = 1 or C = '1')")
    expect(tq).toContain("(C = 2 or C = '2')")
  })
  test('offset theo trang', () => {
    const tq = _buildDocListQuery({ role: 'Giám đốc', userId: 1, username: 'gd' }, {}, null, 2)
    expect(tq).toContain('limit ' + (DOC_PAGE_SIZE + 1) + ' offset ' + DOC_PAGE_SIZE)
  })
})

describe('_gvizQueryBuilder', () => {
  const cols = { 'ID': 'A', 'Tình trạng': 'L' }
  test('where AND + order + limit/offset; select mặc định *', () => {
    const q = _gvizQueryBuilder(cols).where('A = 1').where('L = 2').orderBy('ID', 'desc').limit(5).offset(10).build()
    expect(q).toBe('select * where A = 1 and L = 2 order by A desc limit 5 offset 10')
  })
  test('select + groupBy; bỏ qua where null', () => {
    const q = _gvizQueryBuilder(cols).select('L, count(A)').where(null).groupBy('Tình trạng').build()
    expect(q).toBe('select L, count(A) group by L')
  })
  test('lit() chọn dấu bọc theo nội dung (gviz KHÔNG escape doubling)', () => {
    expect(_gvizQueryBuilder(cols).lit('abc')).toBe("'abc'")            // không nháy → bọc '
    expect(_gvizQueryBuilder(cols).lit("o'brien")).toBe('"o\'brien"')   // có ' → bọc "
    expect(_gvizQueryBuilder(cols).lit('say "hi"')).toBe("'say \"hi\"'") // có " → bọc '
    expect(_gvizQueryBuilder(cols).lit('o\'clock "x"')).toBe('\'oclock "x"\'') // cả hai → bỏ ' rồi bọc '
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
  test('trang vượt quá tổng → trả rỗng, GIỮ số trang (client lo UX, không snap)', () => {
    setGviz(200, gvizBody([]))
    const r = _queryDocPage(ctx, { page: 5 })
    expect(r.page).toBe(5)
    expect(r.data.length).toBe(0)
    expect(r.hasNext).toBe(false)
  })
  test('lỗi HTTP → ném Error (FR-018)', () => {
    setGviz(401, '')
    expect(() => _queryDocPage(ctx, { page: 1 })).toThrow('Lỗi tải danh sách')
  })
  test('lỗi truy vấn gviz → ném Error', () => {
    setGviz(200, gvizBody([], 'error'))
    expect(() => _queryDocPage(ctx, { page: 1 })).toThrow('Lỗi truy vấn nguồn')
  })
  test('URL gviz có cache-buster _cb (luôn lấy tươi)', () => {
    setGviz(200, gvizBody(makeDocs(1)))
    _queryDocPage(ctx, { page: 1 })
    expect(UrlFetchApp._lastRequest.url).toContain('_cb=')
  })
})
