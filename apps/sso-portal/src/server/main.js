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

function api_resume(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.USERS, refreshToken)
    if (!found) throw new Error('TOKEN_REVOKED')
    var user = found.user
    if (user['Trạng thái'] === 'Locked') throw new Error('USER_LOCKED')
    if (isBeforeEpoch(SHEETS.USERS, found.userId, found.entry.createdAt)) {
      revokeRefreshToken(SHEETS.USERS, found.userId, refreshToken)
      throw new Error('TOKEN_REVOKED')
    }

    var ownerEmail = ''
    try { ownerEmail = getAppSheet().getOwner().getEmail() } catch(e) {}
    var isOwner = !!(ownerEmail && user['Email'] && user['Email'].toLowerCase() === ownerEmail.toLowerCase())
    var isAdmin = isOwner || user['Quyền'] === 'Quản trị'

    var sessionData = {
      userId: user['ID'],
      username: user['Tên đăng nhập'],
      email: user['Email'],
      displayName: user['Tên nhân viên'] || user['Email'],
      role: isAdmin ? 'admin' : 'user',
      isOwner: isOwner,
      mustChangePass: user['MustChangePass'] === 'TRUE' || user['MustChangePass'] === true,
    }

    var newRefreshToken = rotateRefreshToken(SHEETS.USERS, found.userId, refreshToken)
    var newAccessToken = mintAccessToken(sessionData)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: sessionData,
      parentSheetId: getAppSheet().getId(),
    }
  })
}

function api_logout(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.USERS, refreshToken)
    if (found) {
      revokeRefreshToken(SHEETS.USERS, found.userId, refreshToken)
    }
    return { success: true }
  })
}

function api_logoutAllDevices(accessToken) {
  return _wrap(function() {
    var session = validateAccessToken(accessToken)
    if (!session) throw new Error('TOKEN_EXPIRED')
    return portalLogoutAllDevices(session.userId)
  })
}

function api_createHandoff(accessToken, appId) {
  return _wrap(function() {
    var session = validateAccessToken(accessToken)
    if (!session) throw new Error('TOKEN_EXPIRED')
    if (!appId) throw new Error('Missing appId')
    var handoffToken = mintHandoff(session.userId, appId)
    return { handoffToken: handoffToken }
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
