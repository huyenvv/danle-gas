// ===== Auth core — session & password management =====

// Cache TTL for sessions. GAS caps at 6h, so we use that.
var SESSION_TTL = 21600 // 6 hours (GAS CacheService max)

function _verifyPassword(username, password, storedHash) {
  return _hashPassword(username, password) === storedHash
}

function logout(token) {
  cacheRemove('sess_' + token)
  return { success: true }
}

function validateSession(token) {
  if (!token) return null
  var session = cacheGet('sess_' + token)
  if (!session) return null
  // Sliding window: refresh cache TTL on every validate to keep session alive
  cachePut('sess_' + token, session, SESSION_TTL)
  return session
}

function requireAuth(accessToken) {
  var session = validateAccessToken(accessToken)
  if (!session) throw new Error('TOKEN_EXPIRED')
  return session
}

function requireAdmin(accessToken) {
  var session = requireAuth(accessToken)
  var adminRoles = ['admin', 'Quản trị viên', 'Giám đốc']
  if (adminRoles.indexOf(session.role) === -1) throw new Error('Chỉ quản trị viên mới có quyền thực hiện thao tác này')
  return session
}
