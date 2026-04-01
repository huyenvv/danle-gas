// ===== App-specific auth — login with column mappings, lock/unlock =====
// Core auth (validateSession, requireAuth, requireAdmin, changePassword, etc.) provided by gas-core/auth-core.js

function login(username, password) {
  var central = getCentralSheet()
  var users = rowsToObjects(central.getSheetByName(SHEETS.USERS).getDataRange().getValues())
  var user = users.find(function(u) { return u['Tên đăng nhập'] === username })

  if (!user) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng')
  if (user['Trạng thái'] === 'Locked') throw new Error('Tài khoản đã bị khóa. Liên hệ quản trị viên.')
  if (!_verifyPassword(username, password, user['Mật khẩu'])) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng')

  var roles = rowsToObjects(central.getSheetByName(SHEETS.APP_ROLES).getDataRange().getValues())
  var appRole = roles.find(function(r) {
    return String(r['UserID']) === String(user['ID']) && r['AppID'] === APP_ID
  })
  if (!appRole) throw new Error('Tài khoản chưa được cấp quyền cho ứng dụng này')

  updateRow(SHEETS.USERS, user['ID'], { 'Đăng nhập cuối': now() })

  var token = generateUuid()
  var sessionData = {
    userId: user['ID'],
    username: user['Tên đăng nhập'],
    email: user['Email'],
    role: appRole['Quyền'],
    mustChangePass: user['MustChangePass'] === 'TRUE' || user['MustChangePass'] === true,
  }
  cachePut('sess_' + token, sessionData, SESSION_TTL)

  return { token: token, user: sessionData }
}

// ===== Lock / Unlock =====
function lockUser(token, targetUserId) {
  var session = requireAdmin(token)
  if (String(session.userId) === String(targetUserId)) throw new Error('Không thể tự khóa tài khoản của mình')
  updateRow(SHEETS.USERS, targetUserId, { 'Trạng thái': 'Locked' })
  return { success: true }
}

function unlockUser(token, targetUserId) {
  requireAdmin(token)
  updateRow(SHEETS.USERS, targetUserId, { 'Trạng thái': 'Active' })
  return { success: true }
}
