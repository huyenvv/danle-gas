// ===== SSO Portal — main entry point =====

function doGet() {
  ensureInitialized()
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('SSO Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

// ===== Auth API =====

function api_login(email, password) {
  return _wrap(function() { return login(email, password) })
}

function api_logout(token) {
  return _wrap(function() { return logout(token) })
}

function api_validateSession(token) {
  return _wrap(function() { return validateSession(token) })
}

function api_changePassword(token, oldPassword, newPassword) {
  return _wrap(function() { return portalChangePassword(token, oldPassword, newPassword) })
}

function api_adminResetPassword(token, targetUserId) {
  return _wrap(function() { return portalAdminResetPassword(token, targetUserId) })
}

function api_lockUser(token, targetUserId) {
  return _wrap(function() { return portalLockUser(token, targetUserId) })
}

function api_unlockUser(token, targetUserId) {
  return _wrap(function() { return portalUnlockUser(token, targetUserId) })
}

// ===== User API =====

function api_getUsers(token) {
  return _wrap(function() { return getUsers(token) })
}

function api_addUser(token, data) {
  return _wrap(function() { return addUser(token, data) })
}

function api_updateUser(token, id, data) {
  return _wrap(function() { return updateUser(token, id, data) })
}

// ===== App API =====

function api_getApps(token) {
  return _wrap(function() { return getApps(token) })
}

function api_addApp(token, data) {
  return _wrap(function() { return addApp(token, data) })
}

function api_updateApp(token, id, data) {
  return _wrap(function() { return updateApp(token, id, data) })
}

function api_deleteApp(token, id) {
  return _wrap(function() { return deleteApp(token, id) })
}

// ===== SSO API =====

function api_getSsoParams(token) {
  return _wrap(function() { return getSsoParams(token) })
}

// ===== Mail config API =====

function api_getMailConfig(token) {
  return _wrap(function() { return getMailConfig(token) })
}

function api_saveMailConfig(token, config) {
  return _wrap(function() { return saveMailConfig(token, config) })
}

// ===== Error wrapper =====

function _wrap(fn) {
  try {
    var result = fn()
    return { success: true, payload: result }
  } catch(e) {
    var msg = (e && e.message) ? e.message : String(e)
    return { success: false, error: msg || 'Lỗi không xác định' }
  }
}
