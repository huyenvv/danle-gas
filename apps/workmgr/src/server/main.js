// ===== Main entry point — SSO child app =====

function doGet(e) {
  try {
    ensureInitialized()

    var ssoEmail = e && e.parameter && e.parameter.sso_email
    var ssoToken = e && e.parameter && e.parameter.sso_token
    var parentSheetId = e && e.parameter && e.parameter.parent_sheet_id

    // Store parent sheet ID on first visit from SSO Portal
    if (parentSheetId) {
      ssoStoreParentSheetId(parentSheetId)
    }

    var injectedToken = ''

    // SSO authentication via URL params from parent portal
    if (ssoEmail && ssoToken) {
      Logger.log('SSO params: email=' + ssoEmail + ', token=' + (ssoToken ? 'YES' : 'NO') + ', parentId=' + parentSheetId)
      // Always read fresh APP_ROLES on SSO login so admin role changes take effect immediately
      invalidateSheetCache(SHEETS.APP_ROLES)
      var ssoUser = ssoValidateToken(ssoEmail, ssoToken)
      Logger.log('SSO validate result: ' + (ssoUser ? 'user found ID=' + ssoUser['ID'] : 'null'))
      if (!ssoUser) {
        return _ssoErrorPage('Phiên SSO không hợp lệ', 'Token đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại từ SSO Portal.')
      }

      // Check local authorization
      var roles = getSheetData(SHEETS.APP_ROLES)
      var appRole = roles.find(function(r) {
        return String(r['UserID']) === String(ssoUser['ID']) && r['AppID'] === APP_ID
      })

      // Auto-assign role if not found
      if (!appRole) {
        var ownerEmail = ''
        try { ownerEmail = getCentralSheet().getOwner().getEmail() } catch(e) {}
        var autoRole = (ssoUser['Email'] && ownerEmail &&
          String(ssoUser['Email']).toLowerCase() === ownerEmail.toLowerCase()) ? 'admin' : 'Nhân viên'

        addRow(SHEETS.APP_ROLES, {
          'UserID': ssoUser['ID'],
          'Tên đăng nhập': ssoUser['Tên đăng nhập'],
          'AppID': APP_ID,
          'Quyền': autoRole,
          'Phân quyền chi tiết': '',
        })
        invalidateSheetCache(SHEETS.APP_ROLES)
        appRole = { 'Quyền': autoRole, 'Phân quyền chi tiết': '' }
        Logger.log('Auto-assigned role: ' + autoRole + ' for user ' + ssoUser['Email'])
      }

      injectedToken = ssoCreateSession(ssoUser, appRole)
    }

    // Serve HTML with optional SSO token injection
    var content = HtmlService.createHtmlOutputFromFile('index').getContent()
    if (injectedToken) {
      content = content.replace('</head>', '<script>window.__SSO_TOKEN__="' + injectedToken + '";</script></head>')
    }
    return HtmlService.createHtmlOutput(content)
      .setTitle('Quản Lý Công Việc')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)

  } catch(err) {
    return HtmlService.createHtmlOutput(
      '<h2>Lỗi</h2><p>' + (err && err.message ? err.message : String(err)) + '</p>'
    )
  }
}

function _ssoErrorPage(title, message) {
  return HtmlService.createHtmlOutput(
    '<html><head><meta charset="UTF-8"><style>'
    + 'body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f2f5}'
    + '.box{text-align:center;background:#fff;padding:48px 32px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:400px}'
    + '</style></head><body><div class="box">'
    + '<div style="font-size:48px;margin-bottom:16px">&#128274;</div>'
    + '<h2 style="color:#c62828;margin-bottom:8px">' + title + '</h2>'
    + '<p style="color:#6b7280">' + message + '</p>'
    + '</div></body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

// ===== Session API =====

function api_logout(token) {
  return _wrap(function() { return logout(token) })
}

function api_validateSession(token) {
  return _wrap(function() {
    var session = validateSession(token)
    if (!session) return null

    // Re-read APP_ROLES to pick up any role changes made by admin since login
    var roles = getSheetData(SHEETS.APP_ROLES)
    var appRole = roles.find(function(r) {
      return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID
    })

    if (appRole && appRole['Quyền'] !== session.role) {
      var perms = getPermissions(appRole)
      session.role = appRole['Quyền']
      session.permissions = perms
      cachePut('sess_' + token, session, SESSION_TTL)
    }

    return session
  })
}

// ===== Lookup data API =====

function api_getAllData(token) {
  return _wrap(function() {
    requireAuth(token)
    return getAllData()
  })
}

// ===== Departments API =====

function api_getDepartments(token, filters) {
  return _wrap(function() { return getDepartments(token, filters) })
}

function api_createDepartment(token, data) {
  return _wrap(function() { return createDepartment(token, data) })
}

function api_updateDepartment(token, id, data) {
  return _wrap(function() { return updateDepartment(token, id, data) })
}

function api_deleteDepartment(token, id) {
  return _wrap(function() { return _deleteDepartment(token, id) })
}

// Generic paginated, filterable log reader. Mirrors docmgr's audit endpoint.
// userField defaults to 'Tên người dùng' (workmgr's HOAT_DONG column) — docmgr
// uses 'Người dùng' on its NHAT_KY sheet.
function _readLogPage(sheetName, filters, userField) {
  filters = filters || {}
  var uf = userField || 'Tên người dùng'
  var limit = Math.max(1, Math.min(500, Number(filters.limit) || 50))
  var offset = Math.max(0, Number(filters.offset) || 0)
  var keyword = String(filters.keyword || '').toLowerCase()

  var logs = getSheetData(sheetName)
  logs = logs.slice().sort(function(a, b) {
    var av = a['Thời gian'] ? new Date(a['Thời gian']).getTime() : 0
    var bv = b['Thời gian'] ? new Date(b['Thời gian']).getTime() : 0
    return bv - av
  })
  var types = [], users = []
  logs.forEach(function(l) {
    var type = l['Loại'] || ''
    if (type && types.indexOf(type) === -1) types.push(type)
    var user = l[uf] || ''
    if (user && users.indexOf(user) === -1) users.push(user)
  })
  users.sort()
  if (filters.type) {
    logs = logs.filter(function(l) { return l['Loại'] === filters.type })
  }
  if (filters.user) {
    var q = String(filters.user).toLowerCase()
    logs = logs.filter(function(l) { return String(l[uf] || '').toLowerCase().indexOf(q) !== -1 })
  }
  if (keyword) {
    logs = logs.filter(function(l) {
      return (
        String(l[uf] || '').toLowerCase().indexOf(keyword) !== -1 ||
        String(l['Loại'] || '').toLowerCase().indexOf(keyword) !== -1 ||
        String(l['Mô tả'] || l['Đối tượng'] || '').toLowerCase().indexOf(keyword) !== -1 ||
        String(l['Mã đối tượng'] || l['Chi tiết'] || '').toLowerCase().indexOf(keyword) !== -1
      )
    })
  }
  return {
    data: logs.slice(offset, offset + limit),
    hasMore: offset + limit < logs.length,
    total: logs.length,
    types: types,
    users: users,
  }
}

function api_getActivities(token, filters) {
  return _wrap(function() {
    requireAuth(token)
    return _readLogPage(SHEETS.HOAT_DONG, filters, 'Tên người dùng')
  })
}

function api_getAuditLogs(token, filters) {
  return _wrap(function() {
    var session = requireAuth(token)
    if (!_isAdminRole(session.role)) throw new Error('Chỉ Admin/Giám đốc được xem nhật ký')
    return _readLogPage(SHEETS.NHAT_KY, filters, 'Người dùng')
  })
}

function api_getDashboardStats(token, filters) {
  return _wrap(function() { return getDashboardStats(token, filters) })
}

// ===== Tasks API =====

function api_getTasks(token, filters) {
  return _wrap(function() { return getTasks(token, filters) })
}

function api_createTask(token, data) {
  return _wrap(function() { return createTask(token, data) })
}

function api_updateTask(token, id, data) {
  return _wrap(function() { return updateTask(token, id, data) })
}

function api_updateTaskStatus(token, id, status, departmentId) {
  return _wrap(function() { return updateTaskStatus(token, id, status, departmentId) })
}

function api_batchUpdateTaskStatus(token, items) {
  return _wrap(function() {
    requireAuth(token)
    if (!Array.isArray(items)) throw new Error('items must be array')
    var results = []
    items.forEach(function(item) {
      try {
        updateTaskStatus(token, item.id, item.status, item.deptId)
        results.push({ id: item.id, ok: true })
      } catch(e) {
        results.push({ id: item.id, ok: false, error: e.message })
      }
    })
    return results
  })
}

function api_updateTaskProgress(token, id, departmentId, progress) {
  return _wrap(function() { return updateTaskProgress(token, id, departmentId, progress) })
}

function api_deleteTask(token, id, departmentId) {
  return _wrap(function() { return _deleteTask(token, id, departmentId) })
}

// ===== Archive API =====

function api_runArchive(token) {
  return _wrap(function() {
    var session = requireAuth(token)
    if (!_isAdminRole(session.role)) throw new Error('Chỉ Admin/Giám đốc được chạy archive')
    return archiveOldCompletedTasks()
  })
}

function api_setupArchiveTrigger(token) {
  return _wrap(function() {
    var session = requireAuth(token)
    if (!_isAdminRole(session.role)) throw new Error('Chỉ Admin/Giám đốc được cài trigger')
    return setupArchiveTrigger()
  })
}

function api_rebuildTaskIndex(token) {
  return _wrap(function() {
    var session = requireAuth(token)
    if (!_isAdminRole(session.role)) throw new Error('Chỉ Admin/Giám đốc được rebuild index')
    return rebuildTaskIndex()
  })
}

// ===== Schedules API =====

function api_getSchedules(token, filters) {
  return _wrap(function() { return getSchedules(token, filters) })
}

function api_createSchedule(token, data) {
  return _wrap(function() { return createSchedule(token, data) })
}

function api_approveSchedule(token, id) {
  return _wrap(function() { return approveSchedule(token, id) })
}

function api_rejectSchedule(token, id, reason) {
  return _wrap(function() { return rejectSchedule(token, id, reason) })
}

function api_updateSchedule(token, id, data) {
  return _wrap(function() { return updateSchedule(token, id, data) })
}

function api_deleteSchedule(token, id) {
  return _wrap(function() { return _deleteSchedule(token, id) })
}

// ===== Comments API =====

function api_getComments(token, objectId, objectType) {
  return _wrap(function() { return getComments(token, objectId, objectType) })
}

function api_addComment(token, objectId, objectType, content) {
  return _wrap(function() { return addComment(token, objectId, objectType, content) })
}

function api_deleteComment(token, commentId) {
  return _wrap(function() { return _deleteComment(token, commentId) })
}

// ===== Labels API =====

function api_addLabel(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    return addRow(SHEETS.NHAN, data)
  })
}

function api_updateLabel(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    return updateRow(SHEETS.NHAN, id, data)
  })
}

function api_deleteLabel(token, id) {
  return _wrap(function() {
    requireAdmin(token)
    return deleteRow(SHEETS.NHAN, id)
  })
}

// ===== User Management API (authorization-only) =====

function api_getUsers(token) {
  return _wrap(function() {
    requireAdmin(token)
    var parentId = ssoGetParentSheetId()
    if (!parentId) throw new Error('Chưa cấu hình SSO. Vui lòng truy cập lần đầu từ SSO Portal.')
    var parentSs = SpreadsheetApp.openById(parentId)
    var parentSheet = parentSs.getSheetByName('_Người Dùng')
    if (!parentSheet) throw new Error('Không tìm thấy sheet _Người Dùng trong SSO Portal')
    var parentUsers = rowsToObjects(parentSheet.getDataRange().getValues())
    var roles = getSheetData(SHEETS.APP_ROLES)
    var ownerEmail = ''
    try { ownerEmail = getCentralSheet().getOwner().getEmail().toLowerCase() } catch(e) {}
    return parentUsers
      .filter(function(u) {
        return !(ownerEmail && u['Email'] && u['Email'].toLowerCase() === ownerEmail)
      })
      .map(function(u) {
        var appRole = roles.find(function(r) {
          return String(r['UserID']) === String(u['ID']) && r['AppID'] === APP_ID
        })
        return {
          ID: u['ID'],
          'Tên đăng nhập': u['Tên đăng nhập'],
          'Tên nhân viên': u['Tên nhân viên'] || u['Tên đăng nhập'] || '',
          'Email': u['Email'],
          'Trạng thái': u['Trạng thái'],
          'Quyền': appRole ? appRole['Quyền'] : '',
          'Phân quyền chi tiết': appRole ? (appRole['Phân quyền chi tiết'] || '') : '',
        }
      })
  })
}

function api_updateUser(token, id, data) {
  return _wrap(function() {
    var session = requireAdmin(token)
    // Giám đốc cannot change own role or assign privileged roles
    if (session.role === 'Giám đốc') {
      if (String(id) === String(session.userId)) throw new Error('Không thể thay đổi quyền của chính mình')
      var allRoles = getSheetData(SHEETS.APP_ROLES)
      var targetRole = allRoles.find(function(r) { return String(r['UserID']) === String(id) && r['AppID'] === APP_ID })
      if (targetRole && (targetRole['Quyền'] === 'Giám đốc' || targetRole['Quyền'] === 'admin')) {
        throw new Error('Không thể thay đổi quyền của tài khoản quản trị')
      }
      if (data['Quyền'] === 'Giám đốc' || data['Quyền'] === 'admin') {
        throw new Error('Giám đốc không thể gán quyền Giám đốc hoặc admin')
      }
    }
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
        'UserID': id,
        'Tên đăng nhập': data['Tên đăng nhập'] || '',
        'AppID': APP_ID,
        'Quyền': data['Quyền'] || 'Xem',
        'Phân quyền chi tiết': data['permissions'] ? JSON.stringify(data['permissions']) : '',
      })
    }
    logAudit(null, 'Phân quyền', 'Người dùng', String(id), JSON.stringify(data))
    return { success: true }
  })
}

function api_removeUserRole(token, id) {
  return _wrap(function() {
    var session = requireAdmin(token)
    if (session.role === 'Giám đốc') {
      if (String(id) === String(session.userId)) throw new Error('Không thể xóa quyền của chính mình')
      var allRoles = getSheetData(SHEETS.APP_ROLES)
      var targetRole = allRoles.find(function(r) { return String(r['UserID']) === String(id) && r['AppID'] === APP_ID })
      if (targetRole && targetRole['Quyền'] === 'Giám đốc') throw new Error('Không thể xóa quyền của Giám đốc khác')
    }
    var roles = getSheetData(SHEETS.APP_ROLES)
    var existing = roles.find(function(r) {
      return String(r['UserID']) === String(id) && r['AppID'] === APP_ID
    })
    if (existing) {
      deleteRow(SHEETS.APP_ROLES, existing['ID'])
    }
    logAudit(null, 'Xóa quyền', 'Người dùng', String(id), '')
    return { success: true }
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

function logActivity(session, type, objectType, objectId, description) {
  try {
    var userName = resolveUserName(session.userId)
    addRow(SHEETS.HOAT_DONG, {
      'Loại': type,
      'Mô tả': description || '',
      'Đối tượng': objectType,
      'Mã đối tượng': objectId,
      'UserID': session.userId,
      'Tên người dùng': userName,
      'Thời gian': new Date().toISOString(),
    })
  } catch(e) {
    Logger.log('logActivity error: ' + e.message)
  }
}

function api_getAuditLogs(token, filters) {
  return _wrap(function() {
    requireAdmin(token)
    filters = filters || {}
    var limit = Math.max(1, Number(filters.limit || 20))
    var offset = Math.max(0, Number(filters.offset || 0))
    var keyword = String(filters.keyword || '').toLowerCase()
    var logs = getSheetData(SHEETS.NHAT_KY)
    logs = logs.slice().reverse()
    var types = []
    logs.forEach(function(l) {
      var type = l['Loại'] || ''
      if (type && types.indexOf(type) === -1) types.push(type)
    })
    if (filters.type) {
      logs = logs.filter(function(l) { return l['Loại'] === filters.type })
    }
    if (keyword) {
      logs = logs.filter(function(l) {
        return (
          String(l['Người dùng'] || '').toLowerCase().indexOf(keyword) !== -1 ||
          String(l['Loại'] || '').toLowerCase().indexOf(keyword) !== -1 ||
          String(l['Đối tượng'] || '').toLowerCase().indexOf(keyword) !== -1 ||
          String(l['Chi tiết'] || '').toLowerCase().indexOf(keyword) !== -1
        )
      })
    }
    return {
      data: logs.slice(offset, offset + limit),
      hasMore: offset + limit < logs.length,
      total: logs.length,
      types: types,
    }
  })
}

// ===== Error wrapper (license check disabled for SSO) =====

function _wrap(fn) {
  try {
    var result = fn()
    return { success: true, payload: result }
  } catch(e) {
    var msg = (e && e.message) ? e.message : String(e)
    return { success: false, error: msg || 'Lỗi không xác định' }
  }
}
