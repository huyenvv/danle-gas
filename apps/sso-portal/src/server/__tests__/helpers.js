// Shared test helpers — header constants, reset, seed utilities for SSO Portal

// ── Header constants matching config.js ──────────────────────────────────────
var USER_HEADERS = ['ID', 'Tên đăng nhập', 'Mật khẩu', 'Email', 'Tên nhân viên', 'Trạng thái', 'MustChangePass', 'Đăng nhập cuối', 'Phòng ban', 'Chức vụ', 'Quyền', 'FailedLogins', 'SSO_Token', 'SSO_Expiry', 'RefreshTokens', 'LastLogoutAt', 'LogoutEpochs', 'AccessToken', 'AccessTokenExpiry']
var APP_HEADERS = ['ID', 'Tên App', 'Webapp URL', 'Icon', 'Mô tả', 'Trạng thái', 'Quyền xem']
var SYS_HEADERS = ['Key', 'Value']
var HANDOFF_HEADERS = ['ID', 'Token', 'UserID', 'AppID', 'CreatedAt', 'ExpiresAt', 'Consumed']
var PHONGBAN_HEADERS = ['ID', 'Tên phòng ban']
var PHANBO_HEADERS = ['ID', 'UserID', 'Chức vụ', 'PhongBanID']
var NHATKY_HEADERS = ['ID', 'Thời gian', 'Người dùng', 'Email', 'Hành động', 'Loại', 'Đối tượng', 'Chi tiết']

// ── Reset all mocks ──────────────────────────────────────────────────────────
function resetAll() {
  SpreadsheetApp._reset()
  CacheService.getScriptCache()._reset()
  PropertiesService._reset()
  GmailApp._reset()
  // Reset schema init flag
  if (typeof _initDone !== 'undefined') _initDone = false
}

// ── Sheet setup helpers ──────────────────────────────────────────────────────
function setupAllSheets() {
  SpreadsheetApp._addSheet(SHEETS.USERS, [USER_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.APPS, [APP_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.SYS, [SYS_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.HANDOFFS, [HANDOFF_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.PHONG_BAN, [PHONGBAN_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.PHAN_BO, [PHANBO_HEADERS])
  SpreadsheetApp._addSheet(SHEETS.NHAT_KY, [NHATKY_HEADERS])
}

// ── Seed a user into _Người Dùng ────────────────────────────────────────────
function seedUser(id, username, email, opts) {
  opts = opts || {}
  var passwordHash = _hashPassword(username, 'Admin@@123')
  var row = [
    id, username, passwordHash, email,
    opts.name || '', opts.status || 'Active',
    opts.mustChangePass || 'FALSE', '',
    opts.phongBan || '', opts.chucVu || '',
    opts.quyen || '', opts.failedLogins || 0,
    '', '', '', '', '', '', ''
  ]
  SpreadsheetApp._sheets[SHEETS.USERS]._rows.push(row)
  invalidateSheetCache(SHEETS.USERS)
}

// ── Seed a department into _Phòng Ban ───────────────────────────────────────
function seedDept(id, name) {
  SpreadsheetApp._sheets[SHEETS.PHONG_BAN]._rows.push([id, name])
  invalidateSheetCache(SHEETS.PHONG_BAN)
}

// ── Seed an assignment into _Phân Bổ ────────────────────────────────────────
function seedAssignment(id, userId, chucVu, phongBanId) {
  SpreadsheetApp._sheets[SHEETS.PHAN_BO]._rows.push([id, String(userId), chucVu, phongBanId || ''])
  invalidateSheetCache(SHEETS.PHAN_BO)
}

// ── Create an admin session and return access token ─────────────────────────
function createAdminSession(userId, username, email) {
  var sessionData = {
    userId: userId,
    username: username,
    email: email || username + '@test.com',
    displayName: username,
    role: 'admin',
    isOwner: false,
    mustChangePass: false,
  }
  return mintAccessToken(sessionData, SHEETS.USERS)
}

module.exports = {
  USER_HEADERS: USER_HEADERS,
  APP_HEADERS: APP_HEADERS,
  SYS_HEADERS: SYS_HEADERS,
  PHONGBAN_HEADERS: PHONGBAN_HEADERS,
  PHANBO_HEADERS: PHANBO_HEADERS,
  NHATKY_HEADERS: NHATKY_HEADERS,
  resetAll: resetAll,
  setupAllSheets: setupAllSheets,
  seedUser: seedUser,
  seedDept: seedDept,
  seedAssignment: seedAssignment,
  createAdminSession: createAdminSession,
}
