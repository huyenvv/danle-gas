// Shared test helpers — header constants, reset, seed, login utilities
// Updated for SSO model: users are managed by parent app, this app only manages roles.

// ── Header constants matching config.js ──────────────────────────────────────
var ROLE_HEADERS = ['ID', 'UserID', 'Tên đăng nhập', 'AppID', 'Quyền', 'Phân quyền chi tiết']
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
function setupRoleSheets() {
  SpreadsheetApp._addSheet(SHEETS.APP_ROLES, [ROLE_HEADERS])
}

function setupDocSheets() {
  SpreadsheetApp._addSheet(SHEETS.HO_SO, [DOC_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.DANH_MUC, [CAT_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.DA_DOC, [['ID', 'UserID', 'DocID', 'Thời gian']])
  SpreadsheetApp._addSheet(SHEETS.COMMENTS, [['ID', 'DocID', 'UserID', 'Tên người dùng', 'Nội dung', 'Thời gian']])
}

// ── Seed a user role in local _Phân Quyền + create session ──────────────────
function seedUser(id, username, email, role) {
  SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.push(
    [SpreadsheetApp._sheets[SHEETS.APP_ROLES]._rows.length, id, username, APP_ID, role, '']
  )
  invalidateSheetCache(SHEETS.APP_ROLES)
}

// ── Create a session directly (SSO session creation) ────────────────────────
function createSession(userId, username, email, role) {
  var appRole = { 'Quyền': role, 'Phân quyền chi tiết': '' }
  var token = generateUuid()
  var sessionData = {
    userId: userId,
    username: username,
    email: email || username + '@test.com',
    role: role,
    mustChangePass: false,
    departments: [],
    permissions: getPermissions(appRole),
  }
  cachePut('sess_' + token, sessionData, SESSION_TTL)
  return token
}

module.exports = {
  ROLE_HEADERS: ROLE_HEADERS,
  DOC_HEADERS: DOC_HEADERS,
  CAT_HEADERS: CAT_HEADERS,
  resetAll: resetAll,
  setupRoleSheets: setupRoleSheets,
  setupDocSheets: setupDocSheets,
  seedUser: seedUser,
  createSession: createSession,
}
