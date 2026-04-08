// Shared test helpers — header constants, reset, seed, login utilities

// ── Header constants matching config.js ──────────────────────────────────────
var USER_HEADERS = ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối', 'Phòng ban']
var ROLE_HEADERS = ['UserID', 'AppID', 'Quyền', 'Phân quyền chi tiết']
var DOC_HEADERS = [
  'ID', 'Tên hồ sơ', 'Danh mục', 'Phòng ban', 'Ngày ban hành',
  'Ngày kết thúc', 'File ID', 'Tên file', 'Loại file', 'Kích thước',
  'Mô tả', 'Số hồ sơ', 'Dự án', 'Nhà cung cấp', 'Giá trị HĐ',
  'Giá trị thực hiện', 'Chênh lệch', 'Tình trạng', 'Phụ trách',
  'Ngày cập nhật', 'Người tạo', 'Người cập nhật'
]
var CAT_HEADERS = ['ID', 'Tên danh mục', 'Icon', 'Mô tả', 'Danh mục cha']

// ── Reset all mocks ──────────────────────────────────────────────────────────
function resetAll() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  PropertiesService._reset()
  DriveApp._reset()
}

// ── Sheet setup helpers ──────────────────────────────────────────────────────
function setupUserSheets() {
  SpreadsheetApp._addSheet(SHEETS.USERS, [USER_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.APP_ROLES, [ROLE_HEADERS])
}

function setupDocSheets() {
  SpreadsheetApp._addSheet(SHEETS.HO_SO, [DOC_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.DANH_MUC, [CAT_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.DA_DOC, [['ID', 'UserID', 'DocID', 'Thời gian']])
  SpreadsheetApp._addSheet(SHEETS.COMMENTS, [['ID', 'DocID', 'UserID', 'Tên người dùng', 'Nội dung', 'Thời gian']])
}

// ── Seed a user with role ────────────────────────────────────────────────────
function seedUser(id, username, password, email, role) {
  var hashed = _hashPassword(username, password)
  SpreadsheetApp._sheets[SHEETS.USERS]._rows.push(
    [id, username, hashed, email, 'Active', false, '', '']
  )
  SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push(
    [id, APP_ID, role, '']
  )
  invalidateSheetCache(SHEETS.USERS)
  invalidateSheetCache(SHEETS.APP_ROLES)
}

// ── Login shortcut ───────────────────────────────────────────────────────────
function loginAs(username, password) {
  return login(username, password).token
}

module.exports = {
  USER_HEADERS: USER_HEADERS,
  ROLE_HEADERS: ROLE_HEADERS,
  DOC_HEADERS: DOC_HEADERS,
  CAT_HEADERS: CAT_HEADERS,
  resetAll: resetAll,
  setupUserSheets: setupUserSheets,
  setupDocSheets: setupDocSheets,
  seedUser: seedUser,
  loginAs: loginAs,
}
