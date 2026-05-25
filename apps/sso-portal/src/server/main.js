// ===== SSO Portal — main entry point =====

function doGet() {
  ensureInitialized()
  var content = HtmlService.createHtmlOutputFromFile('index').getContent()

  // Inject initial data — bỏ 1 round trip api_getApps khi vào Dashboard lần đầu.
  // Apps URLs không bí mật (child apps tự auth qua handoff token).
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

function api_login(email, password, deviceType) {
  return _wrap(function() { return login(email, password, deviceType) })
}

function api_resume(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.USERS, refreshToken)
    if (!found) throw new Error('TOKEN_REVOKED')
    var user = found.user
    if (user['Trạng thái'] === 'Locked') throw new Error('USER_LOCKED')
    if (isBeforeEpoch(SHEETS.USERS, found.userId, found.entry.createdAt, found.entry.label)) {
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

    var newRefreshToken = touchRefreshToken(SHEETS.USERS, found.userId, refreshToken)
    var newAccessToken = mintAccessToken(sessionData, SHEETS.USERS)

    // Update device access token tracking — revoke stale AT first so it can't be replayed
    var resumeLabel = found.entry.label || 'desktop'
    var deviceAtKey = 'device_at_' + sessionData.userId + '_' + resumeLabel
    var staleAt = cacheGet(deviceAtKey)
    if (staleAt) revokeAccessToken(staleAt)
    cachePut(deviceAtKey, newAccessToken, ACCESS_TOKEN_TTL)

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
      var label = found.entry.label || 'desktop'
      var deviceAtKey = 'device_at_' + found.userId + '_' + label
      var oldAt = cacheGet(deviceAtKey)
      if (oldAt) revokeAccessToken(oldAt)
      cacheRemove(deviceAtKey)
      // Per-device epoch — invalidates child-app refresh tokens of the same device-type.
      // Other device (e.g. mobile) keeps working.
      bumpEpochDevice(SHEETS.USERS, found.userId, label)
      revokeRefreshToken(SHEETS.USERS, found.userId, refreshToken)
      logAudit({ username: found.user['Tên đăng nhập'], email: found.user['Email'] }, 'Đăng xuất', 'Xác thực', found.user['Tên đăng nhập'] || '', label)
    }
    return { success: true }
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

// ===== Phòng ban API =====

function api_getPhongBan(token) {
  return _wrap(function() { return getPhongBan(token) })
}

function api_addPhongBan(token, data) {
  return _wrap(function() { return addPhongBan(token, data) })
}

function api_updatePhongBan(token, id, data) {
  return _wrap(function() { return updatePhongBan(token, id, data) })
}

function api_deletePhongBan(token, id) {
  return _wrap(function() { return deletePhongBan(token, id) })
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

// ===== Org structure API =====

function api_getOrgStructure(token) {
  return _wrap(function() { return getOrgStructure(token) })
}

function api_saveAssignment(token, data) {
  return _wrap(function() { return saveAssignment(token, data) })
}

function api_removeAssignment(token, assignmentId) {
  return _wrap(function() { return removeAssignment(token, assignmentId) })
}

function api_batchSaveAssignments(token, operations) {
  return _wrap(function() { return batchSaveAssignments(token, operations) })
}

// ===== SSO API =====

function api_getSsoParams(token) {
  return _wrap(function() { return getSsoParams(token) })
}

function api_portalSync(token) {
  return _wrap(function() { return portalSync(token) })
}

// ===== Audit log API =====

function api_getAuditLogs(token, filters) {
  return _wrap(function() { return getAuditLogs(token, filters) })
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
