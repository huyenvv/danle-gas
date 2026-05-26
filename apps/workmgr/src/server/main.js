// ===== Main entry point — SSO child app (deferred auth) =====

function doGet(e) {
  if (e && e.parameter && e.parameter.prefetch === '1') {
    return HtmlService.createHtmlOutput('<!doctype html><title>warm</title>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
  }

  ensureInitialized()

  var ssoToken = e && e.parameter && e.parameter.token
  var parentSheetId = e && e.parameter && e.parameter.parent
  if (parentSheetId) ssoStoreParentSheetId(parentSheetId)

  var content = HtmlService.createHtmlOutputFromFile('index').getContent()
  if (ssoToken) {
    var inject = 'window.__SSO_TOKEN__=' + JSON.stringify(ssoToken) + ';'
      + 'window.__SSO_PARENT__=' + JSON.stringify(parentSheetId || ssoGetParentSheetId() || '') + ';'
    content = content.replace('</head>', '<script>' + inject + '</script></head>')
  }
  return HtmlService.createHtmlOutput(content)
    .setTitle('Quản Lý Công Việc')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

// ===== Session API =====

function api_ssoLogin(parentSheetId, ssoToken, deviceType) {
  return _wrap(function() {
    if (!parentSheetId || !ssoToken) throw new Error('INVALID_SSO')
    var ssoUser = validateAccessTokenCrossScript(parentSheetId, ssoToken)
    if (!ssoUser) throw new Error('SSO_TOKEN_EXPIRED')

    var userRow = {
      'ID': ssoUser.userId,
      'Tên đăng nhập': ssoUser.username,
      'Email': ssoUser.email,
      'Tên nhân viên': ssoUser.name,
    }

    invalidateSheetCache(SHEETS.APP_ROLES)
    var roles = getSheetData(SHEETS.APP_ROLES)
    var appRole = roles.find(function(r) {
      return String(r['UserID']) === String(userRow['ID']) && r['AppID'] === APP_ID
    })
    if (!appRole) {
      var ownerEmail = ''
      try { ownerEmail = getCentralSheet().getOwner().getEmail() } catch(oe) {}
      var autoRole = (userRow['Email'] && ownerEmail &&
        String(userRow['Email']).toLowerCase() === ownerEmail.toLowerCase()) ? 'admin' : 'Nhân viên'
      addRow(SHEETS.APP_ROLES, {
        'UserID': userRow['ID'],
        'Tên đăng nhập': userRow['Tên đăng nhập'],
        'AppID': APP_ID,
        'Quyền': autoRole,
        'Phân quyền chi tiết': '',
      })
      invalidateSheetCache(SHEETS.APP_ROLES)
      roles = getSheetData(SHEETS.APP_ROLES)
      appRole = roles.find(function(r) {
        return String(r['UserID']) === String(userRow['ID']) && r['AppID'] === APP_ID
      })
    }

    var tokens = _mintTokensForUser(userRow, appRole, deviceType)
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.session }
  })
}

function api_resume(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.APP_ROLES, refreshToken)
    if (!found) throw new Error('TOKEN_REVOKED')
    var roleRow = found.user

    // Cross-script epoch check: has the portal user logged out?
    var parentId = ssoGetParentSheetId()
    if (parentId) {
      try {
        if (isBeforeEpochCrossScript(parentId, '_Người Dùng', roleRow['UserID'], found.entry.createdAt, found.entry.label)) {
          revokeRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], refreshToken)
          throw new Error('TOKEN_REVOKED')
        }
      } catch(epochErr) {
        if (epochErr.message === 'TOKEN_REVOKED') throw epochErr
        Logger.log('Epoch check error: ' + epochErr.message)
      }
    }

    // Reload user info from parent sheet for fresh name/email
    var userInfo = null
    if (parentId) {
      try {
        var parentSs = SpreadsheetApp.openById(parentId)
        var parentSheetObj = parentSs.getSheetByName('_Người Dùng')
        if (parentSheetObj) {
          var parentData = parentSheetObj.getDataRange().getValues()
          var parentHeaders = parentData[0]
          for (var i = 1; i < parentData.length; i++) {
            if (String(parentData[i][parentHeaders.indexOf('ID')]) === String(roleRow['UserID'])) {
              userInfo = {}
              parentHeaders.forEach(function(h, c) { userInfo[h] = parentData[i][c] })
              break
            }
          }
        }
      } catch(e) { Logger.log('Parent lookup error: ' + e.message) }
    }
    if (!userInfo) throw new Error('TOKEN_REVOKED')
    if (userInfo['Trạng thái'] === 'Locked') {
      revokeRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], refreshToken)
      throw new Error('USER_LOCKED')
    }

    var sessionData = _buildSessionFromRows(userInfo, roleRow)

    var newRefreshToken = touchRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], refreshToken)
    var newAccessToken = mintAccessToken(sessionData)

    var resumeLabel = found.entry.label || 'desktop'
    var deviceAtKey = 'device_at_' + sessionData.userId + '_' + resumeLabel
    var staleAt = cacheGet(deviceAtKey)
    if (staleAt) revokeAccessToken(staleAt)
    cachePut(deviceAtKey, newAccessToken, ACCESS_TOKEN_TTL)

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: sessionData }
  })
}

function api_logout(refreshToken) {
  return _wrap(function() {
    var found = lookupRefreshToken(SHEETS.APP_ROLES, refreshToken)
    if (found) revokeRefreshToken(SHEETS.APP_ROLES, found.user['ID'], refreshToken)
    return { success: true }
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

// (Removed duplicate api_getAuditLogs — using _readLogPage-based version above)

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
