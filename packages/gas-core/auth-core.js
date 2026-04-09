// ===== Auth core — session & password management =====

var SESSION_TTL = 28800 // 8 hours

function hashPassword(username, password) {
  return _hashPassword(username, password)
}

function _verifyPassword(username, password, storedHash) {
  return _hashPassword(username, password) === storedHash
}

function logout(token) {
  cacheRemove('sess_' + token)
  return { success: true }
}

function validateSession(token) {
  if (!token) return null
  return cacheGet('sess_' + token)
}

function requireAuth(token) {
  var session = validateSession(token)
  if (!session) throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
  return session
}

function requireAdmin(token) {
  var session = requireAuth(token)
  var adminRoles = ['admin', 'Quản trị viên', 'Giám đốc']
  if (adminRoles.indexOf(session.role) === -1) throw new Error('Chỉ quản trị viên mới có quyền thực hiện thao tác này')
  return session
}

function changePassword(token, oldPassword, newPassword) {
  var session = requireAuth(token)
  if (newPassword.length < 6) throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự')

  var central = getCentralSheet()
  var users = rowsToObjects(central.getSheetByName(SHEETS.USERS).getDataRange().getValues())
  var user = users.find(function(u) { return String(u['ID']) === String(session.userId) })
  if (!user) throw new Error('Không tìm thấy tài khoản')

  if (!_verifyPassword(session.username, oldPassword, user['Mật khẩu'])) {
    throw new Error('Mật khẩu cũ không đúng')
  }
  if (oldPassword === newPassword) throw new Error('Mật khẩu mới phải khác mật khẩu cũ')

  var newHash = _hashPassword(session.username, newPassword)
  updateRow(SHEETS.USERS, user['ID'], { 'Mật khẩu': newHash, 'MustChangePass': 'FALSE' })

  cacheRemove('sess_' + token)
  return { success: true }
}

function adminResetPassword(token, targetUserId, newPassword) {
  requireAdmin(token)
  if (newPassword.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự')

  var central = getCentralSheet()
  var users = rowsToObjects(central.getSheetByName(SHEETS.USERS).getDataRange().getValues())
  var user = users.find(function(u) { return String(u['ID']) === String(targetUserId) })
  if (!user) throw new Error('Không tìm thấy tài khoản')

  var newHash = _hashPassword(user['Tên đăng nhập'], newPassword)
  updateRow(SHEETS.USERS, targetUserId, { 'Mật khẩu': newHash, 'MustChangePass': 'TRUE' })
  return { success: true }
}
