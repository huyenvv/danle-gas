require('./setup.js')

const DOC_HEADERS = [
  'ID', 'Tên hồ sơ', 'Danh mục', 'Loại hồ sơ', 'Số hợp đồng',
  'Đơn vị/ Trường', 'Ngày ký', 'Ngày hiệu lực', 'Ngày hết hạn',
  'Giá trị HĐ', 'Giá trị thực hiện', 'Chênh lệch', 'Trạng thái',
  'Ghi chú', 'File ID', 'Tên file', 'URL file', 'Người tạo',
  'Người cập nhật', 'Ngày tạo'
]
// Match actual config.js schema
const USER_HEADERS = ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối']
const ROLE_HEADERS = ['UserID', 'AppID', 'Quyền', 'Phân quyền chi tiết']
const CAT_HEADERS  = ['ID', 'Tên danh mục', 'Icon', 'Màu sắc', 'Mô tả']

function reset() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  PropertiesService._reset()
}

let editorToken

beforeEach(() => {
  reset()
  SpreadsheetApp._addSheet(SHEETS.HO_SO, [DOC_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.USERS, [USER_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.APP_ROLES, [ROLE_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.DANH_MUC, [CAT_HEADERS])

  // Seed editor user — role 'Biên tập viên' (not 'admin', so filtered by editor check)
  const hashed = _hashPassword('editor', 'pass123')
  SpreadsheetApp._sheets[SHEETS.USERS]._rows.push(
    [1, 'editor', hashed, 'e@test.com', 'Active', false, '']
  )
  SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push(
    [1, APP_ID, 'Biên tập viên', '']
  )
  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(
    [1, 'Hợp đồng', '', '', '']
  )
  invalidateSheetCache(SHEETS.USERS)
  invalidateSheetCache(SHEETS.APP_ROLES)
  invalidateSheetCache(SHEETS.DANH_MUC)

  const loginResult = login('editor', 'pass123')
  editorToken = loginResult.token
})

describe('createDocument', () => {
  test('creates document and returns record with ID', () => {
    const result = createDocument(editorToken, {
      'Tên hồ sơ': 'HĐ Mua sắm',
      'Danh mục': 1,
    }, null)
    expect(result.data['ID']).toBe(1)
    expect(result.data['Người tạo']).toBe(1)
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
    createDocument(editorToken, { 'Tên hồ sơ': 'Doc A', 'Danh mục': 1, 'Trạng thái': 'Hiệu lực' }, null)
    createDocument(editorToken, { 'Tên hồ sơ': 'Doc B', 'Danh mục': 1, 'Trạng thái': 'Hết hạn' }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('returns all docs for editor', () => {
    const result = getDocuments(editorToken, {})
    expect(result.data).toHaveLength(2)
  })

  test('filters by trangThai', () => {
    const result = getDocuments(editorToken, { trangThai: 'Hết hạn' })
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
