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

  var docs = getSheetData(SHEETS.HO_SO)

  // Permission filter based on role
  var GLOBAL_ROLES = ['admin', 'Quản trị viên', 'Biên tập viên', 'Giám đốc', 'Văn thư']
  if (GLOBAL_ROLES.indexOf(session.role) === -1) {
    // Trưởng phòng / Nhân viên: see docs in their department(s)
    var userDepts = session.departments || []
    if (userDepts.length > 0) {
      docs = docs.filter(function(d) {
        return userDepts.indexOf(d['Phòng ban']) !== -1
      })
    } else {
      // Fallback: only own docs (legacy / no dept assigned)
      docs = docs.filter(function(d) { return d['Phụ trách'] === session.userId })
    }
  }

  // Status filter
  if (filters.tinhTrang) {
    docs = docs.filter(function(d) { return d['Tình trạng'] === filters.tinhTrang })
  }

  // Category filter
  if (filters.danhMucId) {
    docs = docs.filter(function(d) { return String(d['Danh mục']) === String(filters.danhMucId) })
  }

  // Department filter
  if (filters.phongBan) {
    docs = docs.filter(function(d) { return String(d['Phòng ban']) === String(filters.phongBan) })
  }

  // Project filter
  if (filters.duAn) {
    docs = docs.filter(function(d) { return String(d['Dự án']) === String(filters.duAn) })
  }

  // Supplier filter
  if (filters.nhaCungCap) {
    docs = docs.filter(function(d) { return String(d['Nhà cung cấp']) === String(filters.nhaCungCap) })
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
        (d['Phòng ban'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Dự án'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Nhà cung cấp'] || '').toLowerCase().indexOf(kw) !== -1 ||
        (d['Mô tả'] || '').toLowerCase().indexOf(kw) !== -1 ||
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
    'Phòng ban': data['Phòng ban'] || '',
    'Số hồ sơ': data['Số hồ sơ'] || '',
    'Dự án': data['Dự án'] || '',
    'Nhà cung cấp': data['Nhà cung cấp'] || '',
    'Ngày ban hành': data['Ngày ban hành'] || '',
    'Ngày kết thúc': data['Ngày kết thúc'] || '',
    'Giá trị HĐ': data['Giá trị HĐ'] || 0,
    'Giá trị thực hiện': data['Giá trị thực hiện'] || 0,
    'Chênh lệch': _calcDiff(data['Giá trị HĐ'], data['Giá trị thực hiện']),
    'Tình trạng': data['Tình trạng'] || 'Hiệu lực',
    'Mô tả': data['Mô tả'] || '',
    'File ID': fileIdCol,
    'Tên file': fileNameCol,
    'Loại file': uploadedFiles.length > 0 ? uploadedFiles[0].mimeType : '',
    'Kích thước': '',
    'Phụ trách': _buildAssignees(data['Phụ trách'], session.userId),
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

  // Permission: viewer/dept user can only edit docs they are assigned to
  if (session.role !== 'Quản trị viên' && session.role !== 'Biên tập viên' &&
      session.role !== 'admin' && session.role !== 'Giám đốc' && session.role !== 'Văn thư') {
    var existingAssignees = _parseAssignees(doc['Phụ trách'])
    var userId = String(session.userId)
    var uname  = session.username
    if (existingAssignees.indexOf(userId) === -1 && existingAssignees.indexOf(uname) === -1) {
      throw new Error('Bạn không có quyền chỉnh sửa hồ sơ này')
    }
  }

  var updates = {}

  var textFields = [
    'Tên hồ sơ', 'Danh mục', 'Phòng ban', 'Số hồ sơ',
    'Dự án', 'Nhà cung cấp', 'Ngày ban hành', 'Ngày kết thúc',
    'Tình trạng', 'Mô tả'
  ]
  textFields.forEach(function(f) {
    if (data[f] !== undefined) updates[f] = data[f]
  })

  // Recalc diff when value fields change
  var giaTriHD = data['Giá trị HĐ'] !== undefined ? data['Giá trị HĐ'] : doc['Giá trị HĐ']
  var giaTriTH = data['Giá trị thực hiện'] !== undefined ? data['Giá trị thực hiện'] : doc['Giá trị thực hiện']
  if (data['Giá trị HĐ'] !== undefined) updates['Giá trị HĐ'] = data['Giá trị HĐ']
  if (data['Giá trị thực hiện'] !== undefined) updates['Giá trị thực hiện'] = data['Giá trị thực hiện']
  if (data['Giá trị HĐ'] !== undefined || data['Giá trị thực hiện'] !== undefined) {
    updates['Chênh lệch'] = _calcDiff(giaTriHD, giaTriTH)
  }

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

  var allFiles = keptFiles.concat(newlyUploaded)
  updates['File ID'] = allFiles.length > 0 ? JSON.stringify(allFiles) : ''
  updates['Tên file'] = allFiles.map(function(f) { return f.fileName }).join(', ')
  if (allFiles.length > 0) updates['Loại file'] = allFiles[0].mimeType

  // Update Phụ trách if provided
  if (data['Phụ trách'] !== undefined) {
    updates['Phụ trách'] = _buildAssignees(data['Phụ trách'], session.userId)
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
  requireAdmin(token)

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
  var totalExecuted = 0

  docs.forEach(function(d) {
    var s = d['Tình trạng'] || 'Không rõ'
    byStatus[s] = (byStatus[s] || 0) + 1
    totalValue += Number(d['Giá trị HĐ']) || 0
    totalExecuted += Number(d['Giá trị thực hiện']) || 0
  })

  return {
    total: total,
    byStatus: byStatus,
    totalValue: totalValue,
    totalExecuted: totalExecuted,
    totalDiff: totalValue - totalExecuted,
  }
}

// ── private helpers ──────────────────────────────────────────────────────────

function _calcDiff(hdVal, thVal) {
  return (Number(hdVal) || 0) - (Number(thVal) || 0)
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

// Build JSON array string for Phụ trách from input (array, string, or null → default to userId)
function _buildAssignees(input, defaultUserId) {
  if (Array.isArray(input) && input.length > 0) {
    return JSON.stringify(input.map(String))
  }
  if (input && typeof input === 'string') {
    if (input.charAt(0) === '[') return input // already JSON
    return JSON.stringify([input])
  }
  return JSON.stringify([String(defaultUserId)])
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
