// ===== Main entry point — SSO child app =====

function doGet(e) {
  try {
    // Warm-up ping từ SSO Portal — chỉ cần khởi động execution container,
    // không tạo session, không trả full bundle. Lần click thật sau đó tránh cold start.
    if (e && e.parameter && e.parameter.prefetch === '1') {
      return HtmlService.createHtmlOutput('<!doctype html><title>warm</title>')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    }

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

    // Serve HTML with injected SSO data — eliminates 2 client→server round trips
    var content = HtmlService.createHtmlOutputFromFile('index').getContent()
    if (injectedToken) {
      var session = validateAccessToken(injectedToken)
      var injectParts = ['window.__SSO_TOKEN__="' + injectedToken + '";']

      // Inject session data → client skips api_validateSession round trip
      if (session) {
        injectParts.push('window.__SSO_SESSION__=' + JSON.stringify(session) + ';')

        // Inject initial data → client skips api_getInitialData round trip
        try {
          var lookups = getAllData(session)
          var docsResult = getDocuments(injectedToken, {})
          var docs = docsResult.data || []
          var byStatus = {}
          var totalValue = 0
          docs.forEach(function(d) {
            var s = d['Tình trạng'] || 'Không rõ'
            byStatus[s] = (byStatus[s] || 0) + 1
            totalValue += Number(d['Giá trị HĐ']) || 0
          })
          var daDocRows = getSheetData(SHEETS.DA_DOC)
          var unreadIds = daDocRows
            .filter(function(r) { return String(r['UserID']) === String(session.userId) })
            .map(function(r) { return String(r['DocID']) })
          var companyName = getConfig('COMPANY_NAME') || ''

          var initialData = {
            lookups: lookups,
            docs: docs,
            stats: { total: docs.length, byStatus: byStatus, totalValue: totalValue },
            unreadIds: unreadIds,
            companyName: companyName,
          }

          // Inject settings configs for admin — skips 5x api_getConfig on SettingsPage
          var isAdmin = session.role === 'admin' || session.role === 'Quản trị viên' || session.role === 'Giám đốc'
          if (isAdmin) {
            initialData.configs = {
              ROOT_FOLDER_ID:   getConfig('ROOT_FOLDER_ID') || null,
              ROOT_FOLDER_NAME: getConfig('ROOT_FOLDER_NAME') || null,
              COMPANY_NAME:     companyName || null,
              MAIL_TEMPLATES:   getConfig('MAIL_TEMPLATES') || null,
              APP_URL:          getConfig('APP_URL') || null,
            }
          }

          injectParts.push('window.__INITIAL_DATA__=' + JSON.stringify(initialData) + ';')
        } catch(dataErr) {
          Logger.log('doGet inject initial data error: ' + dataErr.message)
          // Client will fall back to api_getInitialData
        }
      }

      content = content.replace('</head>', '<script>' + injectParts.join('') + '</script></head>')
    }
    return HtmlService.createHtmlOutput(content)
      .setTitle('Quản Lý Tài Liệu')
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
  return _wrap(function() { return revokeAccessToken(token) })
}

function api_validateSession(token) {
  return _wrap(function() {
    var session = validateAccessToken(token)
    if (!session) return null

    // Re-read APP_ROLES to pick up any role changes made by admin since login
    var roles = getSheetData(SHEETS.APP_ROLES)
    var appRole = roles.find(function(r) {
      return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID
    })

    if (appRole) {
      // Re-sync role, permissions, and flags from sheet on every validate
      var perms = getPermissions(appRole)
      var canCreate = (perms && perms.hoSo && perms.hoSo.c) || appRole['Được tạo hồ sơ'] === 'TRUE' || appRole['Được tạo hồ sơ'] === true
      var canCreateSubCat = (perms && perms.danhMuc && perms.danhMuc.c) || appRole['Được tạo danh mục con'] === 'TRUE' || appRole['Được tạo danh mục con'] === true
      session.role = appRole['Quyền']
      session.permissions = perms
      session.canCreate = !!canCreate
      session.canCreateSubCat = !!canCreateSubCat
      cachePut('at_' + token, session, SESSION_TTL)
    }

    return session
  })
}

// ===== Lookup data API =====

function api_getAllData(token) {
  return _wrap(function() {
    var session = requireAuth(token)
    return getAllData(session)
  })
}

/**
 * Single call for initial page load — replaces 5 parallel calls:
 * getAllData + getDocuments + getDocumentStats + getUnreadDocIds + getConfig(COMPANY_NAME)
 */
function api_getInitialData(token) {
  return _wrap(function() {
    var session = requireAuth(token)

    // 1. Lookups (getAllData)
    var lookups = getAllData(session)

    // 2. Documents (getDocuments reuses cached sheet data from getAllData)
    var docsResult = getDocuments(token, {})

    // 3. Stats — compute inline from docs to avoid re-reading sheet
    var docs = docsResult.data || []
    var byStatus = {}
    var totalValue = 0
    docs.forEach(function(d) {
      var s = d['Tình trạng'] || 'Không rõ'
      byStatus[s] = (byStatus[s] || 0) + 1
      totalValue += Number(d['Giá trị HĐ']) || 0
    })
    var stats = { total: docs.length, byStatus: byStatus, totalValue: totalValue }

    // 4. Unread IDs
    var daDocRows = getSheetData(SHEETS.DA_DOC)
    var unreadIds = daDocRows
      .filter(function(r) { return String(r['UserID']) === String(session.userId) })
      .map(function(r) { return String(r['DocID']) })

    // 5. Company name
    var companyName = getConfig('COMPANY_NAME') || ''

    var result = {
      lookups: lookups,
      docs: docs,
      stats: stats,
      unreadIds: unreadIds,
      companyName: companyName,
    }

    // 6. Settings configs for admin — skips 5x api_getConfig on SettingsPage
    var isAdminRole = session.role === 'admin' || session.role === 'Quản trị viên' || session.role === 'Giám đốc'
    if (isAdminRole) {
      result.configs = {
        ROOT_FOLDER_ID:   getConfig('ROOT_FOLDER_ID') || null,
        ROOT_FOLDER_NAME: getConfig('ROOT_FOLDER_NAME') || null,
        COMPANY_NAME:     companyName || null,
        MAIL_TEMPLATES:   getConfig('MAIL_TEMPLATES') || null,
        APP_URL:          getConfig('APP_URL') || null,
      }
    }

    return result
  })
}

/**
 * Single call for background polling — replaces 3 parallel calls:
 * getDocuments + getUnreadCount + getAllData(if stale)
 */
function api_pollUpdates(token, opts) {
  return _wrap(function() {
    var session = requireAuth(token)
    opts = opts || {}

    // Always refresh docs
    var docsResult = getDocuments(token, {})

    // Unread IDs
    var daDocRows = getSheetData(SHEETS.DA_DOC)
    var userUnreads = daDocRows.filter(function(r) { return String(r['UserID']) === String(session.userId) })
    var unreadIds = userUnreads.map(function(r) { return String(r['DocID']) })

    var result = {
      docs: docsResult.data || [],
      unreadIds: unreadIds,
    }

    // Optionally refresh lookups
    if (opts.includeLookups) {
      result.lookups = getAllData(session)
    }

    return result
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

function api_createDocument(token, data, fileInfos, notifyTarget) {
  return _wrap(function() { return createDocument(token, data, fileInfos, notifyTarget) })
}

function api_updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget) {
  return _wrap(function() { return updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget) })
}

function api_deleteDocument(token, id) {
  return _wrap(function() { return deleteDocument(token, id) })
}

function api_getDocumentStats(token) {
  return _wrap(function() { return getDocumentStats(token) })
}

function api_transitionDocument(token, id, action, data) {
  return _wrap(function() { return transitionDocument(token, id, action, data) })
}

// ===== Category API =====

function api_addCategory(token, data) {
  return _wrap(function() {
    var session = requireAuth(token)
    var adminRoles = ['admin', 'Quản trị viên', 'Giám đốc']
    var isAdmin = adminRoles.indexOf(session.role) !== -1
    if (!isAdmin) {
      // Re-check permission from sheet (not cached session)
      var roles = getSheetData(SHEETS.APP_ROLES)
      var appRole = roles.find(function(r) { return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID })
      var allowed = appRole && (appRole['Được tạo danh mục con'] === 'TRUE' || appRole['Được tạo danh mục con'] === true)
      if (!allowed || !data['Danh mục cha']) {
        throw new Error('Bạn không có quyền tạo danh mục')
      }
    }
    return addRow(SHEETS.DANH_MUC, data)
  })
}

function api_updateCategory(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    // Rename Drive folder if category name changed
    if (data['Tên danh mục']) {
      var cats = getSheetData(SHEETS.DANH_MUC)
      var oldCat = cats.find(function(c) { return String(c['ID']) === String(id) })
      if (oldCat && data['Tên danh mục'] !== oldCat['Tên danh mục']) {
        try {
          var oldPath = _resolveCategoryPath(id)
          renameFolder(oldPath, data['Tên danh mục'])
        } catch(e) { Logger.log('Rename folder error: ' + e.message) }
      }
    }
    return updateRow(SHEETS.DANH_MUC, id, data)
  })
}

function api_deleteCategory(token, id) {
  return _wrap(function() {
    requireAdmin(token)
    return deleteRow(SHEETS.DANH_MUC, id)
  })
}

// ===== Group (Nhóm) API =====

function api_addNhom(token, data) {
  return _wrap(function() {
    requireAdmin(token)
    return addRow(SHEETS.NHOM, data)
  })
}

function api_updateNhom(token, id, data) {
  return _wrap(function() {
    requireAdmin(token)
    return updateRow(SHEETS.NHOM, id, data)
  })
}

function api_deleteNhom(token, id) {
  return _wrap(function() {
    requireAdmin(token)
    return deleteRow(SHEETS.NHOM, id)
  })
}

// ===== Supplier API =====

function _requireAdminOrVanThu(token) {
  var session = requireAuth(token)
  var allowed = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (allowed.indexOf(session.role) === -1) throw new Error('Không có quyền thực hiện thao tác này')
  return session
}

function api_addNhaCungCap(token, data) {
  return _wrap(function() {
    _requireAdminOrVanThu(token)
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
    _requireAdminOrVanThu(token)
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

// ===== User Management API (authorization-only) =====
// Users are managed by SSO Portal. This app only manages local roles (_Phân Quyền).

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
        // Hide owner from permission management UI
        return !(ownerEmail && u['Email'] && u['Email'].toLowerCase() === ownerEmail)
      })
      .map(function(u) {
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
          'Được tạo hồ sơ': appRole && (appRole['Được tạo hồ sơ'] === true || appRole['Được tạo hồ sơ'] === 'TRUE') ? 'TRUE' : '',
          'Được tạo danh mục con': appRole && (appRole['Được tạo danh mục con'] === true || appRole['Được tạo danh mục con'] === 'TRUE') ? 'TRUE' : '',
          'Phòng ban': u['Phòng ban'] || '',
        }
      })
  })
}

function api_updateUser(token, id, data) {
  return _wrap(function() {
    var session = requireAdmin(token)
    // Giám đốc cannot change own role, privileged roles, or assign privileged roles
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
    // Block changes to owner's role in this app
    var ownerEmail = ''
    try { ownerEmail = getCentralSheet().getOwner().getEmail().toLowerCase() } catch(e) {}
    if (ownerEmail) {
      var parentId = ssoGetParentSheetId()
      if (parentId) {
        try {
          var parentSs = SpreadsheetApp.openById(parentId)
          var parentSheet = parentSs.getSheetByName('_Người Dùng')
          if (parentSheet) {
            var parentUsers = rowsToObjects(parentSheet.getDataRange().getValues())
            var target = parentUsers.find(function(u) { return String(u['ID']) === String(id) })
            if (target && target['Email'] && target['Email'].toLowerCase() === ownerEmail) {
              throw new Error('Không thể thay đổi quyền của chủ sở hữu')
            }
          }
        } catch(e) { if (e.message.indexOf('chủ sở hữu') !== -1) throw e }
      }
    }
    var roles = getSheetData(SHEETS.APP_ROLES)
    var existing = roles.find(function(r) {
      return String(r['UserID']) === String(id) && r['AppID'] === APP_ID
    })
    var roleUpdates = {}
    if (data['Quyền'] !== undefined) roleUpdates['Quyền'] = data['Quyền']
    if (data['permissions'] !== undefined) roleUpdates['Phân quyền chi tiết'] = JSON.stringify(data['permissions'])
    if (data['Được tạo hồ sơ'] !== undefined) roleUpdates['Được tạo hồ sơ'] = data['Được tạo hồ sơ'] ? 'TRUE' : ''
    if (data['Được tạo danh mục con'] !== undefined) roleUpdates['Được tạo danh mục con'] = data['Được tạo danh mục con'] ? 'TRUE' : ''
    if (existing) {
      updateRow(SHEETS.APP_ROLES, existing['ID'], roleUpdates)
    } else {
      addRow(SHEETS.APP_ROLES, {
        'UserID': id,
        'Tên đăng nhập': data['Tên đăng nhập'] || '',
        'AppID': APP_ID,
        'Quyền': data['Quyền'] || 'Xem',
        'Phân quyền chi tiết': data['permissions'] ? JSON.stringify(data['permissions']) : '',
        'Được tạo hồ sơ': data['Được tạo hồ sơ'] ? 'TRUE' : '',
        'Được tạo danh mục con': data['Được tạo danh mục con'] ? 'TRUE' : '',
      })
    }
    logAudit(null, 'Phân quyền', 'Người dùng', String(id), JSON.stringify(data))
    return { success: true }
  })
}

function api_removeUserRole(token, id) {
  return _wrap(function() {
    var session = requireAdmin(token)
    // Giám đốc cannot remove own role or peer Giám đốc
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

// ===== Settings API =====

function api_getConfig(token, key) {
  return _wrap(function() {
    requireAdmin(token)
    return { value: getConfig(key) }
  })
}

// Lấy nhiều config key trong 1 lần gọi
function api_getConfigs(token, keys) {
  return _wrap(function() {
    requireAdmin(token)
    var result = {}
    ;(keys || []).forEach(function(k) { result[k] = getConfig(k) || null })
    return result
  })
}

function api_setConfig(token, key, value) {
  return _wrap(function() {
    requireAdmin(token)
    setConfig(key, value)
    return { success: true }
  })
}

function api_clearCache(token) {
  return _wrap(function() {
    requireAdmin(token)
    Object.values(SHEETS).forEach(function(name) { invalidateSheetCache(name) })
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
    var limit = Math.max(1, Number(filters.limit || 20))
    var offset = Math.max(0, Number(filters.offset || 0))
    var keyword = String(filters.keyword || '').toLowerCase()
    var logs = getSheetData(SHEETS.NHAT_KY)
    logs = logs.slice().reverse() // newest first
    var types = []
    logs.forEach(function(l) {
      var type = l['Loại'] || ''
      if (type && types.indexOf(type) === -1) types.push(type)
    })
    if (filters.type) {
      logs = logs.filter(function(l) { return l['Loại'] === filters.type })
    }
    if (filters.user) {
      var q = filters.user.toLowerCase()
      logs = logs.filter(function(l) { return (l['Người dùng'] || '').toLowerCase().indexOf(q) !== -1 })
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

// DA_DOC stores UNREAD records: has record = unread, no record = read
function api_markAsRead(token, docId) {
  return _wrap(function() {
    var session = requireAuth(token)
    var reads = getSheetData(SHEETS.DA_DOC)
    var entry = reads.find(function(r) {
      return String(r['UserID']) === String(session.userId) && String(r['DocID']) === String(docId)
    })
    if (entry) {
      _coreDeleteRow(SHEETS.DA_DOC, entry['ID'])
      invalidateSheetCache(SHEETS.DA_DOC)
    }
    return { success: true }
  })
}

function api_getUnreadCount(token) {
  return _wrap(function() {
    var session = requireAuth(token)
    var reads = getSheetData(SHEETS.DA_DOC)
    var count = reads.filter(function(r) { return String(r['UserID']) === String(session.userId) }).length
    return { count: count }
  })
}

function api_getUnreadDocIds(token) {
  return _wrap(function() {
    var session = requireAuth(token)
    var reads = getSheetData(SHEETS.DA_DOC)
    var userReads = reads.filter(function(r) { return String(r['UserID']) === String(session.userId) })
    var unreadIds = userReads.map(function(r) { return String(r['DocID']) })
    return { unreadIds: unreadIds }
  })
}

function api_markMultipleAsRead(token, docIds) {
  return _wrap(function() {
    var session = requireAuth(token)
    if (!Array.isArray(docIds) || docIds.length === 0) return { success: true, marked: 0 }
    var reads = getSheetData(SHEETS.DA_DOC)
    var toDelete = reads.filter(function(r) {
      return String(r['UserID']) === String(session.userId) && docIds.indexOf(String(r['DocID'])) !== -1
    })
    toDelete.forEach(function(r) { _coreDeleteRow(SHEETS.DA_DOC, r['ID']) })
    if (toDelete.length > 0) invalidateSheetCache(SHEETS.DA_DOC)
    return { success: true, marked: toDelete.length }
  })
}

// ===== Comments API =====

function api_getComments(token, docId) {
  return _wrap(function() { return getComments(token, docId) })
}

function api_addComment(token, docId, content) {
  return _wrap(function() { return addComment(token, docId, content) })
}

// ===== Error wrapper (license check disabled for SSO) =====

function _wrap(fn) {
  try {
    // License check disabled — SSO Portal manages access
    var result = fn()
    return { success: true, payload: result }
  } catch(e) {
    var msg = (e && e.message) ? e.message : String(e)
    return { success: false, error: msg || 'Lỗi không xác định' }
  }
}
