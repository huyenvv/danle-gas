// ===== Documents module =====

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

  // Search keyword
  if (filters.keyword) {
    var kw = filters.keyword.toLowerCase()
    docs = docs.filter(function(d) {
      return (
        (d['Tên hồ sơ'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Số hồ sơ'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Dự án (Phòng ban)'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Nhà cung cấp (Nơi ban hành)'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Mô tả'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Ghi chú'] || '').toLowerCase().indexOf(kw) !== -1 ||
        String(d['Phụ trách'] || '').toLowerCase().indexOf(kw) !== -1
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

function createDocument(token, data, fileInfos) {
  var session = requireAuth(token)

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
    'Mô tả': '',
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
  return { data: added }
}

function updateDocument(token, id, data, fileInfos, keepFileIds) {
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
  updates['Mô tả'] = '' // deprecated — migrated into Ghi chú
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

  // Update Phụ trách if provided (single person)
  if (data['Phụ trách'] !== undefined) {
    updates['Phụ trách'] = data['Phụ trách'] ? JSON.stringify([String(data['Phụ trách'])]) : ''
  }
  // Update Người phối hợp if provided (multiple people)
  if (data['Người phối hợp'] !== undefined) {
    updates['Người phối hợp'] = _buildAssignees(data['Người phối hợp'], null)
  }
  updates['Người cập nhật'] = session.username
  updates['Ngày cập nhật'] = new Date().toISOString()

  var updated = updateRow(SHEETS.HO_SO, id, updates)

  // Clear DA_DOC for all assignees except the saver (doc becomes unread for others)
  var finalAssignees = _parseAssignees(updated['Phụ trách'] || doc['Phụ trách'])
  var daDocRows = getSheetData(SHEETS.DA_DOC)
  finalAssignees.forEach(function(uid) {
    if (String(uid) !== String(session.userId) && uid !== session.username) {
      var entries = daDocRows.filter(function(r) {
        return (String(r['UserID']) === String(uid) || r['UserID'] === uid) && String(r['DocID']) === String(id)
      })
      entries.forEach(function(r) { _coreDeleteRow(SHEETS.DA_DOC, r['ID']) })
    }
  })

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

  // When Phụ trách changes (giaoViec), mark doc as unread for the new assignee
  if (updates['Phụ trách']) {
    var newAssignees = _parseAssignees(updates['Phụ trách'])
    var daDocRows = getSheetData(SHEETS.DA_DOC)
    newAssignees.forEach(function(uid) {
      if (String(uid) !== String(session.userId) && uid !== session.username) {
        var entries = daDocRows.filter(function(r) {
          return (String(r['UserID']) === String(uid) || r['UserID'] === uid) && String(r['DocID']) === String(id)
        })
        entries.forEach(function(r) { _coreDeleteRow(SHEETS.DA_DOC, r['ID']) })
      }
    })
    invalidateSheetCache(SHEETS.DA_DOC)
  }

  logAudit(session, action, 'Hồ sơ', doc['Tên hồ sơ'], JSON.stringify({ id: id, from: doc['Tình trạng'], to: rule.to }))
  return { data: updated }
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
