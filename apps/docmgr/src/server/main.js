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
      var safeCleanUrl = cleanUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      return HtmlService.createHtmlOutput(
        '<html><head><meta charset="UTF-8"><base target="_top"><style>'
        + 'body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f2f5}'
        + '.box{text-align:center;background:#fff;padding:48px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:400px}'
        + '.btn{display:inline-block;padding:14px 32px;background:#1a56db;color:#fff;text-decoration:none;border-radius:8px;font-size:16px}'
        + '</style></head><body><div class="box">'
        + '<div style="font-size:48px;margin-bottom:16px">✅</div>'
        + '<h2 style="color:#1a56db;margin-bottom:8px">Kích hoạt thành công</h2>'
        + '<p style="color:#6b7280;margin-bottom:24px">Nhấn nút bên dưới để vào ứng dụng.</p>'
        + '<a class="btn" href="' + safeCleanUrl + '">Vào ứng dụng →</a>'
        + '</div></body></html>'
      ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    }

    // Handle license-server error redirect (?lr=...)
    var lr = e && e.parameter && e.parameter.lr
    if (lr) {
      var cleanUrl = ScriptApp.getService().getUrl()
      var safeCleanUrl = cleanUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      return HtmlService.createHtmlOutput(
        '<html><head><meta charset="UTF-8"><base target="_top"><style>'
        + 'body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f2f5}'
        + '.box{text-align:center;background:#fff;padding:48px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:400px}'
        + '.btn{display:inline-block;padding:14px 32px;background:#1a56db;color:#fff;text-decoration:none;border-radius:8px;font-size:16px}'
        + '</style></head><body><div class="box">'
        + '<div style="font-size:48px;margin-bottom:16px">🔄</div>'
        + '<h2 style="color:#1a56db;margin-bottom:8px">Quay lại ứng dụng</h2>'
        + '<p style="color:#6b7280;margin-bottom:24px">Nhấn nút bên dưới để tiếp tục.</p>'
        + '<a class="btn" href="' + safeCleanUrl + '">Tiếp tục →</a>'
        + '</div></body></html>'
      ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    }

    // License gate
    if (!checkLicense()) {
      var redirectUrl = ''
      try { redirectUrl = getActivationRedirectUrl() } catch(e2) {}

      var html = '<html><head><meta charset="UTF-8"><base target="_top"><style>'
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
      .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)

  } catch(err) {
    return HtmlService.createHtmlOutput(
      '<h2>Lỗi</h2><p>' + (err && err.message ? err.message : String(err)) + '</p>'
    )
  }
}

// ===== Auth API =====

function api_autoLogin() {
  return _wrap(function() { return autoLogin() })
}

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

function api_createDocument(token, data, fileInfos) {
  return _wrap(function() { return createDocument(token, data, fileInfos) })
}

function api_updateDocument(token, id, data, fileInfos, keepFileIds) {
  return _wrap(function() { return updateDocument(token, id, data, fileInfos, keepFileIds) })
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

// ===== Department API =====

function api_addPhongBan(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    return addRow(SHEETS.PHONG_BAN, data)
  })
}

function api_updatePhongBan(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    return updateRow(SHEETS.PHONG_BAN, id, data)
  })
}

function api_deletePhongBan(token, id) {
  return _wrap(function() {
    requireAdmin(token)
    return deleteRow(SHEETS.PHONG_BAN, id)
  })
}

// ===== Supplier API =====

function api_addNhaCungCap(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    return addRow(SHEETS.NHA_CUNG_CAP, data)
  })
}

function api_updateNhaCungCap(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    return updateRow(SHEETS.NHA_CUNG_CAP, id, data)
  })
}

function api_deleteNhaCungCap(token, id) {
  return _wrap(function() {
    requireAdmin(token)
    return deleteRow(SHEETS.NHA_CUNG_CAP, id)
  })
}

// ===== Project API =====

function api_addDuAn(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    return addRow(SHEETS.DU_AN, data)
  })
}

function api_updateDuAn(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    return updateRow(SHEETS.DU_AN, id, data)
  })
}

function api_deleteDuAn(token, id) {
  return _wrap(function() {
    requireAdmin(token)
    return deleteRow(SHEETS.DU_AN, id)
  })
}

// ===== User Management API =====

function api_getUsers(token) {
  return _wrap(function() {
    requireAdmin(token)
    var users = getSheetData(SHEETS.USERS)
    var roles = getSheetData(SHEETS.APP_ROLES)
    return users.map(function(u) {
      var appRole = roles.find(function(r) {
        return String(r['UserID']) === String(u['ID']) && r['AppID'] === APP_ID
      })
      return {
        ID: u['ID'],
        'Tên đăng nhập': u['Tên đăng nhập'],
        'Email': u['Email'],
        'Trạng thái': u['Trạng thái'],
        'Quyền': appRole ? appRole['Quyền'] : '',
        'Phân quyền chi tiết': appRole ? (appRole['Phân quyền chi tiết'] || '') : '',
        'Đăng nhập cuối': u['Đăng nhập cuối'],
        'Phòng ban': u['Phòng ban'] || '',
      }
    })
  })
}

function api_addUser(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    var userData = {
      'Tên đăng nhập': data['Tên đăng nhập'],
      'Mật khẩu': '',
      'Email': data['Email'] || '',
      'Trạng thái': 'Active',
      'MustChangePass': 'FALSE',
      'Đăng nhập cuối': '',
      'Phòng ban': data['Phòng ban'] ? JSON.stringify(data['Phòng ban']) : '',
    }
    var added = addRow(SHEETS.USERS, userData)
    var role = data['Quyền'] || 'Xem'
    var permJson = data['permissions'] ? JSON.stringify(data['permissions']) : ''
    addRow(SHEETS.APP_ROLES, {
      'UserID': added['ID'],
      'AppID': APP_ID,
      'Quyền': role,
      'Phân quyền chi tiết': permJson,
    })
    logAudit(null, 'Tạo', 'Người dùng', data['Tên đăng nhập'], JSON.stringify({ email: data['Email'], role: role }))
    return added
  })
}

function api_updateUser(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    var updateData = {}
    if (data['Tên đăng nhập'] !== undefined) updateData['Tên đăng nhập'] = data['Tên đăng nhập']
    if (data['Email'] !== undefined) updateData['Email'] = data['Email']
    if (data['Phòng ban'] !== undefined) updateData['Phòng ban'] = Array.isArray(data['Phòng ban']) ? JSON.stringify(data['Phòng ban']) : (data['Phòng ban'] || '')
    if (Object.keys(updateData).length > 0) updateRow(SHEETS.USERS, id, updateData)
    // Update role and permissions in APP_ROLES
    if (data['Quyền'] !== undefined || data['permissions'] !== undefined) {
      var roles = getSheetData(SHEETS.APP_ROLES)
      var existing = roles.find(function(r) {
        return String(r['UserID']) === String(id) && r['AppID'] === APP_ID
      })
      var roleUpdates = {}
      if (data['Quyền'] !== undefined) roleUpdates['Quyền'] = data['Quyền']
      if (data['permissions'] !== undefined) roleUpdates['Phân quyền chi tiết'] = JSON.stringify(data['permissions'])
      if (existing) {
        updateRow(SHEETS.APP_ROLES, existing['ID'], roleUpdates)
      } else {
        addRow(SHEETS.APP_ROLES, {
          'UserID': id, 'AppID': APP_ID,
          'Quyền': data['Quyền'] || 'Xem',
          'Phân quyền chi tiết': data['permissions'] ? JSON.stringify(data['permissions']) : '',
        })
      }
    }
    logAudit(null, 'Sửa', 'Người dùng', String(id), JSON.stringify(data))
    return { success: true }
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

function api_browseDriveFolders(token, parentFolderId) {
  return _wrap(function() {
    requireAdmin(token)
    var parent = parentFolderId
      ? DriveApp.getFolderById(parentFolderId)
      : DriveApp.getRootFolder()
    var folders = []
    var iter = parent.getFolders()
    while (iter.hasNext()) {
      var f = iter.next()
      folders.push({ id: f.getId(), name: f.getName() })
    }
    folders.sort(function(a, b) {
      return a.name.localeCompare(b.name)
    })
    return {
      current: { id: parent.getId(), name: parent.getName() },
      folders: folders
    }
  })
}

// ===== Audit Logs API =====

function logAudit(session, action, type, target, details) {
  try {
    var username = session && session.username ? session.username : 'system'
    var email = session && session.email ? session.email : ''
    addRow(SHEETS.NHAT_KY, {
      'Thời gian': new Date().toISOString(),
      'Người dùng': username,
      'Email': email,
      'Hành động': action || '',
      'Loại': type || '',
      'Đối tượng': target || '',
      'Chi tiết': details || '',
    })
  } catch(e) {
    Logger.log('logAudit error: ' + e.message)
  }
}

function api_getAuditLogs(token, filters) {
  return _wrap(function() {
    requireAdmin(token)
    filters = filters || {}
    var logs = getSheetData(SHEETS.NHAT_KY)
    logs = logs.slice().reverse() // newest first
    if (filters.type) {
      logs = logs.filter(function(l) { return l['Loại'] === filters.type })
    }
    if (filters.user) {
      var q = filters.user.toLowerCase()
      logs = logs.filter(function(l) { return (l['Người dùng'] || '').toLowerCase().indexOf(q) !== -1 })
    }
    return { data: logs.slice(0, 200) }
  })
}

function api_markAsRead(token, docId) {
  return _wrap(function() {
    var session = requireAuth(token)
    // Check if already marked
    var reads = getSheetData(SHEETS.DA_DOC)
    var exists = reads.find(function(r) {
      return String(r['UserID']) === String(session.userId) && String(r['DocID']) === String(docId)
    })
    if (!exists) {
      addRow(SHEETS.DA_DOC, {
        'UserID': session.userId,
        'DocID': docId,
        'Thời gian': new Date().toISOString(),
      })
    }
    return { success: true }
  })
}

function api_getUnreadCount(token) {
  return _wrap(function() {
    var session = requireAuth(token)
    var docs = getSheetData(SHEETS.HO_SO)
    var reads = getSheetData(SHEETS.DA_DOC)
    var userReads = reads.filter(function(r) { return String(r['UserID']) === String(session.userId) })
    var readDocIds = userReads.map(function(r) { return String(r['DocID']) })
    var unread = docs.filter(function(d) { return readDocIds.indexOf(String(d['ID'])) === -1 })
    return { count: unread.length }
  })
}

function api_getReadDocIds(token) {
  return _wrap(function() {
    var session = requireAuth(token)
    var reads = getSheetData(SHEETS.DA_DOC)
    var userReads = reads.filter(function(r) { return String(r['UserID']) === String(session.userId) })
    var readIds = userReads.map(function(r) { return String(r['DocID']) })
    return { readIds: readIds }
  })
}

function api_markMultipleAsRead(token, docIds) {
  return _wrap(function() {
    var session = requireAuth(token)
    if (!Array.isArray(docIds) || docIds.length === 0) return { success: true, marked: 0 }
    var reads = getSheetData(SHEETS.DA_DOC)
    var existingIds = reads
      .filter(function(r) { return String(r['UserID']) === String(session.userId) })
      .map(function(r) { return String(r['DocID']) })
    var toMark = docIds.filter(function(id) { return existingIds.indexOf(String(id)) === -1 })
    toMark.forEach(function(id) {
      addRow(SHEETS.DA_DOC, {
        'UserID': session.userId,
        'DocID': id,
        'Thời gian': new Date().toISOString(),
      })
    })
    return { success: true, marked: toMark.length }
  })
}

// ===== Comments API =====

function api_getComments(token, docId) {
  return _wrap(function() { return getComments(token, docId) })
}

function api_addComment(token, docId, content) {
  return _wrap(function() { return addComment(token, docId, content) })
}

// ===== Error wrapper =====

function _wrap(fn) {
  try {
    if (!checkLicense()) throw new Error('Ứng dụng chưa được kích hoạt')
    var result = fn()
    return { success: true, payload: result }
  } catch(e) {
    var msg = (e && e.message) ? e.message : String(e)
    return { success: false, error: msg || 'Lỗi không xác định' }
  }
}
