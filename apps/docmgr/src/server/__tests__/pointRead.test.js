// 014: đọc-điểm 1 hồ sơ theo ID (TextFinder, sheet sống) — không full-read, không gviz.
require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, createSession, DOC_HEADERS } = require('./helpers')

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()
  UrlFetchApp._lastRequest = null
})

function seedDoc(id, name) {
  addRow(SHEETS.HO_SO, { 'ID': id, 'Tên hồ sơ': name })
  invalidateSheetCache(SHEETS.HO_SO)
}

describe('_findRowIndexById', () => {
  test('trả số dòng tuyệt đối (1-based) của hồ sơ theo ID', () => {
    seedDoc(1, 'A'); seedDoc(2, 'B'); seedDoc(3, 'C')
    const sheet = getSheet(SHEETS.HO_SO)
    expect(_findRowIndexById(sheet, 2)).toBe(3) // header=1, doc1=2, doc2=3
    expect(_findRowIndexById(sheet, 3)).toBe(4)
  })

  test('ID không tồn tại → -1', () => {
    seedDoc(1, 'A')
    expect(_findRowIndexById(getSheet(SHEETS.HO_SO), 999)).toBe(-1)
  })

  test('matchEntireCell: ID 1 KHÔNG khớp 10 hay 21', () => {
    seedDoc(10, 'X'); seedDoc(21, 'Y'); seedDoc(1, 'Z')
    const sheet = getSheet(SHEETS.HO_SO)
    // dòng của ID=1 là dòng 4 (sau 10 và 21), không phải dòng của 10/21
    expect(_findRowIndexById(sheet, 1)).toBe(4)
  })

  test('sheet chỉ có header → -1', () => {
    expect(_findRowIndexById(getSheet(SHEETS.HO_SO), 1)).toBe(-1)
  })
})

describe('_getDocById', () => {
  test('trả đúng object hồ sơ theo ID', () => {
    seedDoc(1, 'A'); seedDoc(2, 'Bê')
    const doc = _getDocById(2)
    expect(doc['ID']).toBe(2)
    expect(doc['Tên hồ sơ']).toBe('Bê')
  })

  test('ID không tồn tại → null', () => {
    seedDoc(1, 'A')
    expect(_getDocById(999)).toBeNull()
  })

  test('đọc-sau-ghi tức thì: ghi field rồi đọc lại thấy giá trị mới', () => {
    seedDoc(5, 'Cũ')
    updateRow(SHEETS.HO_SO, 5, { 'Ghi chú': 'Đã sửa' })
    const doc = _getDocById(5)
    expect(doc['Ghi chú']).toBe('Đã sửa')
  })

  test('KHÔNG đi qua gviz (UrlFetchApp không được gọi)', () => {
    seedDoc(1, 'A')
    _getDocById(1)
    expect(UrlFetchApp._lastRequest).toBeNull()
  })
})

describe('getDocById (api, kiểm quyền xem)', () => {
  // Cần cột "Token xem" → dựng HO_SO với đủ cột derived.
  beforeEach(() => {
    SpreadsheetApp._addSheet(SHEETS.HO_SO, [DOC_HEADERS.concat(['Hạng ưu tiên', 'Token xem', 'Blob tìm kiếm'])])
  })
  function seed(id, name, tokenXem) {
    addRow(SHEETS.HO_SO, { 'ID': id, 'Tên hồ sơ': name, 'Token xem': tokenXem || '' })
    invalidateSheetCache(SHEETS.HO_SO)
  }

  test('full-role thấy mọi hồ sơ kể cả ngoài Token xem', () => {
    seed(1, 'A', '|99|')
    const token = createSession(1, 'gd', 'gd@x.com', 'Giám đốc')
    expect(getDocById(token, 1)['Tên hồ sơ']).toBe('A')
  })
  test('vai trò thường: nằm trong Token xem → thấy', () => {
    seed(2, 'B', '|7|')
    const token = createSession(7, 'nv', 'nv@x.com', 'Nhân viên')
    expect(getDocById(token, 2)['Tên hồ sơ']).toBe('B')
  })
  test('vai trò thường: ngoài Token xem → null', () => {
    seed(3, 'C', '|99|')
    const token = createSession(7, 'nv', 'nv@x.com', 'Nhân viên')
    expect(getDocById(token, 3)).toBeNull()
  })
  test('ID không tồn tại → null', () => {
    const token = createSession(1, 'gd', 'gd@x.com', 'Giám đốc')
    expect(getDocById(token, 999)).toBeNull()
  })
})

describe('_resolveUserIds — chuẩn hoá username/email → userId (qua SSO _Người Dùng)', () => {
  const PARENT = 'sso-parent-resolve'
  beforeEach(() => {
    SpreadsheetApp._addExternalSheet(PARENT, '_Người Dùng', [
      ['ID', 'Tên đăng nhập', 'Email'],
      [42, 'nv', 'nv@cty.com'],
    ])
    PropertiesService.getScriptProperties().setProperty('SSO_PARENT_SHEET_ID', PARENT)
    _resetDocUserIdMemo()
  })
  test('email → userId', () => { expect(_resolveUserIds(['nv@cty.com'])).toEqual(['42']) })
  test('username → userId', () => { expect(_resolveUserIds(['nv'])).toEqual(['42']) })
  test('userId giữ nguyên; định danh lạ giữ nguyên', () => {
    expect(_resolveUserIds(['42', 'unknown'])).toEqual(['42', 'unknown'])
  })
})

describe('_migrateDaDocUserIdEmails — convert UserID email/username → userId (RAM-light)', () => {
  const PARENT = 'sso-parent-dadoc'
  beforeEach(() => {
    SpreadsheetApp._addExternalSheet(PARENT, '_Người Dùng', [
      ['ID', 'Tên đăng nhập', 'Email'],
      [42, 'nv', 'nv@cty.com'],
    ])
    PropertiesService.getScriptProperties().setProperty('SSO_PARENT_SHEET_ID', PARENT)
    _resetDocUserIdMemo()
    addRow(SHEETS.CHUA_DOC, { 'UserID': 'nv@cty.com', 'DocID': 5, 'Thời gian': 't1' })  // dòng cũ: email
    addRow(SHEETS.CHUA_DOC, { 'UserID': '42', 'DocID': 6, 'Thời gian': 't2' })          // dòng đã chuẩn
    invalidateSheetCache(SHEETS.CHUA_DOC)
  })
  test('email → userId; userId giữ nguyên; cờ set', () => {
    _migrateDaDocUserIdEmails()
    const rows = getSheetData(SHEETS.CHUA_DOC)
    expect(String(rows.find(r => String(r.DocID) === '5').UserID)).toBe('42')   // email đã đổi
    expect(String(rows.find(r => String(r.DocID) === '6').UserID)).toBe('42')   // userId nguyên
    expect(PropertiesService.getScriptProperties().getProperty('DADOC_USERID_MIGRATED')).toBe('1')
  })
  test('idempotent: cờ đã set → không chạy lại', () => {
    PropertiesService.getScriptProperties().setProperty('DADOC_USERID_MIGRATED', '1')
    _migrateDaDocUserIdEmails()
    expect(String(getSheetData(SHEETS.CHUA_DOC).find(r => String(r.DocID) === '5').UserID)).toBe('nv@cty.com') // không đổi
  })
  test('chưa biết sheet cha → không chạy (cờ chưa set)', () => {
    PropertiesService.getScriptProperties().deleteProperty('SSO_PARENT_SHEET_ID')
    _migrateDaDocUserIdEmails()
    expect(PropertiesService.getScriptProperties().getProperty('DADOC_USERID_MIGRATED')).toBeNull()
  })
})

describe('_migrateDaDocSheetName — đổi tên tab _Đã Đọc → _Chưa Đọc', () => {
  beforeEach(() => { delete SpreadsheetApp._sheets[SHEETS.CHUA_DOC] })  // bỏ tab '_Chưa Đọc' do setupDocSheets tạo sẵn
  test('tab cũ tồn tại → đổi tên, giữ dữ liệu', () => {
    SpreadsheetApp._addSheet('_Đã Đọc', [['ID', 'UserID', 'DocID', 'Thời gian'], [1, 7, 3, 't']])
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    _migrateDaDocSheetName(ss)
    expect(ss.getSheetByName('_Đã Đọc')).toBeNull()
    const moved = ss.getSheetByName(SHEETS.CHUA_DOC)   // '_Chưa Đọc'
    expect(moved).not.toBeNull()
    expect(moved._rows.length).toBe(2)               // dữ liệu cũ giữ nguyên
  })
  test('idempotent: không có tab cũ → không làm gì', () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    expect(() => _migrateDaDocSheetName(ss)).not.toThrow()
    expect(ss.getSheetByName('_Đã Đọc')).toBeNull()
  })
  test('đã có tab mới → KHÔNG ghi đè (không đổi)', () => {
    SpreadsheetApp._addSheet('_Đã Đọc', [['ID'], [1]])
    SpreadsheetApp._addSheet(SHEETS.CHUA_DOC, [['ID'], [2], [3]])
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    _migrateDaDocSheetName(ss)
    expect(ss.getSheetByName(SHEETS.CHUA_DOC)._rows.length).toBe(3)  // tab mới giữ nguyên
  })
})

describe('addComment — đánh dấu CHƯA ĐỌC cho người liên quan khác', () => {
  test('bình luận → PT+PH khác có record chưa-đọc; người bình luận thì KHÔNG', () => {
    addRow(SHEETS.HO_SO, {
      'ID': 1, 'Tên hồ sơ': 'A',
      'Phụ trách': JSON.stringify(['7']), 'Người phối hợp': JSON.stringify(['8']),
    })
    invalidateSheetCache(SHEETS.HO_SO)
    const token = createSession(7, 'nv7', 'nv7@x.com', 'Nhân viên')  // commenter = PT (userId 7)
    addComment(token, 1, 'Một bình luận')
    const ids = getSheetData(SHEETS.CHUA_DOC)
      .filter(r => String(r.DocID) === '1').map(r => String(r.UserID))
    expect(ids).toContain('8')       // Người phối hợp → chưa đọc
    expect(ids).not.toContain('7')   // người bình luận → không tự báo
  })
})
