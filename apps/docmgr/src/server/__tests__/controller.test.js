// Feature 013 — Người kiểm soát (controller). Covers:
//  - giaoViec ghi NKS + NKS vào CC email giao việc chung (US1)
//  - ksThemPhoiHop: thêm PH chỉ-thêm, không đổi trạng thái, chặn xoá PH/đổi PT (US2)
//  - quyền NKS: xacNhanHT/tuChoiKetQua; bị chặn trên hồ sơ không gán; không có giaoViec (US2)
//  - email giao việc: đoạn [[...]] hiện khi có NKS, ẩn khi không (US3)
//  - SC-005: hồ sơ không NKS không đổi hành vi
require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, seedUser, createSession } = require('./helpers')

const PARENT_ID = 'parent-sso-sheet-id'

function setupSSOParent() {
  SpreadsheetApp._addExternalSheet(PARENT_ID, '_Hệ Thống', [
    ['Key', 'Value'],
    ['MAIL_ENABLED', true],
    ['MAIL_SENDER_NAME', 'Test System'],
  ])
  SpreadsheetApp._addExternalSheet(PARENT_ID, '_Người Dùng', [
    ['ID', 'Tên đăng nhập', 'Email', 'Tên nhân viên', 'Trạng thái', 'Mật khẩu', 'Quyền'],
    [1, 'vanthu', 'vanthu@test.com', 'Nguyễn Văn Thư', 'Active', '', ''],
    [2, 'giamdoc', 'giamdoc@test.com', 'Trần Giám Đốc', 'Active', '', ''],
    [3, 'phutrach', 'pt@test.com', 'Phụ Trách', 'Active', '', ''],
    [4, 'ksoat', 'ks@test.com', 'Kiểm Soát', 'Active', '', ''],
    [5, 'phoihopA', 'a@test.com', 'PH A', 'Active', '', ''],
    [6, 'phoihopB', 'b@test.com', 'PH B', 'Active', '', ''],
  ])
  // Chức vụ: GĐ=2; NKS (user 4) chức vụ Trưởng phòng để kiểm tra {vaiTròNgườiKiểmSoát}
  SpreadsheetApp._addExternalSheet(PARENT_ID, '_Phân Bổ', [
    ['ID', 'UserID', 'Chức vụ', 'PhongBanID'],
    [1, 2, 'Giám đốc', ''],
    [2, 4, 'Trưởng phòng', ''],
  ])
  PropertiesService.getScriptProperties().setProperty('SSO_PARENT_SHEET_ID', PARENT_ID)
}

let vanthuToken, directorToken, ksToken, ptToken

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  seedUser(1, 'vanthu', 'vanthu@test.com', 'Văn thư')
  seedUser(2, 'giamdoc', 'giamdoc@test.com', 'Giám đốc')
  seedUser(3, 'phutrach', 'pt@test.com', 'Nhân viên')
  seedUser(4, 'ksoat', 'ks@test.com', 'Nhân viên')
  seedUser(5, 'phoihopA', 'a@test.com', 'Nhân viên')
  seedUser(6, 'phoihopB', 'b@test.com', 'Nhân viên')
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push([1, 'Hợp đồng', '', '', '', '', ''])
  invalidateSheetCache(SHEETS.DANH_MUC)
  vanthuToken = createSession(1, 'vanthu', 'vanthu@test.com', 'Văn thư')
  directorToken = createSession(2, 'giamdoc', 'giamdoc@test.com', 'Giám đốc')
  ptToken = createSession(3, 'phutrach', 'pt@test.com', 'Nhân viên')
  ksToken = createSession(4, 'ksoat', 'ks@test.com', 'Nhân viên')
  setupSSOParent()
})

// Tạo hồ sơ Chờ duyệt rồi GĐ giao việc (PT=3) — tuỳ chọn NKS.
function seedAssigned(opts) {
  opts = opts || {}
  createDocument(vanthuToken, { 'Tên hồ sơ': 'HĐ NKS', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt' }, null)
  invalidateSheetCache(SHEETS.HO_SO)
  const data = { 'Phụ trách': 3, 'Nội dung': 'GĐ giao' }
  if (opts.nks !== undefined) data['Người kiểm soát'] = opts.nks
  if (opts.phoiHop) data['Người phối hợp'] = opts.phoiHop
  transitionDocument(directorToken, 1, 'giaoViec', data)
  invalidateSheetCache(SHEETS.HO_SO)
  GmailApp._sent = []
}

describe('US1 — giaoViec ghi NKS + NKS vào CC email giao việc chung', () => {
  test('GĐ giao việc có NKS → lưu NKS, NKS nhận chuông + nằm trong CC email giao việc (KHÔNG mail riêng)', () => {
    createDocument(vanthuToken, { 'Tên hồ sơ': 'HĐ A', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    GmailApp._sent = []

    const r = transitionDocument(directorToken, 1, 'giaoViec', { 'Phụ trách': 3, 'Nội dung': 'GĐ giao', 'Người kiểm soát': 4 })

    expect(r.data['Người kiểm soát']).toBe(JSON.stringify(['4']))
    // Không còn email riêng [Kiểm soát]
    expect(GmailApp._sent.some(m => m.subject.includes('[Kiểm soát]'))).toBe(false)
    // NKS nằm trong CC của email giao việc chung
    const gv = GmailApp._sent.find(m => m.subject.includes('[Giao việc]'))
    expect(gv).toBeTruthy()
    expect(gv.options.cc || '').toContain('ks@test.com')
    // NKS vẫn nhận chuông
    const daDoc = getSheetData(SHEETS.DA_DOC)
    expect(daDoc.some(r2 => String(r2['UserID']) === '4' && String(r2['DocID']) === '1')).toBe(true)
  })

  test('giao việc KHÔNG có NKS → không lưu NKS, email giao việc không có NKS trong CC', () => {
    createDocument(vanthuToken, { 'Tên hồ sơ': 'HĐ B', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    GmailApp._sent = []

    const r = transitionDocument(directorToken, 1, 'giaoViec', { 'Phụ trách': 3, 'Nội dung': 'GĐ giao' })

    expect(r.data['Người kiểm soát'] || '').toBe('')
    expect(GmailApp._sent.some(m => m.subject.includes('[Kiểm soát]'))).toBe(false)
    const gv = GmailApp._sent.find(m => m.subject.includes('[Giao việc]'))
    expect(gv).toBeTruthy()
    expect(gv.options.cc || '').not.toContain('ks@test.com')
  })
})

describe('US3 — email giao việc: đoạn [[...]] theo điều kiện', () => {
  test('có NKS → email giaoViec chứa "trình duyệt qua Trưởng phòng - Kiểm Soát"', () => {
    createDocument(vanthuToken, { 'Tên hồ sơ': 'HĐ C', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    GmailApp._sent = []
    transitionDocument(directorToken, 1, 'giaoViec', { 'Phụ trách': 3, 'Nội dung': 'GĐ giao', 'Người kiểm soát': 4 })

    const gv = GmailApp._sent.find(m => m.subject.includes('[Giao việc]'))
    expect(gv).toBeTruthy()
    expect(gv.body).toContain('trình duyệt qua Trưởng phòng - Kiểm Soát')
    expect(gv.body).not.toContain('[[')
    expect(gv.body).not.toContain('{tênNgườiKiểmSoát}')
  })

  test('không NKS → email giaoViec KHÔNG có đoạn NKS, không còn {..}/[[ ]] (SC-005)', () => {
    createDocument(vanthuToken, { 'Tên hồ sơ': 'HĐ D', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    GmailApp._sent = []
    transitionDocument(directorToken, 1, 'giaoViec', { 'Phụ trách': 3, 'Nội dung': 'GĐ giao' })

    const gv = GmailApp._sent.find(m => m.subject.includes('[Giao việc]'))
    expect(gv).toBeTruthy()
    expect(gv.body).not.toContain('trình duyệt qua')
    expect(gv.body).not.toContain('[[')
    expect(gv.body).not.toContain('{tênNgườiKiểmSoát}')
    expect(gv.body).not.toContain('{vaiTròNgườiKiểmSoát}')
  })
})

describe('US2 — quyền & thao tác của Người kiểm soát', () => {
  test('NKS thêm phối hợp (ksThemPhoiHop) ở Chờ xử lý: thêm PH, KHÔNG đổi trạng thái, PH mới nhận phoiHop', () => {
    seedAssigned({ nks: 4 })
    // doc đang ở Chờ xử lý
    const r = transitionDocument(ksToken, 1, 'ksThemPhoiHop', { 'Người phối hợp': ['phoihopA'], 'Nội dung': 'NKS thêm PH' })

    expect(r.data['Tình trạng']).toBe('Chờ xử lý')              // không đổi trạng thái
    expect(r.data['Người phối hợp']).toBe(JSON.stringify(['phoihopA']))
    const ph = GmailApp._sent.find(m => m.subject.includes('[Phối hợp]'))
    expect(ph).toBeTruthy()
    expect(ph.to).toBe('a@test.com')
  })

  test('NKS thêm phối hợp ở Đang xử lý cũng được, không đổi trạng thái', () => {
    seedAssigned({ nks: 4 })
    transitionDocument(ptToken, 1, 'nhanViec', { 'Người phối hợp': [] })  // → Đang xử lý
    invalidateSheetCache(SHEETS.HO_SO)
    GmailApp._sent = []
    const r = transitionDocument(ksToken, 1, 'ksThemPhoiHop', { 'Người phối hợp': ['phoihopB'], 'Nội dung': 'thêm khi đang xử lý' })
    expect(r.data['Tình trạng']).toBe('Đang xử lý')
    expect(_parseAssignees(r.data['Người phối hợp'])).toContain('phoihopB')
  })

  test('NKS KHÔNG thể xoá người phối hợp đã có', () => {
    seedAssigned({ nks: 4, phoiHop: ['phoihopA'] })
    expect(() => transitionDocument(ksToken, 1, 'ksThemPhoiHop', { 'Người phối hợp': [], 'Nội dung': 'x' }))
      .toThrow(/Không thể xoá người phối hợp/)
  })

  test('NKS được xác nhận hoàn thành (xacNhanHT) thay GĐ', () => {
    seedAssigned({ nks: 4 })
    transitionDocument(ptToken, 1, 'nhanViec', { 'Người phối hợp': [] })   // Đang xử lý
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(ptToken, 1, 'hoanThanh')                            // Chờ xác nhận HT
    invalidateSheetCache(SHEETS.HO_SO)
    const r = transitionDocument(ksToken, 1, 'xacNhanHT')
    expect(r.data['Tình trạng']).toBe('Hoàn thành')
  })

  test('NKS KHÔNG có quyền giaoViec', () => {
    seedAssigned({ nks: 4 })
    transitionDocument(directorToken, 1, 'thuHoi')   // về Chờ duyệt
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => transitionDocument(ksToken, 1, 'giaoViec', { 'Phụ trách': 3, 'Nội dung': 'x' }))
      .toThrow(/không có quyền/i)
  })

  test('người không phải NKS không dùng được ksThemPhoiHop (FR-006)', () => {
    seedAssigned({ nks: 4 })
    const otherToken = createSession(6, 'phoihopB', 'b@test.com', 'Nhân viên')
    expect(() => transitionDocument(otherToken, 1, 'ksThemPhoiHop', { 'Người phối hợp': ['phoihopA'], 'Nội dung': 'x' }))
      .toThrow(/không có quyền/i)
  })

  test('NKS được tính là người xem hồ sơ — Token xem + _isParticipant gồm NKS', () => {
    seedAssigned({ nks: 4 })
    const doc = getSheetData(SHEETS.HO_SO).find(d => String(d['ID']) === '1')
    // Token xem (lọc danh sách server-side) phải chứa userId của NKS
    expect(_docViewToken(doc)).toContain('|4|')
    // _isParticipant true cho NKS → mở/được xem hồ sơ
    expect(_isParticipant(doc, { userId: 4, username: 'ksoat' })).toBe(true)
    // Người ngoài cuộc không phải participant
    expect(_isParticipant(doc, { userId: 99, username: 'nguoila' })).toBe(false)
  })

  test('NKS thấy hồ sơ qua getDocuments (RAM path)', () => {
    seedAssigned({ nks: 4 })
    const r = _getDocumentsInRam(ksToken, {})
    expect(r.data.some(d => String(d['ID']) === '1')).toBe(true)
  })

  test('NKS chọn bằng email/tên đăng nhập → LƯU theo userId (data-model)', () => {
    // Picker phát ra email/tên đăng nhập; server map sang userId khi lưu.
    seedAssigned({ nks: 'ks@test.com' })
    const doc = getSheetData(SHEETS.HO_SO).find(d => String(d['ID']) === '1')
    expect(doc['Người kiểm soát']).toBe(JSON.stringify(['4'])) // 'ks@test.com' → userId 4
    expect(_isController(doc, { userId: 4, username: 'ksoat' })).toBe(true)
    expect(_docViewToken(doc)).toContain('|4|')
    const r = transitionDocument(ksToken, 1, 'ksThemPhoiHop', { 'Người phối hợp': ['phoihopA'], 'Nội dung': 'x' })
    expect(r.data['Tình trạng']).toBe('Chờ xử lý')
  })

  test('NKS chọn bằng tên đăng nhập → cũng map sang userId', () => {
    seedAssigned({ nks: 'ksoat' })
    const doc = getSheetData(SHEETS.HO_SO).find(d => String(d['ID']) === '1')
    expect(doc['Người kiểm soát']).toBe(JSON.stringify(['4'])) // 'ksoat' → userId 4
  })

  test('NKS của hồ sơ A không có quyền trên hồ sơ B (FR-005)', () => {
    seedAssigned({ nks: 4 })  // doc 1, NKS=4
    // doc 2 không có NKS
    createDocument(vanthuToken, { 'Tên hồ sơ': 'HĐ 2', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(directorToken, 2, 'giaoViec', { 'Phụ trách': 3, 'Nội dung': 'GĐ giao' })
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => transitionDocument(ksToken, 2, 'ksThemPhoiHop', { 'Người phối hợp': ['phoihopA'], 'Nội dung': 'x' }))
      .toThrow(/không có quyền/i)
  })
})

describe('US2b — PT trình duyệt/trình duyệt lại → báo chuông cả GĐ lẫn NKS', () => {
  // Xoá hết DA_DOC (giữ header) để chỉ đo notify do bước đang test sinh ra.
  function clearUnread() {
    const da = SpreadsheetApp._sheets[SHEETS.DA_DOC]
    da._rows = [da._rows[0]]
    invalidateSheetCache(SHEETS.DA_DOC)
  }
  const isUnread = (uid) =>
    getSheetData(SHEETS.DA_DOC).some(r => String(r['UserID']) === String(uid) && String(r['DocID']) === '1')

  test('hoanThanh (trình duyệt) → NKS (4) + GĐ (2) đều có chuông', () => {
    seedAssigned({ nks: 4 })
    transitionDocument(ptToken, 1, 'nhanViec', { 'Người phối hợp': [] })  // → Đang xử lý
    invalidateSheetCache(SHEETS.HO_SO)
    clearUnread()
    transitionDocument(ptToken, 1, 'hoanThanh')                           // → Chờ xác nhận HT
    expect(isUnread(4)).toBe(true)   // NKS
    expect(isUnread(2)).toBe(true)   // GĐ
  })

  test('hoanThanhLai (trình duyệt lại) → NKS (4) + GĐ (2) đều có chuông', () => {
    seedAssigned({ nks: 4 })
    transitionDocument(ptToken, 1, 'nhanViec', { 'Người phối hợp': [] })  // → Đang xử lý
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(ptToken, 1, 'hoanThanh')                           // → Chờ xác nhận HT
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(ksToken, 1, 'tuChoiKetQua', { lyDoTuChoi: 'làm lại' }) // → Từ chối kết quả
    invalidateSheetCache(SHEETS.HO_SO)
    clearUnread()
    transitionDocument(ptToken, 1, 'hoanThanhLai')                        // → Chờ xác nhận HT
    expect(isUnread(4)).toBe(true)   // NKS
    expect(isUnread(2)).toBe(true)   // GĐ
  })

  test('không có NKS → hoanThanh chỉ báo GĐ (2), không tạo chuông NKS rỗng', () => {
    seedAssigned({})  // không gán NKS
    transitionDocument(ptToken, 1, 'nhanViec', { 'Người phối hợp': [] })
    invalidateSheetCache(SHEETS.HO_SO)
    clearUnread()
    transitionDocument(ptToken, 1, 'hoanThanh')
    expect(isUnread(2)).toBe(true)
    // không phát sinh bản ghi UserID rỗng
    expect(getSheetData(SHEETS.DA_DOC).some(r => String(r['UserID']) === '')).toBe(false)
  })
})

describe('US2c — tuChoiKetQua: email PT (TO) + CC GĐ', () => {
  // Đưa hồ sơ tới Chờ xác nhận HT (PT=3, NKS=4).
  function toAwaitingConfirm() {
    seedAssigned({ nks: 4 })
    transitionDocument(ptToken, 1, 'nhanViec', { 'Người phối hợp': [] })
    invalidateSheetCache(SHEETS.HO_SO)
    transitionDocument(ptToken, 1, 'hoanThanh')
    invalidateSheetCache(SHEETS.HO_SO)
  }

  test('NKS từ chối kết quả → email tới PT (pt@test.com), CC GĐ (giamdoc@test.com)', () => {
    toAwaitingConfirm()
    GmailApp._sent = []
    transitionDocument(ksToken, 1, 'tuChoiKetQua', { lyDoTuChoi: 'làm lại' })
    const mail = GmailApp._sent.find(m => (m.to || '').includes('pt@test.com'))
    expect(mail).toBeTruthy()
    expect(mail.options.cc || '').toContain('giamdoc@test.com')   // GĐ được CC
  })

  test('GĐ tự từ chối kết quả → GĐ (người thao tác, GĐ duy nhất) bị loại khỏi CC', () => {
    toAwaitingConfirm()
    GmailApp._sent = []
    transitionDocument(directorToken, 1, 'tuChoiKetQua', { lyDoTuChoi: 'làm lại' })
    const mail = GmailApp._sent.find(m => (m.to || '').includes('pt@test.com'))
    expect(mail).toBeTruthy()
    expect(mail.options.cc || '').not.toContain('giamdoc@test.com')
  })
})
