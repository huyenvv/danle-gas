// ===== Main entry point — SSO child app =====

function _buildSessionFromRows(userRow, roleRow) {
  var canCreate = roleRow['Được tạo hồ sơ'] === 'TRUE' || roleRow['Được tạo hồ sơ'] === true
  var canCreateSubCat = roleRow['Được tạo danh mục con'] === 'TRUE' || roleRow['Được tạo danh mục con'] === true
  var canPublish = roleRow['Được phát hành'] === 'TRUE' || roleRow['Được phát hành'] === true

  return {
    userId: userRow['ID'],
    username: userRow['Tên đăng nhập'],
    name: userRow['Tên nhân viên'] || userRow['Tên đăng nhập'] || '',
    email: userRow['Email'],
    role: roleRow['Quyền'],
    canCreate: !!canCreate,
    canCreateSubCat: !!canCreateSubCat,
    canPublish: !!canPublish,
  }
}

function _mintTokensForUser(userRow, appRole, deviceType) {
  var sessionData = _buildSessionFromRows(userRow, appRole)

  // Find the APP_ROLES row ID for refresh-token storage
  var roles = getSheetData(SHEETS.APP_ROLES)
  var roleRow = roles.find(function(r) {
    return String(r['UserID']) === String(userRow['ID']) && r['AppID'] === APP_ID
  })
  var label = (deviceType === 'mobile') ? 'mobile' : 'desktop'

  // Revoke old access token for same device type
  var deviceAtKey = 'device_at_' + userRow['ID'] + '_' + label
  var oldAt = cacheGet(deviceAtKey)
  if (oldAt) revokeAccessToken(oldAt)

  var refreshToken = mintRefreshToken(SHEETS.APP_ROLES, roleRow['ID'], { label: label })

  // Store RT metadata in session so epoch check works during polling
  sessionData._rtCreatedAt = new Date().getTime()
  sessionData._rtLabel = label

  var accessToken = mintAccessToken(sessionData)

  cachePut(deviceAtKey, accessToken, ACCESS_TOKEN_TTL)

  return { accessToken: accessToken, refreshToken: refreshToken, session: sessionData }
}

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
    .setTitle('Quản Lý Tài Liệu')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

function api_ssoLogin(parentSheetId, ssoToken, deviceType) {
  return _wrap(function() {
    if (!parentSheetId || !ssoToken) throw new Error('INVALID_SSO')
    // Trust only the pinned parent sheet — reject client-supplied IDs that don't match.
    // Prevents impersonation via a fake parent sheet the caller controls.
    var pinnedParent = ssoGetParentSheetId()
    if (pinnedParent && pinnedParent !== parentSheetId) throw new Error('INVALID_SSO')
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
    // Chức vụ from SSO _Phân Bổ — sync every login
    var ssoChucVu = 'Nhân viên'
    try {
      var parentSs = SpreadsheetApp.openById(parentSheetId)
      var deptRole = _getDeptRole(parentSs, ssoUser.userId)
      if (deptRole) ssoChucVu = deptRole
    } catch(_) {}

    if (!appRole) {
      var ownerEmail = ''
      try { ownerEmail = getCentralSheet().getOwner().getEmail() } catch(oe) {}
      var autoRole = (userRow['Email'] && ownerEmail &&
        String(userRow['Email']).toLowerCase() === ownerEmail.toLowerCase()) ? 'admin' : ssoChucVu
      addRow(SHEETS.APP_ROLES, {
        'UserID': userRow['ID'],
        'Tên đăng nhập': userRow['Tên đăng nhập'],
        'AppID': APP_ID,
        'Quyền': autoRole,
      })
      invalidateSheetCache(SHEETS.APP_ROLES)
      roles = getSheetData(SHEETS.APP_ROLES)
      appRole = roles.find(function(r) {
        return String(r['UserID']) === String(userRow['ID']) && r['AppID'] === APP_ID
      })
    } else if (appRole['Quyền'] !== 'admin' && appRole['Quyền'] !== ssoChucVu) {
      // Sync role from SSO (admin role is never overwritten)
      updateRow(SHEETS.APP_ROLES, appRole['ID'], { 'Quyền': ssoChucVu })
      appRole['Quyền'] = ssoChucVu
    }

    var tokens = _mintTokensForUser(userRow, appRole, deviceType)
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.session }
  })
}

// ===== Session API =====

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
        // Cross-script glitch — fail open
        Logger.log('Epoch check error: ' + epochErr.message)
      }
    }

    // Reload user info from parent sheet for fresh email/dept
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

    // Sync role from SSO _Phân Bổ on every resume (admin is never overwritten)
    if (roleRow['Quyền'] !== 'admin') {
      var ssoChucVu = 'Nhân viên'
      try {
        var deptRole = _getDeptRole(parentSs, roleRow['UserID'])
        if (deptRole) ssoChucVu = deptRole
      } catch(_) {}
      if (roleRow['Quyền'] !== ssoChucVu) {
        updateRow(SHEETS.APP_ROLES, roleRow['ID'], { 'Quyền': ssoChucVu })
        roleRow['Quyền'] = ssoChucVu
      }
    }

    var sessionData = _buildSessionFromRows(userInfo, roleRow)

    // Store RT metadata in session so epoch check works during polling
    sessionData._rtCreatedAt = found.entry.createdAt
    sessionData._rtLabel = found.entry.label || 'desktop'

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

    // 4. Unread IDs — intersect with visible docs (role-based category filter)
    var visibleDocIds = {}
    docs.forEach(function(d) { visibleDocIds[String(d.ID)] = true })
    var daDocRows = getSheetData(SHEETS.DA_DOC)
    var unreadIds = daDocRows
      .filter(function(r) { return String(r['UserID']) === String(session.userId) })
      .map(function(r) { return String(r['DocID']) })
      .filter(function(id) { return visibleDocIds[id] })

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

    // Cross-script epoch check: detect parent logout within ~60s
    var parentId = ssoGetParentSheetId()
    if (parentId && session._rtCreatedAt) {
      try {
        if (isBeforeEpochCrossScript(parentId, '_Người Dùng', session.userId, session._rtCreatedAt, session._rtLabel || 'desktop')) {
          throw new Error('TOKEN_REVOKED')
        }
      } catch(e) {
        if (e.message === 'TOKEN_REVOKED') throw e
        // Cross-script glitch — fail open
      }
    }

    // Always refresh docs
    var docsResult = getDocuments(token, {})

    // Unread IDs — intersect with visible docs (role-based category filter)
    var pollDocs = docsResult.data || []
    var pollVisibleIds = {}
    pollDocs.forEach(function(d) { pollVisibleIds[String(d.ID)] = true })
    var daDocRows = getSheetData(SHEETS.DA_DOC)
    var userUnreads = daDocRows.filter(function(r) { return String(r['UserID']) === String(session.userId) })
    var unreadIds = userUnreads
      .map(function(r) { return String(r['DocID']) })
      .filter(function(id) { return pollVisibleIds[id] })

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

function api_updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget, eagerFileInfos) {
  return _wrap(function() { return updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget, eagerFileInfos) })
}

function api_deleteDocument(token, id) {
  return _wrap(function() { return deleteDocument(token, id) })
}

function api_getDocumentStats(token) {
  return _wrap(function() { return getDocumentStats(token) })
}

function api_transitionDocument(token, id, action, data, updateData) {
  return _wrap(function() { return transitionDocument(token, id, action, data, updateData) })
}

function api_uploadFileEager(token, base64Data, mimeType, fileName, categoryId, draftId) {
  return _wrap(function() { return uploadFileEager(token, base64Data, mimeType, fileName, categoryId, draftId) })
}

function api_startResumableUpload(token, mimeType, fileName, fileSize, categoryId) {
  return _wrap(function() { return startResumableUpload(token, mimeType, fileName, fileSize, categoryId) })
}

function api_finalizeChunkedUpload(token, uploadUri, fileName, mimeType, fileSize, categoryId, draftId) {
  return _wrap(function() { return finalizeChunkedUpload(token, uploadUri, fileName, mimeType, fileSize, categoryId, draftId) })
}

function api_finalizeDraft(token, draftId, formData, notifyTarget) {
  return _wrap(function() { return finalizeDraft(token, draftId, formData, notifyTarget) })
}

function api_cancelDraft(token, draftId) {
  return _wrap(function() { return cancelDraft(token, draftId) })
}

function api_deleteFiles(token, fileIds) {
  return _wrap(function() { return deleteFiles(token, fileIds) })
}

function api_publishDocument(token, docId, toUserIds, ccUserIds) {
  return _wrap(function() { return publishDocument(token, docId, toUserIds, ccUserIds) })
}

// ===== Bulk import API =====

function api_parseImportFile(token, base64Data, fileName) {
  return _wrap(function() { return parseImportFile(token, base64Data, fileName) })
}

function api_bulkImportDocuments(token, payload) {
  return _wrap(function() { return bulkImportDocuments(token, payload) })
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
          'Được tạo hồ sơ': appRole && (appRole['Được tạo hồ sơ'] === true || appRole['Được tạo hồ sơ'] === 'TRUE') ? 'TRUE' : '',
          'Được tạo danh mục con': appRole && (appRole['Được tạo danh mục con'] === true || appRole['Được tạo danh mục con'] === 'TRUE') ? 'TRUE' : '',
          'Được phát hành': appRole && (appRole['Được phát hành'] === true || appRole['Được phát hành'] === 'TRUE') ? 'TRUE' : '',
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
    if (data['Được tạo hồ sơ'] !== undefined) roleUpdates['Được tạo hồ sơ'] = data['Được tạo hồ sơ'] ? 'TRUE' : ''
    if (data['Được tạo danh mục con'] !== undefined) roleUpdates['Được tạo danh mục con'] = data['Được tạo danh mục con'] ? 'TRUE' : ''
    if (data['Được phát hành'] !== undefined) roleUpdates['Được phát hành'] = data['Được phát hành'] ? 'TRUE' : ''
    if (existing) {
      updateRow(SHEETS.APP_ROLES, existing['ID'], roleUpdates)
    } else {
      addRow(SHEETS.APP_ROLES, {
        'UserID': id,
        'Tên đăng nhập': data['Tên đăng nhập'] || '',
        'AppID': APP_ID,
        'Quyền': data['Quyền'] || 'Xem',
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
