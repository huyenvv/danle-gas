require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, DOC_HEADERS, seedUser } = require('./helpers')

// HO_SO với 3 cột tính sẵn (012) để test backfill ghi thật.
const DOC_HEADERS_V13 = DOC_HEADERS.concat(['Hạng ưu tiên', 'Token xem', 'Blob tìm kiếm'])

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  // username/email → resolve về userId qua _Phân Quyền (nguồn local)
  seedUser(10, 'alice', 'a@test.com', 'Nhân viên')
  seedUser(20, 'b@x.com', 'b@x.com', 'Nhân viên')
})

describe('_docSearchBlob', () => {
  test('gộp 7 trường, bỏ dấu + lowercase', () => {
    const blob = _docSearchBlob({
      'Tên hồ sơ': 'Kế hoạch', 'Số hồ sơ': 'SỐ-01', 'Dự án (Phòng ban)': 'Phòng A',
      'Nhà cung cấp (Nơi ban hành)': 'NCC X', 'Ghi chú': 'Đặc biệt', 'Phụ trách': '["20"]', 'Tên file': 'tep.pdf',
    })
    expect(blob).toContain('ke hoach')
    expect(blob).toContain('dac biet')
    expect(blob).toContain('tep.pdf')
    expect(blob).toBe(blob.toLowerCase())
  })
})

describe('_docViewToken — map về userId, nội dung phụ thuộc Tình trạng (FR-014a)', () => {
  // alice→10, b@x.com→20 (seeded); '25'/'30' không seed → giữ thô (vẫn là id).
  const base = {
    'Người tạo': 'alice', 'Phụ trách': '["b@x.com"]', 'Người phối hợp': '["25"]', 'Người được xem': '["30"]',
  }
  test('Nháp → chỉ Người tạo (đã map về id)', () => {
    expect(_docViewToken(Object.assign({}, base, { 'Tình trạng': 'Nháp' }))).toBe('|10|')
  })
  test('Chưa hoàn thành → tạo + PT + PH (không Người được xem)', () => {
    expect(_docViewToken(Object.assign({}, base, { 'Tình trạng': 'Chờ duyệt' }))).toBe('|10|20|25|')
  })
  test('Hoàn thành → tạo + PT + PH + Người được xem', () => {
    expect(_docViewToken(Object.assign({}, base, { 'Tình trạng': 'Hoàn thành' }))).toBe('|10|20|25|30|')
  })
  test('email được map về id (b@x.com → 20)', () => {
    expect(_docViewToken({ 'Tình trạng': 'Nháp', 'Người tạo': 'b@x.com' })).toBe('|20|')
  })
  test('định danh không resolve được → giữ thô, vẫn an toàn nhờ delimiter |', () => {
    const tok = _docViewToken({ 'Tình trạng': 'Nháp', 'Người tạo': 'hco_nhanvien_12@gmail.com' })
    expect(tok).toBe('|hco_nhanvien_12@gmail.com|')
    expect(tok.indexOf('|12|')).toBe(-1) // userId 12 KHÔNG khớp nhầm trong email chứa "_12"
  })
})

describe('_docDerivedColumns', () => {
  test('rank: Hoàn thành + Phụ trách + phát hành → nhóm 1 (FR-004)', () => {
    const cols = _docDerivedColumns({
      'Tình trạng': 'Hoàn thành', 'Phụ trách': '["20"]', 'Lịch sử phát hành': '[{"at":"x"}]', 'Người tạo': 'alice',
    })
    expect(cols['Hạng ưu tiên']).toBe(1)
  })
  test('trả đủ 3 cột', () => {
    const cols = _docDerivedColumns({ 'Tình trạng': 'Chờ duyệt', 'Người tạo': 'alice', 'Tên hồ sơ': 'Kế hoạch' })
    expect(cols['Hạng ưu tiên']).toBe(0)
    expect(cols['Token xem']).toBe('|10|')
    expect(cols['Blob tìm kiếm']).toContain('ke hoach')
  })
})

describe('backfillDocDerived — idempotent (FR-007)', () => {
  beforeEach(() => {
    // Thay HO_SO bằng bản có 3 cột tính sẵn để ghi thật
    SpreadsheetApp._addSheet(SHEETS.HO_SO, [DOC_HEADERS_V13])
    const sheet = SpreadsheetApp._sheets[SHEETS.HO_SO]
    // 1 hồ sơ Hoàn thành của alice, có người được xem 30
    const row = new Array(DOC_HEADERS_V13.length).fill('')
    row[0] = 1; row[DOC_HEADERS_V13.indexOf('Tên hồ sơ')] = 'Kế hoạch'
    row[DOC_HEADERS_V13.indexOf('Tình trạng')] = 'Hoàn thành'
    row[DOC_HEADERS_V13.indexOf('Người tạo')] = 'alice'
    row[DOC_HEADERS_V13.indexOf('Người được xem')] = '["30"]'
    sheet._rows.push(row)
    invalidateSheetCache(SHEETS.HO_SO)
  })
  test('nạp 3 cột cho hồ sơ cũ; chạy lại không đổi', () => {
    backfillDocDerived()
    let docs = getSheetData(SHEETS.HO_SO)
    expect(docs[0]['Hạng ưu tiên']).toBe(3) // Hoàn thành, không PT, không phát hành
    expect(docs[0]['Token xem']).toBe('|10|30|') // Người tạo (alice→10) + Người được xem (30 thô)
    expect(docs[0]['Blob tìm kiếm']).toContain('ke hoach')

    const before = JSON.stringify(getSheetData(SHEETS.HO_SO))
    backfillDocDerived() // cờ đã set → early return
    expect(JSON.stringify(getSheetData(SHEETS.HO_SO))).toBe(before)
  })
})
