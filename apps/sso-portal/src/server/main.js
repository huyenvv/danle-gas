// ===== SSO Portal — main entry point =====

function doGet() {
  ensureInitialized()
  var content = HtmlService.createHtmlOutputFromFile('index').getContent()

  // Inject initial data — bỏ 1 round trip api_getApps khi vào Dashboard lần đầu.
  // Apps URLs không bí mật (child apps tự auth qua ssoValidateToken).
  try {
    var apps = getSheetData(SHEETS.APPS)
    var companyName = getConfig('COMPANY_NAME') || ''
    var injected = 'window.__INITIAL_APPS__=' + JSON.stringify(apps) + ';'
                 + 'window.__COMPANY_NAME__=' + JSON.stringify(companyName) + ';'
    content = content.replace('</head>', '<script>' + injected + '</script></head>')
  } catch(e) {
    Logger.log('doGet inject error: ' + e.message)
  }

  return HtmlService.createHtmlOutput(content)
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

// Rotation cadence — must be < docmgr SESSION_TTL (6h) để child kịp reload trước khi cache chết
var SSO_ROTATE_INTERVAL_MS = 5 * 3600 * 1000 // 5h

function api_validateSession(token) {
  return _wrap(function() {
    var session = validateSession(token)
    if (!session) return null

    // Mỗi 5h kể từ lần rotate gần nhất: sinh SSO_Token mới + extend SSO_Expiry.
    // Client phát hiện ssoToken đổi → update localStorage + reload iframe app con.
    var nowMs = new Date().getTime()
    var needsRotate = !session.lastRotatedAt || (nowMs - session.lastRotatedAt) >= SSO_ROTATE_INTERVAL_MS
    if (needsRotate) {
      try {
        var users = getSheetData(SHEETS.USERS)
        var user = users.find(function(u) { return String(u['ID']) === String(session.userId) })
        if (user && user['SSO_Token']) {
          var newSsoToken = generateUuid()
          var newExpiry = nowMs + (SSO_TOKEN_TTL * 1000)
          updateRow(SHEETS.USERS, user['ID'], { 'SSO_Token': newSsoToken, 'SSO_Expiry': newExpiry })
          session.ssoToken = newSsoToken
          session.expiresAt = newExpiry
          session.lastRotatedAt = nowMs
          cachePut('sess_' + token, session, SESSION_TTL)
        }
      } catch(e) { Logger.log('SSO token rotate error: ' + e.message) }
    }

    return session
  })
}

function api_changePassword(token, oldPassword, newPassword) {
  return _wrap(function() { return portalChangePassword(token, oldPassword, newPassword) })
}

function api_adminResetPassword(token, targetUserId) {
  return _wrap(function() { return portalAdminResetPassword(token, targetUserId) })
}

function api_bulkResetPassword(token, userIds) {
  return _wrap(function() { return portalBulkResetPassword(token, userIds) })
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
