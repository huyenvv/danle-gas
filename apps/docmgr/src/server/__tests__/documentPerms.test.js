require('./setup.js')
const {
  resetAll, setupRoleSheets, setupDocSheets, createSession,
  DOC_HEADERS, CAT_HEADERS, NHOM_HEADERS, ROLE_HEADERS,
} = require('./helpers')

// Feature 008 — phân quyền xem đến từng tài liệu (lifecycle + override + publish + import).

const SSO_PARENT_ID = 'sso-parent-id'

function rowFrom(headers, obj) {
  return headers.map(h => (obj[h] !== undefined ? obj[h] : ''))
}
function seedDoc(obj) {
  SpreadsheetApp._sheets[SHEETS.HO_SO]._rows.push(rowFrom(DOC_HEADERS, obj))
  invalidateSheetCache(SHEETS.HO_SO)
}
function seedCat(obj) {
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(rowFrom(CAT_HEADERS, obj))
  invalidateSheetCache(SHEETS.DANH_MUC)
}
function seedGroup(obj) {
  SpreadsheetApp._sheets[SHEETS.NHOM]._rows.push(rowFrom(NHOM_HEADERS, obj))
  invalidateSheetCache(SHEETS.NHOM)
}
function seedAppRole(userId, username, quyen, duocPhatHanh) {
  SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push(rowFrom(ROLE_HEADERS, {
    'ID': userId, 'UserID': userId, 'Tên đăng nhập': username, 'AppID': APP_ID,
    'Quyền': quyen, 'Được phát hành': duocPhatHanh ? 'TRUE' : '',
  }))
  invalidateSheetCache(SHEETS.APP_ROLES)
}
function setupSsoUsers(users) {
  const data = [['ID', 'Email', 'Tên nhân viên']]
  users.forEach(u => data.push([u.id, u.email, u.name || u.email]))
  SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Người Dùng', data)
  SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Phân Bổ', [['ID', 'UserID', 'Chức vụ', 'PhongBanID']])
  ssoStoreParentSheetId(SSO_PARENT_ID)
}
function visibleIds(token, filters) {
  return _getDocumentsInRam(token, filters || {}).data.map(d => String(d['ID']))
}
function readDocViewers(id) {
  const d = getSheetData(SHEETS.HO_SO).find(r => String(r['ID']) === String(id))
  return d['Người được xem']
}

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
})

// ───────────────────────────────────────────────────────────────────────────
// US1 — Tài liệu chưa hoàn thành chỉ người tham gia thấy
// ───────────────────────────────────────────────────────────────────────────
describe('US1 — lifecycle gating (chưa hoàn thành)', () => {
  test('người xem danh mục (không tham gia) KHÔNG thấy tài liệu chưa hoàn thành', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A', 'Người được xem': JSON.stringify(['2']) })
    seedDoc({ ID: 10, 'Tên hồ sơ': 'Đang làm', 'Danh mục': 1, 'Tình trạng': 'Đang xử lý', 'Người tạo': 'other' })
    const token = createSession(2, 'nv', 'nv@test.com', 'Nhân viên')
    expect(visibleIds(token)).not.toContain('10')
  })

  test('người phụ trách thấy tài liệu chưa hoàn thành', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedDoc({ ID: 11, 'Tên hồ sơ': 'Việc của tôi', 'Danh mục': 1, 'Tình trạng': 'Đang xử lý', 'Người tạo': 'other', 'Phụ trách': JSON.stringify(['2']) })
    const token = createSession(2, 'nv', 'nv@test.com', 'Nhân viên')
    expect(visibleIds(token)).toContain('11')
  })

  test('người ngoài (không tham gia) KHÔNG thấy khi chưa hoàn thành', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedDoc({ ID: 12, 'Tên hồ sơ': 'Mật', 'Danh mục': 1, 'Tình trạng': 'Chờ duyệt', 'Người tạo': 'other' })
    const token = createSession(2, 'nv', 'nv@test.com', 'Nhân viên')
    expect(visibleIds(token)).not.toContain('12')
  })

  test('vai trò toàn quyền thấy mọi tài liệu (kể cả chưa hoàn thành)', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A', 'Người được xem': JSON.stringify(['999']) })
    seedDoc({ ID: 10, 'Tên hồ sơ': 'Đang làm', 'Danh mục': 1, 'Tình trạng': 'Đang xử lý', 'Người tạo': 'other' })
    const token = createSession(1, 'admin', 'admin@test.com', 'admin')
    expect(visibleIds(token)).toContain('10')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// US2 (revise snapshot) — Hoàn thành + Người được xem RỖNG = siết, KHÔNG kế thừa danh mục
// ───────────────────────────────────────────────────────────────────────────
describe('US2 — Hoàn thành + rỗng = siết (snapshot model)', () => {
  test('người xem danh mục (không tham gia) KHÔNG thấy — bỏ fallback danh mục', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A', 'Người được xem': JSON.stringify(['2']) })
    seedDoc({ ID: 20, 'Tên hồ sơ': 'Xong', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'other' })
    expect(visibleIds(createSession(2, 'nv2', 'a@test.com', 'Nhân viên'))).not.toContain('20')
  })

  test('người tham gia thấy tài liệu rỗng quyền', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedDoc({ ID: 22, 'Tên hồ sơ': 'Của tôi', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'other', 'Phụ trách': JSON.stringify(['2']) })
    expect(visibleIds(createSession(2, 'nv2', 'a@test.com', 'Nhân viên'))).toContain('22')
  })

  test('danh mục trống quyền → vẫn chỉ tham gia + toàn quyền (KHÔNG "mọi người thấy")', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedDoc({ ID: 21, 'Tên hồ sơ': 'Trống', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'other' })
    expect(visibleIds(createSession(7, 'nv7', 'c@test.com', 'Nhân viên'))).not.toContain('21')
    expect(visibleIds(createSession(1, 'admin', 'admin@test.com', 'admin'))).toContain('21')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// US3 — Hoàn thành, có phân quyền riêng → override
// ───────────────────────────────────────────────────────────────────────────
describe('US3 — override khi Hoàn thành, có quyền riêng', () => {
  test('người trong Người được xem thấy DÙ không có quyền danh mục cha (category-independent)', () => {
    // Danh mục giới hạn cho user 3; nhưng tài liệu cấp quyền cho user 2 (không xem được danh mục)
    seedCat({ ID: 1, 'Tên danh mục': 'A', 'Người được xem': JSON.stringify(['3']) })
    seedDoc({ ID: 30, 'Tên hồ sơ': 'Mật', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'other', 'Người được xem': JSON.stringify(['2']) })
    expect(visibleIds(createSession(2, 'nv2', 'a@test.com', 'Nhân viên'))).toContain('30')      // trong danh sách → thấy
    expect(visibleIds(createSession(3, 'nv3', 'b@test.com', 'Nhân viên'))).not.toContain('30')  // xem danh mục nhưng ngoài danh sách → không
  })

  test('Người được xem cá nhân: đúng người thấy, người khác không', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' }) // danh mục công khai
    seedDoc({ ID: 31, 'Tên hồ sơ': 'Riêng', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'other', 'Người được xem': JSON.stringify(['2']) })
    expect(visibleIds(createSession(2, 'nv2', 'a@test.com', 'Nhân viên'))).toContain('31')
    expect(visibleIds(createSession(3, 'nv3', 'b@test.com', 'Nhân viên'))).not.toContain('31')
  })

  test('xoá hết Người được xem → siết (chỉ tham gia + toàn quyền), KHÔNG kế thừa danh mục', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' }) // công khai
    seedDoc({ ID: 32, 'Tên hồ sơ': 'Bỏ quyền', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'other', 'Người được xem': '' })
    expect(visibleIds(createSession(9, 'nv9', 'c@test.com', 'Nhân viên'))).not.toContain('32')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// US4 — Phát hành thêm lại người bị override loại trừ (gate VT/GĐ/admin)
// ───────────────────────────────────────────────────────────────────────────
describe('US4 — publish auto-add', () => {
  beforeEach(() => {
    setupSsoUsers([{ id: 5, email: 'u5@test.com', name: 'U5' }, { id: 6, email: 'u6@test.com', name: 'U6' }])
  })

  test('VT phát hành: recipient có quyền danh mục & ngoài override → được thêm', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' }) // công khai → recipient có quyền danh mục
    seedDoc({ ID: 40, 'Tên hồ sơ': 'P', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'vt', 'Người được xem': JSON.stringify(['99']) })
    seedAppRole(9, 'vt', 'Văn thư', false)
    const token = createSession(9, 'vt', 'vt@test.com', 'Văn thư')
    publishDocument(token, '40', [5], [])
    expect(JSON.parse(readDocViewers('40'))).toEqual(['99', '5'])
  })

  test('tài liệu rỗng → publish CỘNG người nhận (snapshot model, kể cả khi rỗng)', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedDoc({ ID: 41, 'Tên hồ sơ': 'P', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'vt', 'Người được xem': '' })
    seedAppRole(9, 'vt', 'Văn thư', false)
    publishDocument(createSession(9, 'vt', 'vt@test.com', 'Văn thư'), '41', [5], [])
    expect(JSON.parse(readDocViewers('41'))).toEqual(['5']) // rỗng → thêm người nhận
  })

  test('thêm người nhận BẤT KỂ quyền danh mục (không còn điều kiện danh mục)', () => {
    seedCat({ ID: 2, 'Tên danh mục': 'B', 'Người được xem': JSON.stringify(['77']) }) // 5 không xem được danh mục
    seedDoc({ ID: 42, 'Tên hồ sơ': 'P', 'Danh mục': 2, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'vt', 'Người được xem': JSON.stringify(['99']) })
    seedAppRole(9, 'vt', 'Văn thư', false)
    publishDocument(createSession(9, 'vt', 'vt@test.com', 'Văn thư'), '42', [5], [])
    expect(JSON.parse(readDocViewers('42'))).toEqual(['99', '5'])
  })

  test('người chỉ có cờ "Được phát hành" (không VT/GĐ/admin) → chỉ gửi mail, không đổi danh sách', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedDoc({ ID: 43, 'Tên hồ sơ': 'P', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'x', 'Người được xem': JSON.stringify(['99']) })
    seedAppRole(8, 'nv8', 'Nhân viên', true) // chỉ có cờ Được phát hành
    publishDocument(createSession(8, 'nv8', 'nv8@test.com', 'Nhân viên'), '43', [5], [])
    expect(JSON.parse(readDocViewers('43'))).toEqual(['99'])
  })

  test('recipient đã có trong danh sách → không thêm trùng', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedDoc({ ID: 44, 'Tên hồ sơ': 'P', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'vt', 'Người được xem': JSON.stringify(['5']) })
    seedAppRole(9, 'vt', 'Văn thư', false)
    publishDocument(createSession(9, 'vt', 'vt@test.com', 'Văn thư'), '44', [5], [])
    expect(JSON.parse(readDocViewers('44'))).toEqual(['5'])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// US5 — Import cột "Phân quyền" theo tên nhóm
// ───────────────────────────────────────────────────────────────────────────
describe('US5 — import cột Phân quyền', () => {
  function importGroup(docExtra) {
    const token = createSession(9, 'vt', 'vt@test.com', 'Văn thư')
    return bulkImportDocuments(token, {
      groups: [{
        docData: Object.assign({ 'Tên hồ sơ': 'HS', 'Danh mục': '1' }, docExtra),
        files: [{ fileId: 'f' + Math.floor(Math.random() * 1e9), fileName: 'a.pdf' }],
        rowIndices: [2],
      }],
    })
  }

  beforeEach(() => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedGroup({ ID: 1, 'Tên nhóm': 'Kế toán', 'Thành viên': JSON.stringify(['2']) })
    seedGroup({ ID: 2, 'Tên nhóm': 'Nhân sự', 'Thành viên': JSON.stringify(['3']) })
  })

  test('tên nhóm hợp lệ → khai triển thành viên vào Người được xem', () => {
    const r = importGroup({ 'Phân quyền': 'Kế toán' })
    expect(r.created).toBe(1)
    const doc = getSheetData(SHEETS.HO_SO).find(d => d['Tên hồ sơ'] === 'HS')
    expect(JSON.parse(doc['Người được xem'])).toEqual(['2']) // thành viên nhóm Kế toán
  })

  test('nhiều nhóm phân tách dấu phẩy → hợp các thành viên', () => {
    const r = importGroup({ 'Phân quyền': 'Kế toán, Nhân sự' })
    expect(r.created).toBe(1)
    const doc = getSheetData(SHEETS.HO_SO).find(d => d['Tên hồ sơ'] === 'HS')
    expect(JSON.parse(doc['Người được xem'])).toEqual(['2', '3'])
  })

  test('tên nhóm không tồn tại → không tạo + errors', () => {
    const r = importGroup({ 'Phân quyền': 'KhôngCó' })
    expect(r.created).toBe(0)
    expect(r.errors.length).toBe(1)
    expect(r.errors[0].message).toContain('KhôngCó')
  })

  test('một tên sai trong danh sách nhiều nhóm → không tạo', () => {
    const r = importGroup({ 'Phân quyền': 'Kế toán, Sai' })
    expect(r.created).toBe(0)
    expect(r.errors.length).toBe(1)
  })

  test('cột trống + danh mục TRỐNG quyền → Người được xem rỗng', () => {
    const r = importGroup({})
    expect(r.created).toBe(1)
    const doc = getSheetData(SHEETS.HO_SO).find(d => d['Tên hồ sơ'] === 'HS')
    expect(doc['Người được xem']).toBe('')
  })

  test('cột trống + danh mục CÓ quyền → snapshot quyền danh mục (FR-012)', () => {
    seedCat({ ID: 5, 'Tên danh mục': 'C', 'Người được xem': JSON.stringify(['4']), 'Nhóm được xem': JSON.stringify(['1']) })
    const r = importGroup({ 'Danh mục': '5' }) // Phân quyền trống
    expect(r.created).toBe(1)
    const doc = getSheetData(SHEETS.HO_SO).find(d => d['Tên hồ sơ'] === 'HS')
    expect(JSON.parse(doc['Người được xem']).sort()).toEqual(['2', '4']) // trực tiếp [4] + thành viên nhóm 1 [2]
  })

  test('CSV-quoting: tên nhóm chứa dấu phẩy bọc nháy kép = MỘT nhóm', () => {
    seedGroup({ ID: 3, 'Tên nhóm': 'Trưởng, Phó phòng', 'Thành viên': JSON.stringify(['8']) })
    const r = importGroup({ 'Phân quyền': '"Trưởng, Phó phòng"' })
    expect(r.created).toBe(1)
    const doc = getSheetData(SHEETS.HO_SO).find(d => d['Tên hồ sơ'] === 'HS')
    expect(JSON.parse(doc['Người được xem'])).toEqual(['8'])
  })

  test('snapshot trống KẾ THỪA danh mục CHA (import vào danh mục con)', () => {
    seedCat({ ID: 7, 'Tên danh mục': 'Cha', 'Người được xem': JSON.stringify(['4']) })
    seedCat({ ID: 8, 'Tên danh mục': 'Con', 'Danh mục cha': 7, 'Người được xem': JSON.stringify(['2']) })
    const r = importGroup({ 'Danh mục': '8' }) // Phân quyền trống → snapshot con + cha
    expect(r.created).toBe(1)
    const doc = getSheetData(SHEETS.HO_SO).find(d => d['Tên hồ sơ'] === 'HS')
    expect(JSON.parse(doc['Người được xem']).sort()).toEqual(['2', '4'])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// setDocumentViewers — đặt phân quyền XEM kể cả khi tài liệu đã Hoàn thành (khóa sửa)
// ───────────────────────────────────────────────────────────────────────────
describe('setDocumentViewers', () => {
  test('Giám đốc (toàn quyền) đặt được trên tài liệu Hoàn thành', () => {
    seedDoc({ ID: 50, 'Tên hồ sơ': 'X', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'vt' })
    const r = setDocumentViewers(createSession(9, 'gd', 'gd@test.com', 'Giám đốc'), '50', JSON.stringify(['2', '3']))
    expect(JSON.parse(r.data['Người được xem'])).toEqual(['2', '3'])
  })

  test('xoá hết quyền riêng (truyền rỗng) → Người được xem rỗng (siết)', () => {
    seedDoc({ ID: 51, 'Tên hồ sơ': 'Y', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'vt', 'Người được xem': JSON.stringify(['2']) })
    const r = setDocumentViewers(createSession(8, 'vt', 'vt@test.com', 'Văn thư'), '51', '')
    expect(r.data['Người được xem']).toBe('')
  })

  test('vai trò không toàn quyền (Nhân viên) bị từ chối', () => {
    seedDoc({ ID: 52, 'Tên hồ sơ': 'Z', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'vt' })
    expect(() => setDocumentViewers(createSession(3, 'nv', 'nv@test.com', 'Nhân viên'), '52', JSON.stringify(['3']), '')).toThrow('không có quyền')
  })

  test('thêm người vào Người được xem → báo (unread) cho người MỚI, không re-báo người cũ', () => {
    seedDoc({ ID: 53, 'Tên hồ sơ': 'W', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'vt', 'Người được xem': JSON.stringify(['2']) })
    setDocumentViewers(createSession(9, 'gd', 'gd@test.com', 'Giám đốc'), '53', JSON.stringify(['2', '3']))
    const daDoc = getSheetData(SHEETS.DA_DOC)
    expect(daDoc.some(r => String(r['UserID']) === '3' && String(r['DocID']) === '53')).toBe(true)  // mới → báo
    expect(daDoc.some(r => String(r['UserID']) === '2' && String(r['DocID']) === '53')).toBe(false) // cũ → không re-báo
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Migration backfill (FR-013) — snapshot quyền danh mục vào tài liệu cũ rỗng, idempotent
// ───────────────────────────────────────────────────────────────────────────
describe('Migration backfill (_backfillDocViewers)', () => {
  test('tài liệu rỗng + danh mục có quyền → snapshot (người trực tiếp + thành viên nhóm)', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A', 'Người được xem': JSON.stringify(['2']), 'Nhóm được xem': JSON.stringify(['1']) })
    seedGroup({ ID: 1, 'Tên nhóm': 'G', 'Thành viên': JSON.stringify(['3']) })
    seedDoc({ ID: 60, 'Tên hồ sơ': 'Cũ', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'x', 'Người được xem': '' })
    _backfillDocViewers()
    expect(JSON.parse(readDocViewers('60')).sort()).toEqual(['2', '3'])
  })

  test('danh mục trống quyền → giữ rỗng', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A' })
    seedDoc({ ID: 61, 'Tên hồ sơ': 'Trống', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'x', 'Người được xem': '' })
    _backfillDocViewers()
    expect(readDocViewers('61')).toBe('')
  })

  test('idempotent: chạy lần 2 KHÔNG xử lý lại (cờ đã set)', () => {
    seedCat({ ID: 1, 'Tên danh mục': 'A', 'Người được xem': JSON.stringify(['2']) })
    seedDoc({ ID: 62, 'Tên hồ sơ': 'X', 'Danh mục': 1, 'Tình trạng': 'Hoàn thành', 'Người tạo': 'x', 'Người được xem': '' })
    _backfillDocViewers()
    expect(JSON.parse(readDocViewers('62'))).toEqual(['2'])
    updateRow(SHEETS.HO_SO, '62', { 'Người được xem': '' }); invalidateSheetCache(SHEETS.HO_SO)
    _backfillDocViewers() // cờ đã set → bỏ qua
    expect(readDocViewers('62')).toBe('')
  })
})
