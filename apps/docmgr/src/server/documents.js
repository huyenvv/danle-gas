// ===== Documents module =====

// ── Vietnamese search helper ────────────────────────────────────────────────
function _viNormalize(str) {
  return String(str == null ? '' : str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
}

// ── Email notification helper ───────────────────────────────────────────────

function _getMailConfigFromSSO() {
  var parentId = ssoGetParentSheetId()
  if (!parentId) return null
  try {
    var ss = SpreadsheetApp.openById(parentId)
    var sheet = ss.getSheetByName('_Hệ Thống')
    if (!sheet) return null
    var data = sheet.getDataRange().getValues()
    var config = {}
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) config[data[i][0]] = data[i][1]
    }
    return config
  } catch(e) {
    Logger.log('_getMailConfigFromSSO error: ' + e.message)
    return null
  }
}

var _DEFAULT_MAIL_TEMPLATES = {
  trinhDuyet: {
    subject: '[Cần duyệt] {tênHồSơ}',
    body: 'Xin chào {vaiTròNgườiNhận}: {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã trình duyệt hồ sơ "{tênHồSơ}".\n\nVui lòng đăng nhập hệ thống để xem và phê duyệt tại đây:\n{linkHệThống}'
  },
  giaoViec: {
    subject: '[Giao việc] {tênHồSơ}',
    body: 'Xin chào {vaiTròNgườiNhận}: {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã giao việc hồ sơ "{tênHồSơ}" cho bạn.\n\nVui lòng đăng nhập hệ thống để xem chi tiết và xử lý tại đây:\n{linkHệThống}'
  },
  phatHanh: {
    subject: '[SBM – Phát hành] {tênHồSơ}',
    body: 'Kính gửi: {tênNgườiNhận}\n\n{tênNgườiGửi} đã phát hành văn bản "{tênHồSơ}" {linkTàiLiệu}\n\nVui lòng đăng nhập hệ thống để xem và phê duyệt tại đây:\n{linkHệThống}'
  }
}

function _getMailTemplates() {
  var raw = getConfig('MAIL_TEMPLATES')
  if (raw) {
    try { var parsed = JSON.parse(raw); return parsed } catch(e) {}
  }
  return _DEFAULT_MAIL_TEMPLATES
}

function _applyTemplate(tpl, vars) {
  var s = tpl || ''
  for (var key in vars) {
    s = s.split(key).join(vars[key] || '')
  }
  return s
}

// Add unread record for each user (DA_DOC stores unread, no record = read)
/**
 * Resolve usernames/mixed IDs to numeric UserIDs.
 * _parseAssignees may return usernames ("truongphong") or IDs ("5").
 * DA_DOC and api_getUnreadDocIds use session.userId (numeric), so we must store numeric IDs.
 */
function _resolveUserIds(usernamesOrIds) {
  if (!usernamesOrIds || usernamesOrIds.length === 0) return []
  var roles = getSheetData(SHEETS.APP_ROLES)
  var resolved = []
  usernamesOrIds.forEach(function(val) {
    // Try to find by username first
    var role = roles.find(function(r) {
      return r['AppID'] === APP_ID && (r['Tên đăng nhập'] === val || String(r['UserID']) === String(val))
    })
    if (role) {
      resolved.push(String(role['UserID']))
    } else {
      // Fallback: use as-is (might already be a userId)
      resolved.push(String(val))
    }
  })
  return resolved
}

function _markUnreadForUsers(usernamesOrIds, docId) {
  Logger.log('[_markUnreadForUsers] input=' + JSON.stringify(usernamesOrIds) + ' docId=' + docId)
  if (!usernamesOrIds || usernamesOrIds.length === 0) { Logger.log('[_markUnreadForUsers] EMPTY input, skipping'); return }
  var userIds = _resolveUserIds(usernamesOrIds)
  Logger.log('[_markUnreadForUsers] resolved userIds=' + JSON.stringify(userIds))
  var daDocRows = getSheetData(SHEETS.DA_DOC)
  userIds.forEach(function(uid) {
    var exists = daDocRows.find(function(r) {
      return String(r['UserID']) === String(uid) && String(r['DocID']) === String(docId)
    })
    Logger.log('[_markUnreadForUsers] uid=' + uid + ' exists=' + !!exists)
    if (!exists) {
      addRow(SHEETS.DA_DOC, { 'UserID': uid, 'DocID': docId, 'Thời gian': new Date().toISOString() })
    }
  })
  invalidateSheetCache(SHEETS.DA_DOC)
}

function _getAppLink() {
  var url = getConfig('APP_URL')
  if (url) return url
  try { return ScriptApp.getService().getUrl() } catch(e) {}
  return ''
}

function _buildFileLinks(doc) {
  if (!doc || !doc['File ID']) return ''
  var files = []
  try { files = JSON.parse(doc['File ID']) } catch(e) { return '' }
  if (!Array.isArray(files) || files.length === 0) return ''
  return files.map(function(f) {
    return 'https://drive.google.com/file/d/' + f.fileId + '/view'
  }).join('\n')
}

function _formatDateDMY(val) {
  if (!val) return ''
  var s = String(val)
  // yyyy-mm-dd — đổi trực tiếp, tránh timezone shift
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return m[3] + '/' + m[2] + '/' + m[1]
  try {
    var d = new Date(val)
    if (isNaN(d.getTime())) return s
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear()
  } catch(e) { return s }
}

// toRecipients — danh sách nhận chính (TO)
// ccRecipients — danh sách CC (optional)
function _sendNotificationEmails(toRecipients, doc, mailType, session, ccRecipients) {
  if (!toRecipients || toRecipients.length === 0) return
  ccRecipients = ccRecipients || []
  // Deduplicate by email — each address receives at most one email
  var _dedup = function(list) {
    var seen = {}
    return list.filter(function(r) {
      if (!r.email) return false
      var key = r.email.toLowerCase()
      if (seen[key]) return false
      seen[key] = true
      return true
    })
  }
  toRecipients = _dedup(toRecipients)
  var toEmails = {}
  toRecipients.forEach(function(r) { toEmails[r.email.toLowerCase()] = true })
  ccRecipients = _dedup(ccRecipients).filter(function(r) { return !toEmails[r.email.toLowerCase()] })
  var docName = (typeof doc === 'string') ? doc : (doc['Tên hồ sơ'] || '')
  // Dev override: redirect all emails to test address for huyenvv90 owner
  try {
    var ownerEmail = getCentralSheet().getOwner().getEmail()
    if (ownerEmail === 'huyenvv90@gmail.com') {
      var _redir = function(r) { return { email: 'huyenvv.it@gmail.com', name: r.name, role: r.role } }
      toRecipients = toRecipients.map(_redir)
      ccRecipients = ccRecipients.map(_redir)
    }
  } catch(e) {}
  try {
    var templates = _getMailTemplates()
    var tpl = templates[mailType] || _DEFAULT_MAIL_TEMPLATES[mailType] || { subject: 'Thông báo: ' + docName, body: 'Hồ sơ "' + docName + '" có cập nhật mới.' }
    var appLink = _getAppLink()

    var baseOptions = {}
    var config = _getMailConfigFromSSO()
    if (config) {
      if (config['MAIL_SENDER_NAME']) baseOptions.name = config['MAIL_SENDER_NAME']
      if (config['MAIL_SENDER_EMAIL']) baseOptions.from = config['MAIL_SENDER_EMAIL']
    }

    var toEmails = toRecipients.map(function(r) { return r.email }).join(',')
    var ccEmails = ccRecipients.filter(function(r) { return r.email }).map(function(r) { return r.email }).join(',')

    var fileLinks = (typeof doc === 'object') ? _buildFileLinks(doc) : ''
    var ngayBanHanh = _formatDateDMY(typeof doc === 'object' ? doc['Ngày ban hành'] : '')
    var ngayKetThuc = _formatDateDMY(typeof doc === 'object' ? doc['Ngày kết thúc'] : '')

    // Single recipient name for personalized templates, generic for bulk
    var recipientName = toRecipients.length === 1 ? (toRecipients[0].name || '') : 'Quý Anh/Chị'
    var recipientRole = toRecipients.length === 1 ? (toRecipients[0].role || '') : ''
    var vars = {
      '{tênHồSơ}': docName,
      '{tênNgườiGửi}': session ? (session.name || session.username || '') : 'Hệ thống',
      '{ngườiGửi}': session ? session.username : 'Hệ thống',
      '{emailNgườiGửi}': session ? (session.email || '') : '',
      '{tênNgườiNhận}': recipientName,
      '{vaiTròNgườiNhận}': recipientRole,
      '{linkHệThống}': appLink,
      '{linkTàiLiệu}': fileLinks,
      '{ngàyBanHành}': ngayBanHanh,
      '{ngàyKếtThúc}': ngayKetThuc,
      '{ghiChú}': (typeof doc === 'object') ? (doc['Ghi chú'] || '') : ''
    }
    var subject = _applyTemplate(tpl.subject, vars)
    var body = _applyTemplate(tpl.body, vars)
    var mailOptions = Object.assign({}, baseOptions)
    if (ccEmails) mailOptions.cc = ccEmails
    Logger.log('_sendNotificationEmails: sending to=' + toEmails + ' cc=' + (ccEmails || ''))
    GmailApp.sendEmail(toEmails, subject, body, mailOptions)
    Logger.log('_sendNotificationEmails: sent OK')
  } catch(e) {
    Logger.log('_sendNotificationEmails ERROR: ' + e.message + '\n' + e.stack)
    throw new Error('Gửi email thất bại: ' + e.message)
  }
}

function _getRecipientsByUsernames(usernames) {
  if (!usernames || usernames.length === 0) return []
  var parentId = ssoGetParentSheetId()
  if (!parentId) return []
  try {
    var ss = SpreadsheetApp.openById(parentId)
    var sheet = ss.getSheetByName('_Người Dùng')
    if (!sheet) return []
    var users = rowsToObjects(sheet.getDataRange().getValues())
    var roles = getSheetData(SHEETS.APP_ROLES)
    var result = []
    usernames.forEach(function(uname) {
      var user = users.find(function(u) {
        return u['Tên đăng nhập'] === uname || String(u['ID']) === String(uname)
      })
      if (user && user['Email']) {
        var appRole = roles.find(function(r) {
          return (r['Tên đăng nhập'] === uname || String(r['UserID']) === String(uname)) && r['AppID'] === APP_ID
        })
        result.push({ email: user['Email'], name: user['Tên nhân viên'] || user['Tên đăng nhập'] || uname, role: appRole ? appRole['Quyền'] : '' })
      }
    })
    return result
  } catch(e) {
    Logger.log('_getRecipientsByUsernames error: ' + e.message)
    return []
  }
}

function _getRecipientsByIds(userIds) {
  if (!userIds || userIds.length === 0) return []
  var parentId = ssoGetParentSheetId()
  if (!parentId) return []
  try {
    var ss = SpreadsheetApp.openById(parentId)
    var sheet = ss.getSheetByName('_Người Dùng')
    if (!sheet) return []
    var data = rowsToObjects(sheet.getDataRange().getValues())
    var result = []
    userIds.forEach(function(uid) {
      var user = data.find(function(u) { return String(u['ID']) === String(uid) })
      if (user && user['Email']) {
        result.push({
          userId: user['ID'],
          email: user['Email'],
          name: user['Tên nhân viên'] || user['Email'],
          role: user['Chức vụ'] || ''
        })
      }
    })
    return result
  } catch(e) {
    Logger.log('_getRecipientsByIds error: ' + e.message)
    return []
  }
}

function _getRecipientsByRole(targetRole) {
  var roles = getSheetData(SHEETS.APP_ROLES)
  var userIds = []
  roles.forEach(function(r) {
    if (r['Quyền'] === targetRole && r['AppID'] === APP_ID) {
      userIds.push(r['Tên đăng nhập'] || String(r['UserID']))
    }
  })
  return _getRecipientsByUsernames(userIds)
}

/**
 * Parse the File ID column: may be JSON array or plain string (legacy).
 * Returns array of { fileId, fileName, mimeType, size }.
 */
function _parseFileInfos(fileIdCol) {
  if (!fileIdCol) return []
  if (typeof fileIdCol === 'string' && fileIdCol.charAt(0) === '[') {
    try { return JSON.parse(fileIdCol) } catch (e) { /* fall through */ }
  }
  // Legacy single-file plain string
  if (typeof fileIdCol === 'string' && fileIdCol) {
    return [{ fileId: fileIdCol, fileName: '', mimeType: '', size: 0 }]
  }
  return []
}

function getDocuments(token, filters) {
  var session = requireAuth(token)
  filters = filters || {}

  Logger.log('[getDocuments] role=' + session.role + ' userId=' + session.userId)

  var docs = getSheetData(SHEETS.HO_SO).map(function(d) {
    // Normalize legacy status values on the fly
    var normalized = _normalizeStatus(d['Tình trạng'])
    return normalized !== d['Tình trạng'] ? Object.assign({}, d, { 'Tình trạng': normalized }) : d
  })

  // Category visibility filter (admin, Quản trị viên, Giám đốc, Văn thư see everything)
  var CAT_EXEMPT_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  Logger.log('[getDocuments] catExempt=' + (CAT_EXEMPT_ROLES.indexOf(session.role) !== -1) + ' totalDocs=' + docs.length)
  if (CAT_EXEMPT_ROLES.indexOf(session.role) === -1) {
    var categories = getSheetData(SHEETS.DANH_MUC)
    var groups = getSheetData(SHEETS.NHOM)
    var userIdStr = String(session.userId)
    // Find which groups this user belongs to
    var userGroupIds = []
    groups.forEach(function(g) {
      var members = _parseAssignees(g['Thành viên'])
      if (members.indexOf(userIdStr) !== -1 || members.indexOf(session.username) !== -1) {
        userGroupIds.push(String(g.ID))
      }
    })

    docs = docs.filter(function(d) {
      var catId = String(d['Danh mục'] || '')
      var cat = categories.find(function(c) { return String(c.ID) === catId })
      if (!cat) return true // uncategorized docs are visible
      var allowedUsers = _parseAssignees(cat['Người được xem'])
      var allowedGroups = _parseAssignees(cat['Nhóm được xem'])
      // Empty = everyone can see
      if (allowedUsers.length === 0 && allowedGroups.length === 0) return true
      // Check user in allowed users
      if (allowedUsers.indexOf(userIdStr) !== -1 || allowedUsers.indexOf(session.username) !== -1) return true
      // Check user's groups intersect with allowed groups
      for (var i = 0; i < userGroupIds.length; i++) {
        if (allowedGroups.indexOf(userGroupIds[i]) !== -1) return true
      }
      return false
    })
  }

  // Status filter
  if (filters.tinhTrang) {
    docs = docs.filter(function(d) { return d['Tình trạng'] === filters.tinhTrang })
  }

  // Category filter
  if (filters.danhMucId) {
    docs = docs.filter(function(d) { return String(d['Danh mục']) === String(filters.danhMucId) })
  }

  // Project filter
  if (filters.duAn) {
    docs = docs.filter(function(d) { return String(d['Dự án (Phòng ban)']) === String(filters.duAn) })
  }

  // Supplier filter
  if (filters.nhaCungCap) {
    docs = docs.filter(function(d) { return String(d['Nhà cung cấp (Nơi ban hành)']) === String(filters.nhaCungCap) })
  }

  // Person in charge filter
  if (filters.phuTrach) {
    docs = docs.filter(function(d) { return String(d['Phụ trách']) === String(filters.phuTrach) })
  }

  // Year filter
  if (filters.nam) {
    docs = docs.filter(function(d) {
      if (!d['Ngày ban hành']) return false
      return new Date(d['Ngày ban hành']).getFullYear() === Number(filters.nam)
    })
  }

  // Search keyword (Vietnamese diacritics-insensitive)
  if (filters.keyword) {
    var kw = _viNormalize(filters.keyword)
    docs = docs.filter(function(d) {
      return (
        _viNormalize(d['Tên hồ sơ']).indexOf(kw) !== -1 ||
        _viNormalize(d['Số hồ sơ']).indexOf(kw) !== -1 ||
        _viNormalize(d['Dự án (Phòng ban)']).indexOf(kw) !== -1 ||
        _viNormalize(d['Nhà cung cấp (Nơi ban hành)']).indexOf(kw) !== -1 ||
        _viNormalize(d['Ghi chú']).indexOf(kw) !== -1 ||
        _viNormalize(d['Phụ trách']).indexOf(kw) !== -1
      )
    })
  }

  // Sort newest first
  docs.sort(function(a, b) {
    var ta = a['Ngày cập nhật'] ? new Date(a['Ngày cập nhật']).getTime() : 0
    var tb = b['Ngày cập nhật'] ? new Date(b['Ngày cập nhật']).getTime() : 0
    return tb - ta
  })

  return { data: docs }
}

function createDocument(token, data, fileInfos, notifyTarget) {
  var session = requireAuth(token)

  // Re-check create permission from sheet (not cached session)
  var adminRoles = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (adminRoles.indexOf(session.role) === -1) {
    var roles = getSheetData(SHEETS.APP_ROLES)
    var appRole = roles.find(function(r) { return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID })
    var allowed = appRole && (appRole['Được tạo hồ sơ'] === 'TRUE' || appRole['Được tạo hồ sơ'] === true)
    if (!allowed) throw new Error('Bạn không có quyền tạo hồ sơ')
  }

  // Require at minimum: Tên hồ sơ and Danh mục
  if (!data['Tên hồ sơ']) throw new Error('Tên hồ sơ là bắt buộc')
  if (!data['Danh mục']) throw new Error('Danh mục là bắt buộc')

  // Normalize fileInfos: accept legacy single object or array
  if (fileInfos && !Array.isArray(fileInfos)) fileInfos = [fileInfos]
  fileInfos = fileInfos || []

  var uploadedFiles = []
  var catPath = _resolveCategoryPath(data['Danh mục'])

  fileInfos.forEach(function(fi) {
    if (fi && fi.base64Data) {
      var result = uploadFile(fi.base64Data, fi.mimeType, fi.fileName, catPath)
      uploadedFiles.push({ fileId: result.fileId, fileName: result.fileName, mimeType: fi.mimeType, size: fi.size || 0 })
    }
  })

  var fileIdCol = uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : ''
  var fileNameCol = uploadedFiles.map(function(f) { return f.fileName }).join(', ')

  var record = {
    'Tên hồ sơ': data['Tên hồ sơ'],
    'Danh mục': data['Danh mục'],
    'Số hồ sơ': data['Số hồ sơ'] || '',
    'Dự án (Phòng ban)': (data['Dự án (Phòng ban)'] || '').trim(),
    'Nhà cung cấp (Nơi ban hành)': (data['Nhà cung cấp (Nơi ban hành)'] || '').trim(),
    'Ngày ban hành': data['Ngày ban hành'] || '',
    'Ngày kết thúc': data['Ngày kết thúc'] || '',
    'Giá trị HĐ': data['Giá trị HĐ'] || 0,
    'Tình trạng': data['Tình trạng'] || 'Chờ duyệt',
    'File ID': fileIdCol,
    'Tên file': fileNameCol,
    'Loại file': uploadedFiles.length > 0 ? uploadedFiles[0].mimeType : '',
    'Kích thước': '',
    'Phụ trách': data['Phụ trách'] ? JSON.stringify([String(data['Phụ trách'])]) : '',
    'Người phối hợp': _buildAssignees(data['Người phối hợp'], null),
    'Ghi chú': data['Ghi chú'] || '',
    'Nơi lưu hồ sơ cứng': data['Nơi lưu hồ sơ cứng'] || '',
    'Ngày cập nhật': new Date().toISOString(),
    'Người tạo': session.username,
    'Người cập nhật': session.username,
  }

  var added = addRow(SHEETS.HO_SO, record)
  logAudit(session, 'Tạo', 'Hồ sơ', record['Tên hồ sơ'], JSON.stringify({ soHoSo: record['Số hồ sơ'], danhMuc: record['Danh mục'] }))

  // Send email notification if Trình duyệt (notify directors)
  if (notifyTarget === 'directors') {
    var roles = getSheetData(SHEETS.APP_ROLES)
    var dirUserIds = []
    roles.forEach(function(r) { if (r['Quyền'] === 'Giám đốc' && r['AppID'] === APP_ID) dirUserIds.push(r['Tên đăng nhập'] || String(r['UserID'])) })
    _markUnreadForUsers(dirUserIds, added['ID'])
    var dirRecipients = _getRecipientsByUsernames(dirUserIds)
    _sendNotificationEmails(dirRecipients, added, 'trinhDuyet', session)
  }

  // Publish mode: send to specified recipients
  if (notifyTarget === 'publish' && data._publishTo) {
    publishDocument(token, added['ID'], data._publishTo, data._publishCc || [])
  }

  return { data: added }
}

function updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget) {
  var session = requireAuth(token)

  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(id) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  if (session.role === 'Văn thư') {
    throw new Error('Văn thư không thể chỉnh sửa hồ sơ sau khi đã tạo')
  }

  // Permission: viewer/dept user can only edit docs they are assigned to
  if (session.role !== 'Quản trị viên' &&
      session.role !== 'admin' && session.role !== 'Giám đốc') {
    var existingAssignees = _parseAssignees(doc['Phụ trách'])
    var userId = String(session.userId)
    var uname  = session.username
    if (existingAssignees.indexOf(userId) === -1 && existingAssignees.indexOf(uname) === -1) {
      throw new Error('Bạn không có quyền chỉnh sửa hồ sơ này')
    }
  }

  var updates = {}

  var textFields = [
    'Tên hồ sơ', 'Danh mục', 'Số hồ sơ',
    'Dự án (Phòng ban)', 'Nhà cung cấp (Nơi ban hành)', 'Ngày ban hành', 'Ngày kết thúc',
    'Tình trạng', 'Ghi chú', 'Nơi lưu hồ sơ cứng'
  ]
  textFields.forEach(function(f) {
    if (data[f] !== undefined) updates[f] = typeof data[f] === 'string' ? data[f].trim() : data[f]
  })

  if (data['Giá trị HĐ'] !== undefined) updates['Giá trị HĐ'] = data['Giá trị HĐ']

  // Multi-file handling
  // Normalize inputs
  if (fileInfos && !Array.isArray(fileInfos)) fileInfos = [fileInfos]
  fileInfos = fileInfos || []
  keepFileIds = Array.isArray(keepFileIds) ? keepFileIds : []

  // Parse existing file infos
  var existingInfos = _parseFileInfos(doc['File ID'])

  // Delete files that are NOT in keepFileIds
  existingInfos.forEach(function(ef) {
    if (ef.fileId && keepFileIds.indexOf(ef.fileId) === -1) {
      deleteFile(ef.fileId)
    }
  })

  // Keep only the ones in keepFileIds
  var keptFiles = existingInfos.filter(function(ef) {
    return keepFileIds.indexOf(ef.fileId) !== -1
  })

  // Upload new files
  var catPath = _resolveCategoryPath(updates['Danh mục'] || doc['Danh mục'])
  var newlyUploaded = []
  fileInfos.forEach(function(fi) {
    if (fi && fi.base64Data) {
      var result = uploadFile(fi.base64Data, fi.mimeType, fi.fileName, catPath)
      newlyUploaded.push({ fileId: result.fileId, fileName: result.fileName, mimeType: fi.mimeType, size: fi.size || 0 })
    }
  })

  // Move kept files to new category folder if category changed
  var oldCatId = String(doc['Danh mục'] || '')
  var newCatId = String(updates['Danh mục'] !== undefined ? updates['Danh mục'] : doc['Danh mục'] || '')
  if (oldCatId !== newCatId && keptFiles.length > 0) {
    var newCatPath = _resolveCategoryPath(newCatId)
    keptFiles.forEach(function(f) {
      try { moveFile(f.fileId, newCatPath) } catch(e) { Logger.log('Move file error: ' + e.message) }
    })
  }

  var allFiles = keptFiles.concat(newlyUploaded)
  updates['File ID'] = allFiles.length > 0 ? JSON.stringify(allFiles) : ''
  updates['Tên file'] = allFiles.map(function(f) { return f.fileName }).join(', ')
  if (allFiles.length > 0) updates['Loại file'] = allFiles[0].mimeType

  // Update Phụ trách if provided (single person) — only admin/GĐ can change
  if (data['Phụ trách'] !== undefined) {
    var canChangePhuTrach = session.role === 'admin' || session.role === 'Quản trị viên' || session.role === 'Giám đốc'
    if (canChangePhuTrach) {
      updates['Phụ trách'] = data['Phụ trách'] ? JSON.stringify([String(data['Phụ trách'])]) : ''
    }
  }
  // Update Người phối hợp if provided (multiple people)
  if (data['Người phối hợp'] !== undefined) {
    updates['Người phối hợp'] = _buildAssignees(data['Người phối hợp'], null)
  }
  updates['Người cập nhật'] = session.username
  updates['Ngày cập nhật'] = new Date().toISOString()

  var updated = Object.assign({}, doc, updates)
  updateRow(SHEETS.HO_SO, id, updates)

  // Notification based on notifyTarget:
  //   'none'      — Văn thư "Lưu tài liệu" → no notification
  //   'directors' — Văn thư "Trình duyệt" → notify directors only
  //   default     — normal update → notify assignees
  notifyTarget = notifyTarget || 'all'

  if (notifyTarget === 'directors') {
    // Clear read status for directors so doc shows as unread
    // Add unread records for directors + send email
    var allRoles = getSheetData(SHEETS.APP_ROLES)
    var directorUserIds = []
    allRoles.forEach(function(r) {
      if (r['Quyền'] === 'Giám đốc' && r['AppID'] === APP_ID) directorUserIds.push(r['Tên đăng nhập'] || String(r['UserID']))
    })
    _markUnreadForUsers(directorUserIds, id)
    var directorRecipients = _getRecipientsByUsernames(directorUserIds)
    _sendNotificationEmails(directorRecipients, updated['Tên hồ sơ'], 'trinhDuyet', session)
  }

  logAudit(session, 'Sửa', 'Hồ sơ', doc['Tên hồ sơ'], JSON.stringify({ id: id }))
  return { data: updated }
}

function deleteDocument(token, id) {
  var session = requireAuth(token)
  var deleteRoles = ['admin', 'Quản trị viên']
  if (deleteRoles.indexOf(session.role) === -1) throw new Error('Chỉ quản trị viên mới có quyền xóa hồ sơ')

  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(id) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  // Delete all associated Drive files (JSON array or legacy plain string)
  var fileInfos = _parseFileInfos(doc['File ID'])
  fileInfos.forEach(function(fi) {
    if (fi.fileId) deleteFile(fi.fileId)
  })

  deleteRow(SHEETS.HO_SO, id)
  logAudit(session, 'Xóa', 'Hồ sơ', doc['Tên hồ sơ'], JSON.stringify({ id: id }))
  return { success: true }
}

function getDocumentStats(token) {
  requireAuth(token)

  var docs = getSheetData(SHEETS.HO_SO)

  var total = docs.length
  var byStatus = {}
  var totalValue = 0

  docs.forEach(function(d) {
    var s = d['Tình trạng'] || 'Không rõ'
    byStatus[s] = (byStatus[s] || 0) + 1
    totalValue += Number(d['Giá trị HĐ']) || 0
  })

  return {
    total: total,
    byStatus: byStatus,
    totalValue: totalValue,
  }
}

// ── private helpers ──────────────────────────────────────────────────────────

// Normalize legacy status values to the 4-status workflow
var VALID_STATUSES = ['Chờ duyệt', 'Chờ xử lý', 'Đang xử lý', 'Hoàn thành']
var STATUS_MIGRATION_MAP = {
  'Có hiệu lực':   'Hoàn thành',
  'Hết hiệu lực':  'Hoàn thành',
  'Đã ký':         'Hoàn thành',
  'Bị hủy':        'Hoàn thành',
  'Hủy':           'Hoàn thành',
  'Nháp':          'Chờ duyệt',
  'Chờ ký':        'Chờ duyệt',
  'Pending':       'Chờ duyệt',
}

function _normalizeStatus(status) {
  if (!status) return 'Chờ duyệt'
  if (VALID_STATUSES.indexOf(status) !== -1) return status
  return STATUS_MIGRATION_MAP[status] || 'Chờ duyệt'
}

function _resolveCategoryName(categoryId) {
  if (!categoryId) return 'Khác'
  var cats = getSheetData(SHEETS.DANH_MUC)
  var cat = cats.find(function(c) { return String(c['ID']) === String(categoryId) })
  return cat ? cat['Tên danh mục'] : 'Khác'
}

// Build full folder path from root ancestor down to the selected category
// e.g. category "Hợp đồng xây dựng" (cha = "Hợp đồng") → ['Hợp đồng', 'Hợp đồng xây dựng']
function _resolveCategoryPath(categoryId) {
  if (!categoryId) return ['Khác']
  var cats = getSheetData(SHEETS.DANH_MUC)
  var path = []
  var currentId = String(categoryId)
  var visited = {}
  while (currentId) {
    if (visited[currentId]) break // prevent infinite loop
    visited[currentId] = true
    var cat = null
    for (var i = 0; i < cats.length; i++) {
      if (String(cats[i]['ID']) === currentId) { cat = cats[i]; break }
    }
    if (!cat) break
    path.unshift(cat['Tên danh mục'])
    currentId = cat['Danh mục cha'] ? String(cat['Danh mục cha']) : ''
  }
  return path.length > 0 ? path : ['Khác']
}

// Parse Phụ trách field: JSON array string or legacy plain value → array of strings
function _parseAssignees(phuTrach) {
  if (!phuTrach) return []
  if (typeof phuTrach === 'string' && phuTrach.charAt(0) === '[') {
    try { return JSON.parse(phuTrach).map(String) } catch(e) {}
  }
  return [String(phuTrach)]
}

// Build JSON array string for assignees from input (array, string, or null)
function _buildAssignees(input, defaultUserId) {
  if (Array.isArray(input) && input.length > 0) {
    return JSON.stringify(input.map(String))
  }
  if (input && typeof input === 'string') {
    if (input.charAt(0) === '[') return input // already JSON
    return JSON.stringify([input])
  }
  if (defaultUserId) return JSON.stringify([String(defaultUserId)])
  return ''
}

// ── Workflow transitions ─────────────────────────────────────────────────────

/**
 * Allowed transitions per action:
 *   Văn thư:   trinhDuyet (→ Chờ duyệt), luuTaiLieu (→ Hoàn thành)
 *   Giám đốc:  giaoViec (Chờ duyệt → Chờ xử lý), thuHoi (Chờ xử lý → Chờ duyệt)
 *   Phụ trách: nhanViec (Chờ xử lý → Đang xử lý), hoanThanh (Đang xử lý → Hoàn thành)
 *   Admin:     all
 */
var WORKFLOW_ACTIONS = {
  trinhDuyet: { from: null, to: 'Chờ duyệt', roles: ['Văn thư'] },
  luuTaiLieu: { from: null, to: 'Hoàn thành', roles: ['Văn thư'] },
  giaoViec:   { from: 'Chờ duyệt', to: 'Chờ xử lý', roles: ['Giám đốc'] },
  thuHoi:     { from: 'Chờ xử lý', to: 'Chờ duyệt', roles: ['Giám đốc'] },
  nhanViec:   { from: 'Chờ xử lý', to: 'Đang xử lý', roles: ['_phuTrach'] },
  hoanThanh:  { from: 'Đang xử lý', to: 'Hoàn thành', roles: ['_phuTrach'] },
}

function transitionDocument(token, id, action, data) {
  var session = requireAuth(token)
  var rule = WORKFLOW_ACTIONS[action]
  if (!rule) throw new Error('Hành động không hợp lệ: ' + action)

  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(id) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  // Admin can do anything
  var isAdmin = session.role === 'admin' || session.role === 'Quản trị viên'
  if (!isAdmin) {
    // Check role
    var allowed = false
    for (var i = 0; i < rule.roles.length; i++) {
      if (rule.roles[i] === '_phuTrach') {
        var assignees = _parseAssignees(doc['Phụ trách'])
        if (assignees.indexOf(String(session.userId)) !== -1 || assignees.indexOf(session.username) !== -1) {
          allowed = true
        }
      } else if (session.role === rule.roles[i]) {
        allowed = true
      }
    }
    if (!allowed) throw new Error('Bạn không có quyền thực hiện hành động này')

    // Check current status (null = any status allowed for create actions)
    if (rule.from && doc['Tình trạng'] !== rule.from) {
      throw new Error('Hồ sơ đang ở trạng thái "' + doc['Tình trạng'] + '", không thể ' + action)
    }
  }

  var updates = {
    'Tình trạng': rule.to,
    'Người cập nhật': session.username,
    'Ngày cập nhật': new Date().toISOString(),
  }

  // Giao việc: require Phụ trách
  if (action === 'giaoViec') {
    data = data || {}
    if (!data['Phụ trách']) throw new Error('Phải chọn người phụ trách')
    updates['Phụ trách'] = JSON.stringify([String(data['Phụ trách'])])
    if (data['Người phối hợp'] !== undefined) {
      updates['Người phối hợp'] = _buildAssignees(data['Người phối hợp'], null)
    }
  }

  // Phụ trách can add collaborators when nhanViec
  if (action === 'nhanViec' && data && data['Người phối hợp'] !== undefined) {
    updates['Người phối hợp'] = _buildAssignees(data['Người phối hợp'], null)
  }

  updateRow(SHEETS.HO_SO, id, updates)
  var updated = Object.assign({}, doc, updates)

  // giaoViec: TO = Phụ trách, CC = Người phối hợp
  if (action === 'giaoViec') {
    var phuTrachUsers = _parseAssignees(updates['Phụ trách'])
    var phoiHopUsers  = _parseAssignees(updates['Người phối hợp'] || doc['Người phối hợp'])
    var _excludeSelf = function(uid) { return String(uid) !== String(session.userId) && uid !== session.username }
    phuTrachUsers = phuTrachUsers.filter(_excludeSelf)
    phoiHopUsers  = phoiHopUsers.filter(_excludeSelf)
    _markUnreadForUsers(phuTrachUsers.concat(phoiHopUsers), id)
    var toList = _getRecipientsByUsernames(phuTrachUsers)
    var ccList = _getRecipientsByUsernames(phoiHopUsers)
    _sendNotificationEmails(toList, updated, 'giaoViec', session, ccList)
  } else if (action === 'nhanViec' && updates['Người phối hợp']) {
    // nhanViec: chỉ đánh dấu unread cho người phối hợp mới, không gửi email
    var oldPhoiHop = _parseAssignees(doc['Người phối hợp'])
    var newPhoiHop = _parseAssignees(updates['Người phối hợp'])
    var addedUsers = newPhoiHop.filter(function(u) { return oldPhoiHop.indexOf(u) === -1 })
    if (addedUsers.length > 0) {
      _markUnreadForUsers(addedUsers, id)
    }
  }

  logAudit(session, action, 'Hồ sơ', doc['Tên hồ sơ'], JSON.stringify({ id: id, from: doc['Tình trạng'], to: rule.to }))
  return { data: updated }
}

// ── Publish (phát hành) ─────────────────────────────────────────────────────

function publishDocument(token, docId, toUserIds, ccUserIds) {
  var session = requireAuth(token)

  // Check publish permission
  var roles = getSheetData(SHEETS.APP_ROLES)
  var appRole = roles.find(function(r) { return r['AppID'] === APP_ID && String(r['UserID']) === String(session.userId) })
  var role = appRole ? appRole['Quyền'] : ''
  var isAdminOrVanThu = (role === 'admin' || role === 'Quản trị viên' || role === 'Giám đốc' || role === 'Văn thư')
  if (!isAdminOrVanThu && !(appRole && (appRole['Được phát hành'] === 'TRUE' || appRole['Được phát hành'] === true))) {
    throw new Error('Bạn không có quyền phát hành')
  }

  // Load document
  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(docId) })
  if (!doc) throw new Error('Không tìm thấy hồ sơ')

  // Build recipient lists from user IDs (lookup from SSO _Người Dùng)
  var toRecipients = _getRecipientsByIds(toUserIds)
  var ccRecipients = ccUserIds ? _getRecipientsByIds(ccUserIds) : []

  if (toRecipients.length === 0) throw new Error('Vui lòng chọn ít nhất một người nhận')

  // Send email
  _sendNotificationEmails(toRecipients, doc, 'phatHanh', session, ccRecipients)

  // Mark unread for all recipients (bell notification)
  var allUserIds = toUserIds.concat(ccUserIds || [])
  _markUnreadForUsers(allUserIds, docId)

  // Append to publish history
  var history = []
  if (doc['Lịch sử phát hành']) {
    try { history = JSON.parse(doc['Lịch sử phát hành']) } catch(e) {}
  }
  history.push({
    lan: history.length + 1,
    ngay: new Date().toISOString(),
    nguoiGui: session.name || session.username,
    to: toRecipients.map(function(r) { return { id: r.userId, name: r.name, email: r.email } }),
    cc: ccRecipients.map(function(r) { return { id: r.userId, name: r.name, email: r.email } })
  })
  updateRow(SHEETS.HO_SO, docId, { 'Lịch sử phát hành': JSON.stringify(history) })

  return { success: true, lan: history.length }
}

// ── Comment functions ────────────────────────────────────────────────────────

function getComments(token, docId) {
  requireAuth(token)
  var comments = getSheetData(SHEETS.COMMENTS)
  return {
    data: comments.filter(function(c) { return String(c['DocID']) === String(docId) })
  }
}

function addComment(token, docId, content) {
  var session = requireAuth(token)
  if (!content || !String(content).trim()) throw new Error('Nội dung không được để trống')

  var COMMENT_ROLES = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (COMMENT_ROLES.indexOf(session.role) === -1) {
    var allDocs = getSheetData(SHEETS.HO_SO)
    var targetDoc = allDocs.find(function(d) { return String(d['ID']) === String(docId) })
    if (!targetDoc) throw new Error('Không tìm thấy hồ sơ')
    var docAssignees = _parseAssignees(targetDoc['Phụ trách'])
    var docCollaborators = _parseAssignees(targetDoc['Người phối hợp'])
    var uid = String(session.userId)
    if (docAssignees.indexOf(uid) === -1 && docAssignees.indexOf(session.username) === -1 &&
        docCollaborators.indexOf(uid) === -1 && docCollaborators.indexOf(session.username) === -1) {
      throw new Error('Bạn không có quyền bình luận')
    }
  }

  var record = {
    'DocID': docId,
    'UserID': session.userId,
    'Tên người dùng': session.username,
    'Nội dung': String(content).trim(),
    'Thời gian': new Date().toISOString(),
  }
  var added = addRow(SHEETS.COMMENTS, record)

  // Clear DA_DOC for all assignees except commenter (doc becomes unread for others)
  var docs = getSheetData(SHEETS.HO_SO)
  var doc = docs.find(function(d) { return String(d['ID']) === String(docId) })
  if (doc) {
    var assignees = _parseAssignees(doc['Phụ trách'])
    var daDocRows = getSheetData(SHEETS.DA_DOC)
    assignees.forEach(function(uid) {
      if (String(uid) !== String(session.userId) && uid !== session.username) {
        var entries = daDocRows.filter(function(r) {
          return (String(r['UserID']) === String(uid) || r['UserID'] === uid) && String(r['DocID']) === String(docId)
        })
        entries.forEach(function(r) { _coreDeleteRow(SHEETS.DA_DOC, r['ID']) })
      }
    })
  }

  logAudit(session, 'Bình luận', 'Hồ sơ', String(docId), String(content).trim().substring(0, 100))
  return { data: added }
}
