// ===== Main entry point =====

function doGet(e) {
  try {
    ensureInitialized()

    // License activation callback: ?activate=TOKEN
    var activateToken = e && e.parameter && e.parameter.activate
    if (activateToken) {
      try {
        activateWithToken(activateToken)
      } catch(err) {
        // Ignore — will fall through to license gate
      }
      // Redirect to clean URL (remove token from address bar)
      var cleanUrl = ScriptApp.getService().getUrl()
      return HtmlService.createHtmlOutput(
        '<html><head><script>window.top.location.replace("'
        + cleanUrl.replace(/"/g, '\\"')
        + '")</script></head><body></body></html>'
      )
    }

    // Handle license-server error redirect (?lr=...)
    var lr = e && e.parameter && e.parameter.lr
    if (lr) {
      // Redirect to clean URL (remove error param)
      var cleanUrl = ScriptApp.getService().getUrl()
      return HtmlService.createHtmlOutput(
        '<html><head><script>window.top.location.replace("'
        + cleanUrl.replace(/"/g, '\\"')
        + '")</script></head><body></body></html>'
      )
    }

    // License gate
    if (!checkLicense()) {
      var redirectUrl = ''
      try { redirectUrl = getActivationRedirectUrl() } catch(e2) {}

      var html = '<html><head><meta charset="UTF-8"><style>'
        + 'body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f4f4f4}'
        + '.box{text-align:center;background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:400px}'
        + 'h2{color:#1a56db}p{color:#555}.btn{display:inline-block;margin-top:20px;padding:12px 28px;background:#1a56db;color:#fff;text-decoration:none;border-radius:8px;font-size:16px}'
        + '</style></head><body><div class="box">'
        + '<h2>Ứng dụng chưa được kích hoạt</h2>'
        + '<p>Vui lòng kích hoạt để sử dụng.</p>'
        + (redirectUrl ? '<a class="btn" href="' + redirectUrl + '">Kích hoạt ngay</a>' : '<p style="color:red">Liên hệ quản trị viên.</p>')
        + '</div></body></html>'

      return HtmlService.createHtmlOutput(html)
        .setTitle('Kích hoạt ứng dụng')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    }

    // Serve main app
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Quản Lý Tài Liệu')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)

  } catch(err) {
    return HtmlService.createHtmlOutput(
      '<h2>Lỗi</h2><p>Đã xảy ra lỗi. Vui lòng thử lại.</p>'
    )
  }
}

// ===== Auth API =====

function api_login(username, password) {
  return _wrap(function() { return login(username, password) })
}

function api_logout(token) {
  return _wrap(function() { return logout(token) })
}

function api_validateSession(token) {
  return _wrap(function() { return validateSession(token) })
}

function api_changePassword(token, oldPassword, newPassword) {
  return _wrap(function() { return changePassword(token, oldPassword, newPassword) })
}

function api_adminResetPassword(token, targetUserId, newPassword) {
  return _wrap(function() { return adminResetPassword(token, targetUserId, newPassword) })
}

function api_lockUser(token, targetUserId) {
  return _wrap(function() { return lockUser(token, targetUserId) })
}

function api_unlockUser(token, targetUserId) {
  return _wrap(function() { return unlockUser(token, targetUserId) })
}

// ===== Lookup data API =====

function api_getAllData(token) {
  return _wrap(function() {
    requireAuth(token)
    return getAllData()
  })
}

function api_getDataWithVersion(token, sheetName, clientVersion) {
  return _wrap(function() {
    requireAuth(token)
    return getDataWithVersion(sheetName, clientVersion)
  })
}

function api_checkVersion(token, versions) {
  return _wrap(function() {
    requireAuth(token)
    return checkVersion(versions)
  })
}

// ===== Documents API =====

function api_getDocuments(token, filters) {
  return _wrap(function() { return getDocuments(token, filters) })
}

function api_createDocument(token, data, fileInfo) {
  return _wrap(function() { return createDocument(token, data, fileInfo) })
}

function api_updateDocument(token, id, data, fileInfo) {
  return _wrap(function() { return updateDocument(token, id, data, fileInfo) })
}

function api_deleteDocument(token, id) {
  return _wrap(function() { return deleteDocument(token, id) })
}

function api_getDocumentStats(token) {
  return _wrap(function() { return getDocumentStats(token) })
}

// ===== Category API =====

function api_addCategory(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    return addRow(SHEETS.DANH_MUC, data)
  })
}

function api_updateCategory(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    return updateRow(SHEETS.DANH_MUC, id, data)
  })
}

function api_deleteCategory(token, id) {
  return _wrap(function() {
    requireAdmin(token)
    return deleteRow(SHEETS.DANH_MUC, id)
  })
}

// ===== Document Type API =====

function api_addLoaiHoSo(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    return addRow(SHEETS.LOAI_HO_SO, data)
  })
}

function api_updateLoaiHoSo(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    return updateRow(SHEETS.LOAI_HO_SO, id, data)
  })
}

function api_deleteLoaiHoSo(token, id) {
  return _wrap(function() {
    requireAdmin(token)
    return deleteRow(SHEETS.LOAI_HO_SO, id)
  })
}

// ===== User Management API =====

function api_addUser(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    return addRow(SHEETS.USERS, data)
  })
}

function api_updateUser(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    return updateRow(SHEETS.USERS, id, data)
  })
}

// ===== Settings API =====

function api_getConfig(token, key) {
  return _wrap(function() {
    requireAdmin(token)
    return { value: getConfig(key) }
  })
}

function api_setConfig(token, key, value) {
  return _wrap(function() {
    requireAdmin(token)
    setConfig(key, value)
    return { success: true }
  })
}

// ===== Error wrapper =====

function _wrap(fn) {
  try {
    if (!checkLicense()) throw new Error('Ứng dụng chưa được kích hoạt')
    var result = fn()
    return { success: true, payload: result }
  } catch(e) {
    return { success: false, error: e.message }
  }
}
